import "server-only";
import type { PropertyAddress, PropertyImageFetchResult, PropertyImageProvider } from "./provider";

/**
 * Nearmap provider (V1.3). SERVER ONLY — uses NEARMAP_API_KEY.
 *
 * Two calls per address, using Nearmap's Transactional Content API:
 *
 *  1. GET https://api.nearmap.com/coverage/v2/tx/address
 *       ?country=US&streetAddress=…&city=…&state=…&postcode=…
 *       &resources=raster:Vert&dates=single&limit=1
 *     Header: Authorization: Apikey <NEARMAP_API_KEY>
 *     → Nearmap geocodes the address to its parcel, returns the newest
 *       vertical (top-down aerial) survey, the parcel bounding box, and a
 *       transactionToken. Credits are charged on THIS call
 *       (costOfTransaction), only when imagery exists.
 *
 *  2. GET https://api.nearmap.com/staticmap/v3/surveys/{surveyId}/Vert.jpg
 *       ?bbox=<parcel bbox>&maxSize=1600x1600&transactionToken=…
 *     → one JPEG of that parcel (no extra credit charge).
 *
 * The API key is sent in a header (never in a URL) and never leaves the server.
 */

export const NEARMAP_ENDPOINTS = {
  coverageTxAddress: "https://api.nearmap.com/coverage/v2/tx/address",
  staticMap: "https://api.nearmap.com/staticmap/v3/surveys",
} as const;

const RESOURCE = "raster:Vert";
const IMAGE_TYPE = "Vert";
const MAX_SIZE = "1600x1600";
const MAX_ATTEMPTS = 3; // 1 try + 2 retries, only for 429 / 502 / 503 / network errors
const TIMEOUT_MS = 25_000;
const LOW_CONFIDENCE = 0.9;

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

interface Deps {
  fetch: FetchLike;
  sleep: (ms: number) => Promise<void>;
}

const defaultDeps: Deps = {
  fetch: (url, init) => fetch(url, init),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

interface TxSurvey {
  id?: string;
  captureDate?: string;
  contentTypes?: string[];
}

interface TxResponse {
  surveys?: TxSurvey[];
  transactionToken?: string;
  costOfTransaction?: number;
  bbox?: string | number[];
  geocodedAddress?: string;
  geocodedConfidence?: number;
  errors?: string[];
}

/** Bounded retry: only transient statuses, max MAX_ATTEMPTS, short waits. Never infinite. */
async function requestWithRetry(deps: Deps, url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await deps.fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
      const transient = res.status === 429 || res.status === 502 || res.status === 503;
      if (!transient || attempt === MAX_ATTEMPTS) return res;
      // Respect X-Ratelimit-Reset if it's soon, otherwise back off 1.5s, 4s.
      const reset = Number(res.headers.get("x-ratelimit-reset"));
      const untilReset = Number.isFinite(reset) && reset > 0 ? reset * 1000 - Date.now() : NaN;
      const wait = Number.isFinite(untilReset) && untilReset > 0 && untilReset < 10_000 ? untilReset : attempt === 1 ? 1500 : 4000;
      await deps.sleep(wait);
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS) break;
      await deps.sleep(attempt === 1 ? 1500 : 4000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Network error");
}

function normalizeBbox(bbox: TxResponse["bbox"]): string | null {
  if (!bbox) return null;
  const parts = (Array.isArray(bbox) ? bbox.map(String) : String(bbox).split(",")).map((s) => s.trim());
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(Number(p)))) return null;
  return parts.join(",");
}

async function readErrors(res: Response): Promise<string[]> {
  try {
    const body = (await res.json()) as { errors?: unknown };
    return Array.isArray(body.errors) ? body.errors.map(String) : [];
  } catch {
    return [];
  }
}

const NOT_FOUND_MESSAGES: Record<string, string> = {
  SURVEYS_NOT_FOUND: "No Nearmap aerial imagery covers this address",
  GEOCODE_UNABLE_TO_DECODE: "Nearmap couldn't find this address",
  INVALID_ADDRESS: "Nearmap couldn't read this address",
};

export function createNearmapProvider(apiKey: string, deps: Deps = defaultDeps): PropertyImageProvider {
  const authHeaders = { Authorization: `Apikey ${apiKey}`, Accept: "application/json" };

  return {
    id: "nearmap",
    name: "Nearmap",

    async fetchImage(address: PropertyAddress): Promise<PropertyImageFetchResult> {
      const street = address.street?.trim();
      if (!street || !(address.zip?.trim() || (address.city?.trim() && address.state?.trim()))) {
        return { kind: "error", reason: "Address is incomplete (need street plus ZIP, or street + city + state)" };
      }

      // ---- 1. coverage / transaction by address -------------------------
      const q = new URLSearchParams({
        country: address.country ?? "US",
        streetAddress: street,
        resources: RESOURCE,
        dates: "single",
        limit: "1",
      });
      if (address.city?.trim()) q.set("city", address.city.trim());
      if (address.state?.trim()) q.set("state", address.state.trim().toUpperCase());
      if (address.zip?.trim()) q.set("postcode", address.zip.trim().slice(0, 10));

      let txRes: Response;
      try {
        txRes = await requestWithRetry(deps, `${NEARMAP_ENDPOINTS.coverageTxAddress}?${q.toString()}`, {
          method: "GET",
          headers: authHeaders,
        });
      } catch (err) {
        return { kind: "error", reason: `Couldn't reach Nearmap (${err instanceof Error ? err.message : "network error"})` };
      }

      if (txRes.status === 401) return { kind: "error", fatal: true, reason: "Nearmap rejected the API key (401). Check NEARMAP_API_KEY." };
      if (txRes.status === 403) {
        return { kind: "error", fatal: true, reason: "Nearmap refused access (403). The account may not include Transactional Content / vertical imagery." };
      }
      if (txRes.status === 404 || txRes.status === 400) {
        const codes = await readErrors(txRes);
        const known = codes.find((c) => NOT_FOUND_MESSAGES[c]);
        if (known) return { kind: "not_found", reason: `${NOT_FOUND_MESSAGES[known]} (${known})` };
        if (txRes.status === 404) return { kind: "not_found", reason: "No Nearmap imagery found for this address" };
        return { kind: "error", reason: `Nearmap rejected the request (400${codes.length ? `: ${codes.join(", ")}` : ""})` };
      }
      if (!txRes.ok) return { kind: "error", reason: `Nearmap coverage request failed (HTTP ${txRes.status})` };

      let tx: TxResponse;
      try {
        tx = (await txRes.json()) as TxResponse;
      } catch {
        return { kind: "error", reason: "Nearmap returned an unreadable coverage response" };
      }

      const surveys = tx.surveys ?? [];
      const survey = surveys.find((s) => s.id && (!s.contentTypes || s.contentTypes.includes(RESOURCE))) ?? null;
      if (!survey?.id) return { kind: "not_found", reason: "No Nearmap aerial imagery covers this address (no surveys)" };
      if (!tx.transactionToken) return { kind: "error", reason: "Nearmap didn't return a transaction token" };
      const bbox = normalizeBbox(tx.bbox);
      if (!bbox) return { kind: "error", reason: "Nearmap didn't return a usable area for this address" };

      // ---- 2. static image for the parcel --------------------------------
      const imgQ = new URLSearchParams({ bbox, maxSize: MAX_SIZE, transactionToken: tx.transactionToken });
      const imgUrl = `${NEARMAP_ENDPOINTS.staticMap}/${encodeURIComponent(survey.id)}/${IMAGE_TYPE}.jpg?${imgQ.toString()}`;

      let imgRes: Response;
      try {
        imgRes = await requestWithRetry(deps, imgUrl, { method: "GET", headers: { Accept: "image/*" } });
      } catch (err) {
        return { kind: "error", reason: `Couldn't download the Nearmap image (${err instanceof Error ? err.message : "network error"})` };
      }
      if (imgRes.status === 404) return { kind: "not_found", reason: "Nearmap has no image tile for this parcel" };
      if (!imgRes.ok) return { kind: "error", reason: `Nearmap image download failed (HTTP ${imgRes.status})` };

      const contentType = (imgRes.headers.get("content-type") || "").split(";")[0].trim();
      if (!contentType.startsWith("image/")) {
        return { kind: "error", reason: `Nearmap returned ${contentType || "an unknown file type"} instead of an image` };
      }
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      if (bytes.byteLength < 500) return { kind: "error", reason: "Nearmap returned an empty image" };

      // ---- reviewer note -------------------------------------------------
      const bits = [`Nearmap aerial${survey.captureDate ? ` captured ${survey.captureDate}` : ""}`];
      if (tx.geocodedAddress) bits.push(`matched “${tx.geocodedAddress}”`);
      if (typeof tx.geocodedConfidence === "number" && tx.geocodedConfidence < LOW_CONFIDENCE) {
        bits.push(`LOW address-match confidence ${Math.round(tx.geocodedConfidence * 100)}% — check it's the right house`);
      }
      if (typeof tx.costOfTransaction === "number") bits.push(`${tx.costOfTransaction} credit${tx.costOfTransaction === 1 ? "" : "s"}`);

      return {
        kind: "found",
        bytes,
        contentType: contentType === "image/png" ? "image/png" : "image/jpeg",
        extension: contentType === "image/png" ? "png" : "jpg",
        source: "nearmap",
        note: bits.join(" · "),
        capturedAt: survey.captureDate,
      };
    },
  };
}

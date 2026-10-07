import "server-only";
import { PUBLIC_TOKEN_RE } from "@/lib/constants";

/**
 * Public, read-only lead context for the /adu page.
 *
 * Resolves the lead ONLY from its random public_token (?ref=…) — never from the
 * sequential lead_code (V1.6.2).
 * Returns ONLY: city and the property image IF it is APPROVED.
 * Never owner names, addresses, mailing info, statuses, database id or lead_code.
 * The hero image depends only on property_image_status = 'approved' + a URL —
 * not on owner name, mailing completeness or postcard status.
 *
 * Never throws. Every outcome comes with a `reason` so problems are visible in
 * the dev server log instead of silently falling back.
 */

export interface LandingLead {
  city: string | null;
  /** Set only when property_image_status = 'approved' and a URL exists. */
  imageUrl: string | null;
}

export type LandingLeadReason =
  | "no_code"
  | "invalid_code"
  | "client_unavailable"
  | "timeout"
  | "query_error"
  | "not_found"
  | "do_not_contact"
  | "image_not_approved"
  | "image_url_missing"
  | "image_url_invalid"
  | "ok_approved_image";

export interface LandingLeadResult {
  lead: LandingLead | null;
  reason: LandingLeadReason;
  detail?: string;
}

type Row = {
  city: string | null;
  property_image_url: string | null;
  property_image_status: string | null;
  follow_up_status: string | null;
};

/** Minimal shape of the Supabase client we need (lets tests pass a fake). */
export interface LeadLookupClient {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
}

/** Valid public token or null. Case-sensitive — no uppercasing. */
export function normalizePublicToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const token = raw.trim();
  return PUBLIC_TOKEN_RE.test(token) ? token : null;
}

const COLUMNS = "city, property_image_url, property_image_status, follow_up_status";
const TIMEOUT = Symbol("timeout");

async function queryOnce(client: LeadLookupClient, token: string, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(client.from("leads").select(COLUMNS).eq("public_token", token).maybeSingle()),
      new Promise<typeof TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function loadLandingLeadWithReason(
  rawRef: unknown,
  getClient: () => LeadLookupClient,
  // Generous: the first request in `npm run dev` compiles the page and opens a
  // fresh Supabase connection, which can take several seconds.
  timeoutMs = 8000
): Promise<LandingLeadResult> {
  if (rawRef === undefined || rawRef === null || rawRef === "") return { lead: null, reason: "no_code" };
  const token = normalizePublicToken(rawRef);
  if (!token) return { lead: null, reason: "invalid_code" };

  let client: LeadLookupClient;
  try {
    client = getClient();
  } catch (e) {
    return { lead: null, reason: "client_unavailable", detail: e instanceof Error ? e.message : "unknown" };
  }

  try {
    let result = await queryOnce(client, token, timeoutMs);
    if (result === TIMEOUT) result = await queryOnce(client, token, timeoutMs); // one retry, then give up
    if (result === TIMEOUT) return { lead: null, reason: "timeout", detail: `${timeoutMs}ms ×2` };
    if (result.error) {
      const msg = (result.error as { message?: string }).message ?? String(result.error);
      return { lead: null, reason: "query_error", detail: msg };
    }
    if (!result.data) return { lead: null, reason: "not_found" };

    const row = result.data as Row;
    if (row.follow_up_status === "Do not contact") return { lead: null, reason: "do_not_contact" };

    const base: LandingLead = { city: row.city?.trim() || null, imageUrl: null };
    if (row.property_image_status !== "approved") {
      return { lead: base, reason: "image_not_approved", detail: String(row.property_image_status) };
    }
    const url = row.property_image_url?.trim() || "";
    if (!url) return { lead: base, reason: "image_url_missing" };
    if (!/^https?:\/\//i.test(url)) return { lead: base, reason: "image_url_invalid" };

    return { lead: { ...base, imageUrl: url }, reason: "ok_approved_image" };
  } catch (e) {
    return { lead: null, reason: "query_error", detail: e instanceof Error ? e.message : "unknown" };
  }
}

/** Convenience wrapper (lead only). */
export async function loadLandingLead(
  rawRef: unknown,
  getClient: () => LeadLookupClient,
  timeoutMs?: number
): Promise<LandingLead | null> {
  return (await loadLandingLeadWithReason(rawRef, getClient, timeoutMs)).lead;
}

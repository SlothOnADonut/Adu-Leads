import type { ImportLeadRow } from "./types";
import { computeEquityScore, computeFinalScore, computePermitScore } from "./scoring";

export type ImportFieldKey =
  | keyof ImportLeadRow
  | "mailing_city"
  | "mailing_state"
  | "mailing_zip";

export interface ImportField {
  key: ImportFieldKey;
  label: string;
  group: "Owner" | "Property" | "Permit" | "Enrichment" | "Scores";
  aliases: string[];
}

export const IMPORT_FIELDS: ImportField[] = [
  { key: "owner_name_raw", label: "Owner (full name)", group: "Owner", aliases: ["owner", "owner name", "owner_name", "homeowner", "owner 1", "owner1", "owner full name", "name"] },
  { key: "first_name", label: "First name", group: "Owner", aliases: ["first name", "owner first name", "first", "firstname"] },
  { key: "last_name", label: "Last name", group: "Owner", aliases: ["last name", "owner last name", "last", "lastname", "surname"] },
  { key: "mailing_address", label: "Mailing address", group: "Owner", aliases: ["mailing address", "mail address", "mailing", "mail addr", "mailing street", "owner address", "owner mailing address"] },
  { key: "mailing_city", label: "Mailing city", group: "Owner", aliases: ["mailing city", "mail city", "owner city"] },
  { key: "mailing_state", label: "Mailing state", group: "Owner", aliases: ["mailing state", "mail state", "owner state"] },
  { key: "mailing_zip", label: "Mailing ZIP", group: "Owner", aliases: ["mailing zip", "mail zip", "mailing zip code", "owner zip"] },

  { key: "property_address", label: "Property address", group: "Property", aliases: ["property address", "site address", "situs address", "address", "property", "job address", "street address", "situs"] },
  { key: "city", label: "Property city", group: "Property", aliases: ["city", "property city", "site city", "situs city"] },
  { key: "state", label: "Property state", group: "Property", aliases: ["state", "property state", "site state"] },
  { key: "zip", label: "Property ZIP", group: "Property", aliases: ["zip", "zip code", "zipcode", "property zip", "site zip", "postal code"] },
  { key: "apn", label: "APN", group: "Property", aliases: ["apn", "parcel", "parcel number", "parcel no", "assessor parcel number", "apn number"] },

  { key: "permit_number", label: "Permit number", group: "Permit", aliases: ["permit number", "permit #", "permit no", "permit", "permit num", "record number", "record id"] },
  { key: "permit_issue_date", label: "Permit issue date", group: "Permit", aliases: ["permit issue date", "issue date", "issued date", "date issued", "issued", "issue dt"] },
  { key: "permit_status", label: "Permit status", group: "Permit", aliases: ["permit status", "status"] },
  { key: "permit_description", label: "Description", group: "Permit", aliases: ["description", "permit description", "work description", "scope", "scope of work"] },
  { key: "job_valuation", label: "Job valuation", group: "Permit", aliases: ["job valuation", "valuation", "job value", "value", "project valuation"] },
  { key: "project_type", label: "Project type", group: "Permit", aliases: ["project type", "type", "work type", "permit type", "adu type"] },
  { key: "owner_builder", label: "Owner builder", group: "Permit", aliases: ["owner builder", "owner-builder", "ownerbuilder"] },
  { key: "plan_check", label: "Plan check", group: "Permit", aliases: ["plan check", "plan check number", "plan check #", "plan check no"] },

  { key: "last_sale_date", label: "Last sale date", group: "Enrichment", aliases: ["last sale date", "sale date", "last sold date", "last sold", "recording date"] },
  { key: "last_sale_price", label: "Last sale price", group: "Enrichment", aliases: ["last sale price", "sale price", "last sold price"] },

  { key: "permit_score", label: "Permit score", group: "Scores", aliases: ["permit score"] },
  { key: "equity_signal_score", label: "Equity score", group: "Scores", aliases: ["equity score", "equity signal score", "equity"] },
  { key: "final_priority_score", label: "Priority", group: "Scores", aliases: ["priority", "priority score", "final priority score", "final score", "score"] },
];

export type ColumnMapping = Partial<Record<ImportFieldKey, string>>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Guesses which CSV column belongs to which field (exact match after normalizing). */
export function autoMap(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    const wanted = field.aliases.map(norm);
    const hit = headers.find((h) => !used.has(h) && wanted.includes(norm(h)));
    if (hit) {
      mapping[field.key] = hit;
      used.add(hit);
    }
  }
  return mapping;
}

// ---------------------------------------------------------------------
// Value cleaning
// ---------------------------------------------------------------------

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function parseNumber(v: unknown): number | null {
  const s = clean(v);
  if (!s) return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseScore(v: unknown): number | null {
  const n = parseNumber(v);
  if (n === null) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Accepts 2026-03-14, 3/14/2026, 3/14/26, 03-14-2026, "Mar 14, 2026". Returns YYYY-MM-DD or null. */
export function parseDate(v: unknown): string | null {
  const s = clean(v);
  if (!s) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const valid = (y: number, m: number, d: number) =>
    y > 1800 && y < 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y > 50 ? 1900 : 2000;
    const [mo, d] = [Number(m[1]), Number(m[2])];
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const dt = new Date(t);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }
  return null;
}

// ---------------------------------------------------------------------
// Owner name splitting
// ---------------------------------------------------------------------

export type NameFormat = "first_last" | "last_first";

const ENTITY_RE = /\b(trust|llc|inc|corp|corporation|estate|ltd|lp|living|revocable|family|bank|properties|holdings)\b/i;

/** Splits an owner string into first/last. Trusts and companies are left unsplit. */
export function splitOwnerName(raw: string | null, format: NameFormat): { first: string | null; last: string | null } {
  if (!raw) return { first: null, last: null };
  if (ENTITY_RE.test(raw)) return { first: null, last: null };

  // Use only the first person when there are co-owners: "SMITH JOHN & MARY"
  const primary = raw.split(/\s*(?:&|\band\b|\/|;)\s*/i)[0].trim();

  if (primary.includes(",")) {
    const [last, rest] = primary.split(",").map((p) => p.trim());
    return { first: rest?.split(/\s+/)[0] || null, last: last || null };
  }

  const words = primary.split(/\s+/).filter(Boolean);
  if (words.length < 2) return { first: null, last: words[0] ?? null };
  if (format === "last_first") return { first: words[1], last: words[0] };
  return { first: words[0], last: words[words.length - 1] };
}

// ---------------------------------------------------------------------
// Build rows for the database
// ---------------------------------------------------------------------

export interface BuildOptions {
  defaultCity: string;
  defaultState: string;
  nameFormat: NameFormat;
}

export interface BuildResult {
  rows: ImportLeadRow[];
  missingIdentifier: number;
}

export function buildLeadRows(
  rawRows: Record<string, unknown>[],
  mapping: ColumnMapping,
  options: BuildOptions
): BuildResult {
  const get = (row: Record<string, unknown>, key: ImportFieldKey) => {
    const col = mapping[key];
    return col ? clean(row[col]) : null;
  };

  let missingIdentifier = 0;
  const rows: ImportLeadRow[] = [];

  for (const raw of rawRows) {
    const ownerRaw = get(raw, "owner_name_raw");
    let first = get(raw, "first_name");
    let last = get(raw, "last_name");
    if (!first && !last && ownerRaw) {
      const split = splitOwnerName(ownerRaw, options.nameFormat);
      first = split.first;
      last = split.last;
    }

    let mailing = get(raw, "mailing_address");
    const mCity = get(raw, "mailing_city");
    const mState = get(raw, "mailing_state");
    const mZip = get(raw, "mailing_zip");
    if (mailing && (mCity || mState || mZip)) {
      const stateZip = [mState, mZip].filter(Boolean).join(" ");
      mailing = [mailing, mCity, stateZip].filter(Boolean).join(", ");
    }

    const issueDate = parseDate(get(raw, "permit_issue_date"));
    const valuation = parseNumber(get(raw, "job_valuation"));
    const permitStatus = get(raw, "permit_status");
    const lastSaleDate = parseDate(get(raw, "last_sale_date"));

    const permitScore = parseScore(get(raw, "permit_score")) ??
      computePermitScore({ issueDate, valuation, status: permitStatus });
    const equityScore = parseScore(get(raw, "equity_signal_score")) ?? computeEquityScore(lastSaleDate);
    const finalScore = computeFinalScore(permitScore, equityScore, parseScore(get(raw, "final_priority_score")));

    const apn = get(raw, "apn");
    const permitNumber = get(raw, "permit_number");
    if (!apn && !permitNumber) missingIdentifier++;

    rows.push({
      first_name: first,
      last_name: last,
      owner_name_raw: ownerRaw,
      mailing_address: mailing,
      property_address: get(raw, "property_address"),
      city: get(raw, "city") ?? (options.defaultCity.trim() || null),
      state: get(raw, "state") ?? (options.defaultState.trim() || null),
      zip: get(raw, "zip"),
      apn,
      permit_number: permitNumber,
      permit_issue_date: issueDate,
      permit_status: permitStatus,
      permit_description: get(raw, "permit_description"),
      job_valuation: valuation,
      project_type: get(raw, "project_type"),
      owner_builder: get(raw, "owner_builder"),
      plan_check: get(raw, "plan_check"),
      last_sale_date: lastSaleDate,
      last_sale_price: parseNumber(get(raw, "last_sale_price")),
      permit_score: permitScore,
      equity_signal_score: equityScore,
      final_priority_score: finalScore,
    });
  }

  return { rows, missingIdentifier };
}

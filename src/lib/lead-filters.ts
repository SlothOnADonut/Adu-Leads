import { addDays, formatDate } from "./format";
import type { Campaign } from "./types";
import { isImageStatus, PROPERTY_IMAGE_STATUS_LABELS } from "./property-images/types";

/**
 * The Leads page filters. This ONE function is used both to show the table
 * and to decide what "Delete all filtered leads" deletes, so the two can
 * never disagree.
 */
export type LeadFilterParams = {
  campaign?: string;
  city?: string;
  min?: string;
  scanned?: string;
  status?: string;
  sent?: string;
  due?: string;
  mailing?: string;
  q?: string;
  archived?: string; // "1" = include leads from archived campaigns
  img?: string; // property image status (V1.2)
};

export const FILTER_KEYS: (keyof LeadFilterParams)[] = [
  "campaign", "city", "min", "scanned", "status", "sent", "due", "mailing", "q", "archived", "img",
];

/** Keeps only known filter keys with non-empty string values. */
export function pickFilters(input: Record<string, unknown>): LeadFilterParams {
  const out: LeadFilterParams = {};
  for (const k of FILTER_KEYS) {
    const v = input[k];
    if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  }
  return out;
}

/** Filters that actually narrow the list ("include archived" widens it, so it doesn't count). */
export function hasNarrowingFilter(params: LeadFilterParams): boolean {
  return FILTER_KEYS.some((k) => k !== "archived" && !!params[k]);
}

export function cleanSearch(q: string): string {
  return q.replace(/[,()*%\\]/g, " ").replace(/\s+/g, " ").trim();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any;

export function applyLeadFilters(
  query: Query,
  params: LeadFilterParams,
  today: string,
  archivedIds: string[]
): Query {
  let q = query;

  if (params.campaign === "none") q = q.is("campaign_id", null);
  else if (params.campaign && UUID_RE.test(params.campaign)) q = q.eq("campaign_id", params.campaign);
  else if (params.campaign) q = q.eq("campaign_id", "00000000-0000-0000-0000-000000000000"); // invalid id → match nothing

  // Hide leads from archived campaigns unless a campaign is chosen or "include archived" is on.
  if (!params.campaign && params.archived !== "1" && archivedIds.length > 0) {
    q = q.or(`campaign_id.is.null,campaign_id.not.in.(${archivedIds.join(",")})`);
  }

  if (params.city) q = q.ilike("city", params.city.replace(/[%_\\]/g, ""));
  if (params.min) q = q.gte("final_priority_score", Number(params.min) || 0);
  if (params.scanned === "yes") q = q.gt("qr_scan_count", 0);
  if (params.scanned === "no") q = q.eq("qr_scan_count", 0);
  if (params.status) q = q.eq("follow_up_status", params.status);
  if (params.sent === "yes") q = q.not("postcard_sent_date", "is", null);
  if (params.sent === "no") q = q.is("postcard_sent_date", null);
  if (params.due === "overdue") q = q.lt("next_follow_up_date", today);
  if (params.due === "today") q = q.eq("next_follow_up_date", today);
  if (params.due === "due") q = q.lte("next_follow_up_date", today);
  if (params.due === "week") q = q.lte("next_follow_up_date", addDays(today, 7));
  if (params.mailing === "same") q = q.eq("mailing_differs", false);
  if (params.mailing === "different") q = q.eq("mailing_differs", true);
  if (params.img) {
    // unknown value → match nothing (never silently widen a filter)
    q = isImageStatus(params.img) ? q.eq("property_image_status", params.img) : q.eq("property_image_status", "__none__");
  }
  if (params.q) {
    const s = cleanSearch(params.q);
    const token = params.q.trim();
    if (/^[A-Za-z0-9_-]{16}$/.test(token)) {
      // exact public token (from a ?ref= link or Calendly utm_content)
      q = q.or(`public_token.eq.${token},lead_code.ilike.%${s}%`);
    } else if (s) {
      q = q.or(
        `lead_code.ilike.%${s}%,owner_name_raw.ilike.%${s}%,last_name.ilike.%${s}%,property_address.ilike.%${s}%,mailing_address.ilike.%${s}%,apn.ilike.%${s}%,permit_number.ilike.%${s}%`
      );
    }
  }
  return q;
}

/** Human-readable list of the active filters, shown in the delete dialog. */
export function describeFilters(params: LeadFilterParams, campaigns: Campaign[], today: string): string[] {
  const out: string[] = [];
  if (params.campaign === "none") out.push("Campaign: No campaign");
  else if (params.campaign) {
    const c = campaigns.find((x) => x.id === params.campaign);
    out.push(`Campaign: ${c ? c.name : "Unknown campaign"}${c?.archived_at ? " (archived)" : ""}`);
  }
  if (params.city) out.push(`City: ${params.city}`);
  if (params.status) out.push(`Status: ${params.status}`);
  if (params.min) out.push(`Priority: ${params.min}+`);
  if (params.scanned === "yes") out.push("Scanned: yes");
  if (params.scanned === "no") out.push("Scanned: no");
  if (params.sent === "yes") out.push("Postcard: sent");
  if (params.sent === "no") out.push("Postcard: not sent");
  if (params.due === "overdue") out.push(`Follow-up: overdue (before ${formatDate(today)})`);
  if (params.due === "today") out.push(`Follow-up: due today (${formatDate(today)})`);
  if (params.due === "due") out.push(`Follow-up: due or overdue (on/before ${formatDate(today)})`);
  if (params.due === "week") out.push(`Follow-up: due by ${formatDate(addDays(today, 7))}`);
  if (params.mailing === "same") out.push("Occupancy: likely owner-occupied");
  if (params.mailing === "different") out.push("Occupancy: different mailing address");
  if (params.img) out.push(`Property image: ${isImageStatus(params.img) ? PROPERTY_IMAGE_STATUS_LABELS[params.img] : params.img}`);
  if (params.q) out.push(`Search: “${cleanSearch(params.q)}”`);
  if (params.archived === "1" && !params.campaign) out.push("Including archived campaigns");
  return out;
}

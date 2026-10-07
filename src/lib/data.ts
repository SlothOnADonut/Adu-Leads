import type { SupabaseClient } from "@supabase/supabase-js";
import type { Campaign, Lead } from "./types";
import { summarize, type Summary } from "./metrics";

const PAGE = 1000;

/** Loads every lead (paging past Supabase's 1,000-row limit). */
export async function fetchAllLeads(supabase: SupabaseClient, columns = "*"): Promise<Lead[]> {
  const all: Lead[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("leads")
      .select(columns)
      .order("lead_code", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Lead[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

export async function fetchCampaigns(supabase: SupabaseClient): Promise<Campaign[]> {
  const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Campaign[];
}

/** Campaigns that are not archived. */
export function activeCampaigns(campaigns: Campaign[]): Campaign[] {
  return campaigns.filter((c) => !c.archived_at);
}

/** IDs of archived campaigns (their leads are hidden from normal views). */
export function archivedCampaignIds(campaigns: Campaign[]): Set<string> {
  return new Set(campaigns.filter((c) => c.archived_at).map((c) => c.id));
}

/** Drops leads that belong to an archived campaign. Leads with no campaign stay. */
export function withoutArchived<T extends { campaign_id: string | null }>(leads: T[], campaigns: Campaign[]): T[] {
  const archived = archivedCampaignIds(campaigns);
  if (archived.size === 0) return leads;
  return leads.filter((l) => !l.campaign_id || !archived.has(l.campaign_id));
}

/** Campaign dropdown options: active ones, plus the currently selected one even if archived. */
export function campaignOptions(campaigns: Campaign[], selectedId?: string | null): Campaign[] {
  return campaigns.filter((c) => !c.archived_at || c.id === selectedId);
}

export interface CampaignWithStats extends Campaign {
  stats: Summary;
}

export function campaignStats(campaigns: Campaign[], leads: Lead[]): CampaignWithStats[] {
  return campaigns.map((c) => ({
    ...c,
    stats: summarize(leads.filter((l) => l.campaign_id === c.id)),
  }));
}

export const LEAD_LIST_COLUMNS =
  "id, lead_code, first_name, last_name, owner_name_raw, mailing_address, property_address, city, state, zip, permit_issue_date, job_valuation, final_priority_score, campaign_id, postcard_sent_date, qr_scan_count, last_qr_scan_at, call_status, text_status, appointment_status, application_status, funded_status, follow_up_status, next_follow_up_date, last_activity_at, mailing_differs, property_image_status, postcard_image_ready";

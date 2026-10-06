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
  "id, lead_code, first_name, last_name, owner_name_raw, mailing_address, property_address, city, state, zip, permit_issue_date, job_valuation, final_priority_score, campaign_id, postcard_sent_date, qr_scan_count, last_qr_scan_at, call_status, text_status, appointment_status, application_status, funded_status, follow_up_status, next_follow_up_date, last_activity_at, mailing_differs";

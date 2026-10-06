import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllLeads, fetchCampaigns } from "./data";
import { ownerName } from "./format";
import { trackingUrl } from "./tracking";

export interface ExportRow {
  lead_code: string;
  owner_name: string;
  first_name: string;
  last_name: string;
  mailing_address: string;
  property_address: string;
  city: string;
  state: string;
  zip: string;
  unique_tracking_url: string;
  qr_image_url: string;
  qr_png_filename: string;
  campaign_id: string;
  campaign_name: string;
  priority_score: string;
}

export const EXPORT_COLUMNS: (keyof ExportRow)[] = [
  "lead_code",
  "owner_name",
  "first_name",
  "last_name",
  "mailing_address",
  "property_address",
  "city",
  "state",
  "zip",
  "unique_tracking_url",
  "qr_image_url",
  "qr_png_filename",
  "campaign_id",
  "campaign_name",
  "priority_score",
];

export interface ExportFilter {
  campaign?: string | null;
  includeSent?: boolean;
}

/** Leads for postcard printing. Always excludes "Do not contact". */
export async function getExportRows(supabase: SupabaseClient, origin: string, filter: ExportFilter): Promise<ExportRow[]> {
  const [leads, campaigns] = await Promise.all([fetchAllLeads(supabase), fetchCampaigns(supabase)]);
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));

  return leads
    .filter((l) => l.follow_up_status !== "Do not contact")
    .filter((l) => (filter.campaign ? l.campaign_id === filter.campaign : true))
    .filter((l) => (filter.includeSent ? true : !l.postcard_sent_date))
    .map((l) => ({
      lead_code: l.lead_code,
      owner_name: ownerName(l),
      first_name: l.first_name ?? "",
      last_name: l.last_name ?? "",
      mailing_address: l.mailing_address ?? "",
      property_address: l.property_address ?? "",
      city: l.city ?? "",
      state: l.state ?? "",
      zip: l.zip ?? "",
      unique_tracking_url: trackingUrl(l.lead_code),
      qr_image_url: `${origin}/api/qr/${l.lead_code}.png?size=1200`,
      qr_png_filename: `${l.lead_code}.png`,
      campaign_id: l.campaign_id ?? "",
      campaign_name: l.campaign_id ? campaignName.get(l.campaign_id) ?? "" : "",
      priority_score: l.final_priority_score?.toString() ?? "",
    }));
}

export function toCsv(rows: ExportRow[]): string {
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const r of rows) lines.push(EXPORT_COLUMNS.map((c) => esc(String(r[c] ?? ""))).join(","));
  return "﻿" + lines.join("\r\n");
}

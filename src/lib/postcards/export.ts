import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ownerName } from "@/lib/format";
import { trackingUrl } from "@/lib/tracking";
import { isPostcardReady, POSTCARD_LEAD_COLUMNS, recipientFor, type PostcardLead, type PostcardStatus } from "./data";

/**
 * One exportable postcard. This is the hand-off format for a future
 * print/mail provider (see print-provider.ts) and the manifest CSV.
 */
export interface PostcardExportItem {
  leadId: string;
  leadCode: string;
  ownerName: string;
  recipient: { name: string; lines: string[] };
  mailingAddress: string;
  mailingName: string;
  mailingStreet: string;
  mailingCity: string;
  mailingState: string;
  mailingZip: string;
  propertyAddress: string;
  frontAssetUrl: string;
  backAssetUrl: string;
  backWithAddressAssetUrl: string;
  trackingUrl: string;
  postcardStatus: PostcardStatus;
  postcardApprovedAt: string | null;
  propertyImageUrl: string;
  campaignId: string | null;
}

export async function getPostcardExportItems(
  supabase: SupabaseClient,
  origin: string,
  filter: { campaignId: string; statuses: PostcardStatus[] }
): Promise<PostcardExportItem[]> {
  const rows: PostcardLead[] = [];
  for (let from = 0; ; from += 1000) {
    // Approved-only exports read the database view postcard_export_candidates, which
    // already requires: approved postcard + approved image + complete mailing + not DNC.
    const approvedOnly = filter.statuses.length === 1 && filter.statuses[0] === "approved";
    const base = approvedOnly
      ? supabase.from("postcard_export_candidates").select(POSTCARD_LEAD_COLUMNS)
      : supabase
          .from("leads")
          .select(POSTCARD_LEAD_COLUMNS)
          .in("postcard_status", filter.statuses)
          .eq("mailing_complete", true)
          .neq("follow_up_status", "Do not contact");
    const { data, error } = await base
      .eq("campaign_id", filter.campaignId)
      .order("lead_code", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as PostcardLead[];
    rows.push(...page);
    if (page.length < 1000) break;
  }

  // Belt and braces: never export anything that isn't fully ready.
  return rows.filter((l) => isPostcardReady(l) && l.follow_up_status !== "Do not contact").map((l) => {
    const r = recipientFor(l)!;
    const asset = (side: string, extra = "") => `${origin}/api/postcards/${l.id}/${side}.svg${extra}`;
    return {
      leadId: l.id,
      leadCode: l.lead_code,
      ownerName: ownerName(l),
      recipient: { name: r.name, lines: r.lines },
      mailingAddress: r.lines.join(", "),
      mailingName: r.name,
      mailingStreet: l.mailing_street ?? "",
      mailingCity: l.mailing_city ?? "",
      mailingState: (l.mailing_state ?? "").toUpperCase(),
      mailingZip: l.mailing_zip ?? "",
      propertyAddress: [l.property_address, l.city, [l.state, l.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      frontAssetUrl: asset("front"),
      backAssetUrl: asset("back"),
      backWithAddressAssetUrl: asset("back", "?address=1"),
      trackingUrl: trackingUrl(l.public_token),
      postcardStatus: l.postcard_status,
      postcardApprovedAt: l.postcard_approved_at,
      propertyImageUrl: l.property_image_url!,
      campaignId: l.campaign_id,
    };
  });
}

const COLUMNS: [string, (i: PostcardExportItem) => string][] = [
  ["lead_code", (i) => i.leadCode],
  ["owner_name", (i) => i.ownerName],
  ["recipient_name", (i) => i.recipient.name],
  ["mailing_address", (i) => i.mailingAddress],
  ["mailing_street", (i) => i.mailingStreet],
  ["mailing_city", (i) => i.mailingCity],
  ["mailing_state", (i) => i.mailingState],
  ["mailing_zip", (i) => i.mailingZip],
  ["property_address", (i) => i.propertyAddress],
  ["front_asset_url", (i) => i.frontAssetUrl],
  ["back_asset_url", (i) => i.backAssetUrl],
  ["back_with_address_asset_url", (i) => i.backWithAddressAssetUrl],
  ["tracking_url", (i) => i.trackingUrl],
  ["postcard_status", (i) => i.postcardStatus],
  ["postcard_approved_at", (i) => i.postcardApprovedAt ?? ""],
  ["property_image_url", (i) => i.propertyImageUrl],
];

export function manifestCsv(items: PostcardExportItem[]): string {
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [COLUMNS.map(([h]) => h).join(",")];
  for (const i of items) lines.push(COLUMNS.map(([, f]) => esc(f(i))).join(","));
  return "﻿" + lines.join("\r\n");
}

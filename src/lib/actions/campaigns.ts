"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

const clean = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

export async function createCampaign(formData: FormData): Promise<{ error?: string; id?: string }> {
  const { supabase } = await requireUser();
  const name = clean(formData.get("name"));
  if (!name) return { error: "Campaign name is required" };

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name,
      city: clean(formData.get("city")),
      vertical: clean(formData.get("vertical")) ?? "ADU → HELOC",
      postcard_version: clean(formData.get("postcard_version")),
      landing_page_version: clean(formData.get("landing_page_version")),
      notes: clean(formData.get("notes")),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { id: data.id as string };
}

export async function updateCampaign(campaignId: string, formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const name = clean(formData.get("name"));
  if (!name) return { error: "Campaign name is required" };
  const { error } = await supabase
    .from("campaigns")
    .update({
      name,
      city: clean(formData.get("city")),
      vertical: clean(formData.get("vertical")),
      postcard_version: clean(formData.get("postcard_version")),
      landing_page_version: clean(formData.get("landing_page_version")),
      sent_date: clean(formData.get("sent_date")),
      notes: clean(formData.get("notes")),
    })
    .eq("id", campaignId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

/**
 * Bulk: mark every lead in a campaign as "Postcard queued" or "Postcard sent".
 * Only leads that haven't progressed past that point are changed, and
 * "Do not contact" leads are always skipped.
 */
export async function markCampaignPostcards(
  campaignId: string,
  mode: "queued" | "sent",
  sentDate?: string
): Promise<{ error?: string; count?: number }> {
  const { supabase, user } = await requireUser();
  const eligible = mode === "queued" ? ["Not contacted"] : ["Not contacted", "Postcard queued"];
  const date = sentDate && /^\d{4}-\d{2}-\d{2}$/.test(sentDate) ? sentDate : todayISO();

  const patch =
    mode === "queued"
      ? { follow_up_status: "Postcard queued" }
      : { follow_up_status: "Postcard sent", postcard_sent_date: date };

  const { data: updated, error: updateError } = await supabase
    .from("leads")
    .update(patch)
    .eq("campaign_id", campaignId)
    .in("follow_up_status", eligible)
    .select("id");
  if (updateError) return { error: updateError.message };

  const ids = ((updated ?? []) as unknown as { id: string }[]).map((l) => l.id);
  if (ids.length === 0) return { count: 0 };

  const events = ids.map((id) => ({
    lead_id: id,
    campaign_id: campaignId,
    event_type: mode === "queued" ? "postcard_queued" : "postcard_sent",
    event_source: "dashboard",
    metadata: { by: user.email, bulk: true, ...(mode === "sent" ? { sent_date: date } : {}) },
  }));
  const { error: eventError } = await supabase.from("tracking_events").insert(events);
  if (eventError) return { error: eventError.message };

  if (mode === "sent") {
    await supabase.from("campaigns").update({ sent_date: date }).eq("id", campaignId).is("sent_date", null);
  }

  revalidatePath("/", "layout");
  return { count: ids.length };
}

// ---------------------------------------------------------------------
// V1.1 — archive / restore / permanent delete
// ---------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Archive hides the campaign from normal views. Nothing is deleted. */
export async function archiveCampaign(campaignId: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(campaignId)) return { error: "Invalid campaign" };
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("campaigns")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", campaignId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function restoreCampaign(campaignId: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(campaignId)) return { error: "Invalid campaign" };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("campaigns").update({ archived_at: null }).eq("id", campaignId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export interface CampaignDeletionPreview {
  id: string;
  name: string;
  archived_at: string | null;
  sent_date: string | null;
  lead_count: number;
  scan_count: number;
  mailed_lead_count: number;
  event_count: number;
}

/** Fresh counts for the delete dialog, straight from the database. */
export async function getCampaignDeletionPreview(
  campaignId: string
): Promise<{ error?: string; preview?: CampaignDeletionPreview }> {
  if (!UUID_RE.test(campaignId)) return { error: "Invalid campaign" };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("campaign_deletion_preview", { p_campaign_id: campaignId });
  if (error) return { error: error.message };
  return { preview: data as unknown as CampaignDeletionPreview };
}

/**
 * Permanently deletes ONE campaign plus its leads and their events, in a
 * single database transaction (delete_campaign_permanently). Other
 * campaigns, users and settings are never touched.
 */
export async function deleteCampaignPermanently(
  campaignId: string,
  confirmText: string
): Promise<{ error?: string; leadsDeleted?: number; eventsDeleted?: number }> {
  if (confirmText !== "DELETE") return { error: "Type DELETE to confirm." };
  if (!UUID_RE.test(campaignId)) return { error: "Invalid campaign" };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("delete_campaign_permanently", {
    p_campaign_id: campaignId,
    p_confirm: "DELETE",
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  const res = data as unknown as { leads_deleted: number; events_deleted: number };
  return { leadsDeleted: res.leads_deleted, eventsDeleted: res.events_deleted };
}

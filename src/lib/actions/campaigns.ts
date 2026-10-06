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

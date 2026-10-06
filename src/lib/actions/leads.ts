"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FOLLOW_UP_STATUSES, type FollowUpStatus } from "@/lib/constants";
import { advanceStatus } from "@/lib/metrics";
import { addDays, formatDate, todayISO } from "@/lib/format";
import type { Campaign, Lead } from "@/lib/types";
import { applyLeadFilters, hasNarrowingFilter, pickFilters } from "@/lib/lead-filters";

export type QuickAction =
  | "postcard_queued"
  | "postcard_sent"
  | "called"
  | "texted"
  | "appointment_booked"
  | "applied"
  | "funded"
  | "do_not_contact"
  | "follow_up_done"
  | "snooze_1"
  | "snooze_3"
  | "snooze_7";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

function refreshAll() {
  revalidatePath("/", "layout");
}

export async function quickAction(leadId: string, action: QuickAction): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, campaign_id, follow_up_status, postcard_sent_date")
    .eq("id", leadId)
    .single();
  if (error || !lead) return { error: error?.message ?? "Lead not found" };

  const current = lead.follow_up_status as FollowUpStatus;
  const today = todayISO();
  const patch: Partial<Lead> = {};
  let eventType: string | null = null;

  switch (action) {
    case "postcard_queued":
      patch.follow_up_status = advanceStatus(current, "Postcard queued");
      eventType = "postcard_queued";
      break;
    case "postcard_sent":
      patch.postcard_sent_date = lead.postcard_sent_date ?? today;
      patch.follow_up_status = advanceStatus(current, "Postcard sent");
      eventType = "postcard_sent";
      break;
    case "called":
      patch.call_status = "Called";
      patch.follow_up_status = advanceStatus(current, "Contacted");
      eventType = "call";
      break;
    case "texted":
      patch.text_status = "Texted";
      patch.follow_up_status = advanceStatus(current, "Contacted");
      eventType = "text";
      break;
    case "appointment_booked":
      patch.appointment_status = "Booked";
      patch.follow_up_status = advanceStatus(current, "Appointment booked");
      eventType = "appointment_booked";
      break;
    case "applied":
      patch.application_status = "Started";
      patch.follow_up_status = advanceStatus(current, "Applied");
      eventType = "application_started";
      break;
    case "funded":
      patch.funded_status = "Funded";
      patch.follow_up_status = "Funded";
      patch.next_follow_up_date = null;
      eventType = "funded";
      break;
    case "do_not_contact":
      patch.follow_up_status = "Do not contact";
      patch.next_follow_up_date = null;
      eventType = "do_not_contact";
      break;
    case "follow_up_done":
      patch.next_follow_up_date = null;
      eventType = "follow_up_completed";
      break;
    case "snooze_1":
      patch.next_follow_up_date = addDays(today, 1);
      break;
    case "snooze_3":
      patch.next_follow_up_date = addDays(today, 3);
      break;
    case "snooze_7":
      patch.next_follow_up_date = addDays(today, 7);
      break;
  }

  const { error: updateError } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (updateError) return { error: updateError.message };

  if (eventType) {
    await supabase.from("tracking_events").insert({
      lead_id: leadId,
      campaign_id: lead.campaign_id,
      event_type: eventType,
      event_source: "dashboard",
      metadata: { by: user.email, from_status: current, to_status: patch.follow_up_status ?? current },
    });
  }

  refreshAll();
  return {};
}

const nullable = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

/** Saves the status panel on the lead detail page. */
export async function updateLeadStatus(leadId: string, formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();

  const { data: before } = await supabase
    .from("leads")
    .select("follow_up_status, campaign_id")
    .eq("id", leadId)
    .single();

  const status = String(formData.get("follow_up_status") || "Not contacted") as FollowUpStatus;
  if (!FOLLOW_UP_STATUSES.includes(status)) return { error: "Invalid status" };

  const patch = {
    follow_up_status: status,
    call_status: nullable(formData.get("call_status")),
    text_status: nullable(formData.get("text_status")),
    appointment_status: nullable(formData.get("appointment_status")),
    application_status: nullable(formData.get("application_status")),
    funded_status: nullable(formData.get("funded_status")),
    next_follow_up_date: nullable(formData.get("next_follow_up_date")),
    postcard_sent_date: nullable(formData.get("postcard_sent_date")),
    campaign_id: nullable(formData.get("campaign_id")),
  };

  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) return { error: error.message };

  if (before && before.follow_up_status !== status) {
    await supabase.from("tracking_events").insert({
      lead_id: leadId,
      campaign_id: patch.campaign_id,
      event_type: "status_changed",
      event_source: "dashboard",
      metadata: { by: user.email, from_status: before.follow_up_status, to_status: status },
    });
  }

  refreshAll();
  return {};
}

/** Adds a dated note to the top of the lead's notes. */
export async function addNote(leadId: string, formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const text = String(formData.get("note") || "").trim();
  if (!text) return { error: "Note is empty" };

  const { data: lead } = await supabase.from("leads").select("notes, campaign_id").eq("id", leadId).single();
  const entry = `[${formatDate(todayISO())}] ${text}`;
  const notes = lead?.notes ? `${entry}\n${lead.notes}` : entry;

  const { error } = await supabase.from("leads").update({ notes }).eq("id", leadId);
  if (error) return { error: error.message };

  await supabase.from("tracking_events").insert({
    lead_id: leadId,
    campaign_id: lead?.campaign_id ?? null,
    event_type: "note_added",
    event_source: "dashboard",
    metadata: { by: user.email, note: text.slice(0, 500) },
  });

  refreshAll();
  return {};
}

/** Replaces the full notes field (the "edit all notes" box). */
export async function saveNotes(leadId: string, formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const { error } = await supabase.from("leads").update({ notes }).eq("id", leadId);
  if (error) return { error: error.message };
  refreshAll();
  return {};
}

// ---------------------------------------------------------------------
// V1.1 — safe deletion
// Both actions run the delete_leads() database function, which deletes
// the leads and their tracking events in ONE transaction and refuses to
// run unless the confirmation text is exactly "DELETE".
// ---------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DELETE = 5000;

export interface DeleteResult {
  error?: string;
  leadsDeleted?: number;
  eventsDeleted?: number;
}

/** Deletes exactly the lead IDs that were ticked on the Leads page. */
export async function deleteLeads(leadIds: string[], confirmText: string): Promise<DeleteResult> {
  if (confirmText !== "DELETE") return { error: "Type DELETE to confirm." };
  const { supabase } = await requireUser();

  const ids = Array.from(new Set((leadIds ?? []).filter((id) => typeof id === "string" && UUID_RE.test(id))));
  if (ids.length === 0) return { error: "No leads selected." };
  if (ids.length !== leadIds.length) return { error: "Selection contained invalid IDs. Nothing was deleted." };
  if (ids.length > MAX_DELETE) return { error: `Too many at once (max ${MAX_DELETE}).` };

  const { data, error } = await supabase.rpc("delete_leads", { p_lead_ids: ids, p_confirm: "DELETE" });
  if (error) return { error: error.message };

  refreshAll();
  const res = data as unknown as { leads_deleted: number; events_deleted: number };
  return { leadsDeleted: res.leads_deleted, eventsDeleted: res.events_deleted };
}

/**
 * Deletes every lead matching the Leads page's CURRENT filters.
 * Safety:
 *  - at least one narrowing filter is required (never "everything");
 *  - the server re-runs the exact same filter and refuses if the number
 *    of matches differs from the number the user saw and confirmed.
 */
export async function deleteFilteredLeads(
  rawFilters: Record<string, unknown>,
  expectedCount: number,
  confirmText: string
): Promise<DeleteResult> {
  if (confirmText !== "DELETE") return { error: "Type DELETE to confirm." };
  const { supabase } = await requireUser();

  const filters = pickFilters(rawFilters ?? {});
  if (!hasNarrowingFilter(filters)) {
    return { error: "Add at least one filter first. Deleting the whole database is not allowed from here." };
  }

  const { data: campData, error: campError } = await supabase.from("campaigns").select("id, archived_at");
  if (campError) return { error: campError.message };
  const archivedIds = ((campData ?? []) as unknown as Pick<Campaign, "id" | "archived_at">[])
    .filter((c) => c.archived_at)
    .map((c) => c.id);

  const ids: string[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const base = supabase.from("leads").select("id");
    const { data, error } = await applyLeadFilters(base, filters, todayISO(), archivedIds)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { error: error.message };
    const rows = (data ?? []) as unknown as { id: string }[];
    ids.push(...rows.map((r) => r.id));
    if (rows.length < PAGE) break;
    if (ids.length > MAX_DELETE) return { error: `More than ${MAX_DELETE} leads match. Narrow the filters.` };
  }

  if (ids.length !== expectedCount) {
    return {
      error: `The number of matching leads changed (you confirmed ${expectedCount}, now ${ids.length}). Nothing was deleted — reload the page and review again.`,
    };
  }
  if (ids.length === 0) return { error: "No leads match these filters." };

  const { data, error } = await supabase.rpc("delete_leads", { p_lead_ids: ids, p_confirm: "DELETE" });
  if (error) return { error: error.message };

  refreshAll();
  const res = data as unknown as { leads_deleted: number; events_deleted: number };
  return { leadsDeleted: res.leads_deleted, eventsDeleted: res.events_deleted };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayISO } from "@/lib/format";
import { canFetchSingle, getPropertyImageProvider, shouldAutoFetch } from "@/lib/property-images/provider";
import { removePropertyImage, storePropertyImage } from "@/lib/property-images/storage";

/**
 * V1.3 — automatic property image fetch (Nearmap first).
 *
 * Rules enforced here AND in the database:
 *  - an APPROVED image is never touched (checked before any credits are spent,
 *    and set_property_image() refuses it again at save time);
 *  - fetched images always land as "needs_review" — never auto-approved;
 *  - bulk mode works on ONE campaign and only fills leads with status "missing";
 *  - "no imagery" / failures are written to the lead's image notes.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BULK_FETCH = 250; // per run; "use server" files may only export async functions

export type FetchOutcome = "success" | "no_imagery" | "failed" | "skipped_approved" | "skipped_has_image";

export interface FetchLeadResult {
  outcome: FetchOutcome;
  message: string;
  leadCode?: string;
  /** Stop the bulk run (bad key, no access, signed out…). */
  fatal?: boolean;
}

interface LeadRow {
  id: string;
  lead_code: string;
  campaign_id: string | null;
  property_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_image_status: string;
  property_image_notes: string | null;
}

async function getUserClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

function withNote(existing: string | null, line: string): string {
  const entry = `[${formatDate(todayISO())}] ${line}`;
  return (existing ? `${entry}\n${existing}` : entry).slice(0, 2000);
}

/**
 * Fetch one lead's image.
 *   mode "single": user clicked Fetch on one lead — allowed unless approved.
 *   mode "bulk":   part of a campaign run — lead must be in `campaignId` and "missing".
 */
export async function fetchLeadImage(
  leadId: string,
  opts: { mode: "single" | "bulk"; campaignId?: string }
): Promise<FetchLeadResult> {
  if (!UUID_RE.test(leadId)) return { outcome: "failed", message: "Invalid lead" };
  const supabase = await getUserClient();
  if (!supabase) return { outcome: "failed", message: "You're signed out. Sign in again.", fatal: true };

  const provider = getPropertyImageProvider();
  if (!provider) return { outcome: "failed", message: "Image provider not connected", fatal: true };

  const { data, error } = await supabase
    .from("leads")
    .select("id, lead_code, campaign_id, property_address, city, state, zip, property_image_status, property_image_notes")
    .eq("id", leadId)
    .maybeSingle();
  if (error) return { outcome: "failed", message: error.message };
  if (!data) return { outcome: "failed", message: "Lead not found (it may have been deleted)" };
  const lead = data as unknown as LeadRow;
  const base = { leadCode: lead.lead_code };

  // --- scope + approval checks BEFORE spending any credits ---------------
  if (opts.mode === "bulk") {
    if (!opts.campaignId || !UUID_RE.test(opts.campaignId) || lead.campaign_id !== opts.campaignId) {
      return { ...base, outcome: "failed", message: "Lead is not in the selected campaign — not fetched" };
    }
  }
  if (lead.property_image_status === "approved" || !canFetchSingle(lead.property_image_status)) {
    return { ...base, outcome: "skipped_approved", message: "Already approved — left untouched" };
  }
  if (opts.mode === "bulk" && !shouldAutoFetch(lead.property_image_status)) {
    return { ...base, outcome: "skipped_has_image", message: "Already has an image — left untouched" };
  }

  const finish = (r: FetchLeadResult) => {
    if (opts.mode === "single") {
      revalidatePath(`/leads/${leadId}`);
      revalidatePath("/property-images");
      revalidatePath("/campaigns");
      revalidatePath("/leads");
    }
    return r;
  };

  const saveNote = async (line: string) => {
    await supabase.rpc("set_property_image", {
      p_lead_id: leadId,
      p_action: "notes",
      p_notes: withNote(lead.property_image_notes, line),
    });
  };

  // --- call the provider (server only) -----------------------------------
  const result = await provider.fetchImage({
    street: lead.property_address ?? "",
    city: lead.city,
    state: lead.state,
    zip: lead.zip,
    country: "US",
  });

  if (result.kind === "not_found") {
    await saveNote(`${provider.name}: ${result.reason}`);
    return finish({ ...base, outcome: "no_imagery", message: result.reason });
  }
  if (result.kind === "error") {
    if (!result.fatal) await saveNote(`${provider.name} fetch failed: ${result.reason}`);
    return finish({ ...base, outcome: "failed", message: result.reason, fatal: result.fatal });
  }

  // --- store in our bucket, then save as needs_review --------------------
  let stored: Awaited<ReturnType<typeof storePropertyImage>>;
  try {
    stored = await storePropertyImage(leadId, result.bytes, result.contentType, result.extension, result.source);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "storage error";
    return finish({ ...base, outcome: "failed", message: `Couldn't save the image: ${msg}`, fatal: /SUPABASE_SERVICE_ROLE_KEY/.test(msg) });
  }
  if ("error" in stored) {
    await saveNote(`${provider.name} image downloaded but couldn't be stored: ${stored.error}`);
    return finish({ ...base, outcome: "failed", message: `Couldn't save the image: ${stored.error}` });
  }

  const { error: saveError } = await supabase.rpc("set_property_image", {
    p_lead_id: leadId,
    p_action: "set_url",
    p_url: stored.url,
    p_source: result.source,
    p_notes: withNote(lead.property_image_notes, result.note),
    p_replace_approved: false, // never — the database refuses approved images
  });
  if (saveError) {
    await removePropertyImage(stored.path);
    if (/approved/i.test(saveError.message)) {
      return finish({ ...base, outcome: "skipped_approved", message: "Was approved while fetching — left untouched" });
    }
    return finish({ ...base, outcome: "failed", message: saveError.message });
  }

  return finish({ ...base, outcome: "success", message: result.note });
}

/**
 * Lists the leads a bulk run will process: ONE campaign, status "missing" only.
 */
export async function listMissingImageLeads(
  campaignId: string
): Promise<{ error?: string; campaignName?: string; leads?: { id: string; lead_code: string }[]; total?: number }> {
  if (!UUID_RE.test(campaignId)) return { error: "Pick one campaign first." };
  const supabase = await getUserClient();
  if (!supabase) return { error: "You're signed out. Sign in again." };
  if (!getPropertyImageProvider()) return { error: "Image provider not connected" };

  const { data: campaign, error: cErr } = await supabase.from("campaigns").select("id, name").eq("id", campaignId).maybeSingle();
  if (cErr) return { error: cErr.message };
  if (!campaign) return { error: "Campaign not found" };

  const { data, error, count } = await supabase
    .from("leads")
    .select("id, lead_code", { count: "exact" })
    .eq("campaign_id", campaignId)
    .eq("property_image_status", "missing")
    .order("lead_code", { ascending: true })
    .limit(MAX_BULK_FETCH);
  if (error) return { error: error.message };

  return {
    campaignName: (campaign as { name: string }).name,
    leads: (data ?? []) as unknown as { id: string; lead_code: string }[],
    total: count ?? 0,
  };
}

/** Called once when a bulk run ends, so pages show the new images. */
export async function refreshAfterBulkFetch(): Promise<void> {
  revalidatePath("/property-images");
  revalidatePath("/campaigns");
  revalidatePath("/leads");
}

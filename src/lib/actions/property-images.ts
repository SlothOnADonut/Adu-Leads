"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * All property-image changes go through the set_property_image() database
 * function, which enforces the rules:
 *  - a new URL always lands as "needs_review";
 *  - an APPROVED image is never replaced/cleared unless replaceApproved = true
 *    (the user ticked "Replace approved image");
 *  - approve / needs review require an image URL.
 * Nothing here touches notes, outreach status, scans or follow-ups.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "property-images";
const MAX_BYTES = 4 * 1024 * 1024; // keep under the 5 MB server-action limit
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export interface ImageActionResult {
  error?: string;
  status?: string;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

function refresh(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/campaigns");
  revalidatePath("/property-images");
}

async function callSetImage(
  leadId: string,
  action: "set_url" | "approve" | "reject" | "needs_review" | "clear" | "notes",
  opts: { url?: string | null; source?: string | null; notes?: string | null; replaceApproved?: boolean } = {}
): Promise<ImageActionResult> {
  if (!UUID_RE.test(leadId)) return { error: "Invalid lead" };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("set_property_image", {
    p_lead_id: leadId,
    p_action: action,
    p_url: opts.url ?? null,
    p_source: opts.source ?? null,
    p_notes: opts.notes ?? null,
    p_replace_approved: opts.replaceApproved ?? false,
  });
  if (error) return { error: error.message };
  refresh(leadId);
  return { status: (data as unknown as { status: string }).status };
}

export async function setImageStatus(
  leadId: string,
  status: "approve" | "reject" | "needs_review",
  notes?: string
): Promise<ImageActionResult> {
  return callSetImage(leadId, status, { notes: notes ?? null });
}

/** Paste an image URL. Saved as source "manual", status "needs_review". */
export async function setImageUrl(
  leadId: string,
  url: string,
  replaceApproved: boolean,
  notes?: string
): Promise<ImageActionResult> {
  const clean = (url ?? "").trim();
  try {
    const u = new URL(clean);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
  } catch {
    return { error: "Paste a full image link starting with https://" };
  }
  return callSetImage(leadId, "set_url", { url: clean, source: "manual", notes: notes ?? null, replaceApproved });
}

export async function saveImageNotes(leadId: string, notes: string): Promise<ImageActionResult> {
  return callSetImage(leadId, "notes", { notes });
}

export async function clearImage(leadId: string, replaceApproved: boolean): Promise<ImageActionResult> {
  return callSetImage(leadId, "clear", { replaceApproved });
}

/**
 * Upload a photo from the computer. Stored in the "property-images" bucket
 * under a random file name, then saved like a pasted URL (source "upload",
 * status "needs_review"). The service key is used only here, on the server,
 * after confirming the user is signed in.
 */
export async function uploadImage(leadId: string, formData: FormData): Promise<ImageActionResult> {
  if (!UUID_RE.test(leadId)) return { error: "Invalid lead" };
  const { supabase } = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
  const ext = TYPES[file.type];
  if (!ext) return { error: "Use a JPG, PNG or WebP image." };
  if (file.size > MAX_BYTES) return { error: "Photo is larger than 4 MB. Please resize it and try again." };
  const replaceApproved = formData.get("replace_approved") === "on";

  // Check the approval lock BEFORE uploading, so we don't store orphan files.
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("property_image_status")
    .eq("id", leadId)
    .single();
  if (leadError || !lead) return { error: leadError?.message ?? "Lead not found" };
  if ((lead as { property_image_status: string }).property_image_status === "approved" && !replaceApproved) {
    return { error: "This lead already has an approved image. Tick “Replace approved image” to change it." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Uploads need SUPABASE_SERVICE_ROLE_KEY on the server." };
  }

  const path = `${leadId}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  let { error: upError } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
  if (upError && /bucket not found/i.test(upError.message)) {
    const { error: bucketError } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: Object.keys(TYPES),
    });
    if (bucketError && !/already exists/i.test(bucketError.message)) return { error: bucketError.message };
    ({ error: upError } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false }));
  }
  if (upError) return { error: upError.message };

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const res = await callSetImage(leadId, "set_url", { url: pub.publicUrl, source: "upload", replaceApproved });
  if (res.error) {
    await admin.storage.from(BUCKET).remove([path]); // don't leave an unused file behind
  }
  return res;
}

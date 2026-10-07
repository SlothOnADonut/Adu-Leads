"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Postcard approval — always a deliberate click by a signed-in person.
 * The database (approve_postcard) refuses unless the property image is
 * Approved, and refuses if the image changed since the preview was loaded.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function run(leadId: string, action: "approve" | "unapprove", expectedImageUrl: string | null) {
  if (!UUID_RE.test(leadId)) return { error: "Invalid lead" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in again." };

  const { data, error } = await supabase.rpc("approve_postcard", {
    p_lead_id: leadId,
    p_action: action,
    p_expected_image_url: expectedImageUrl,
  });
  if (error) return { error: error.message };

  revalidatePath("/postcards");
  revalidatePath(`/postcards/${leadId}`);
  revalidatePath(`/leads/${leadId}`);
  return { status: (data as unknown as { postcard_status: string }).postcard_status };
}

export async function approvePostcard(leadId: string, expectedImageUrl: string): Promise<{ error?: string; status?: string }> {
  if (!expectedImageUrl) return { error: "Missing image reference — reload the preview." };
  return run(leadId, "approve", expectedImageUrl);
}

export async function unapprovePostcard(leadId: string): Promise<{ error?: string; status?: string }> {
  return run(leadId, "unapprove", null);
}

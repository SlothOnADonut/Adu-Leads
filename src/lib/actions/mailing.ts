"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Saves a lead's postcard mailing information (V1.5).
 * The database rebuilds the combined mailing_address text, recalculates
 * mailing_complete, and — if the postcard was approved and any printed
 * mailing detail changed — sends it back to "ready" for re-approval.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateMailingInfo(leadId: string, formData: FormData): Promise<{ error?: string }> {
  if (!UUID_RE.test(leadId)) return { error: "Invalid lead" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in again." };

  const v = (k: string) => {
    const s = String(formData.get(k) ?? "").trim().replace(/\s+/g, " ");
    return s === "" ? null : s.slice(0, 200);
  };
  const mailing_name = v("mailing_name");
  const mailing_street = v("mailing_street");
  const mailing_city = v("mailing_city");
  const mailing_state = v("mailing_state")?.toUpperCase() ?? null;
  const mailing_zip = v("mailing_zip");

  if (mailing_state && !/^[A-Z]{2}$/.test(mailing_state)) return { error: "State must be the 2-letter code, e.g. CA." };
  if (mailing_zip && !/^\d{5}(-?\d{4})?$/.test(mailing_zip)) return { error: "ZIP must be 5 digits (or ZIP+4, e.g. 92801-1234)." };
  if (mailing_street && /,/.test(mailing_street) && /\b[A-Z]{2}\s+\d{5}\b/.test(mailing_street)) {
    return { error: "Put only the street in Street — city, state and ZIP have their own boxes." };
  }

  const { error } = await supabase
    .from("leads")
    .update({ mailing_name, mailing_street, mailing_city, mailing_state, mailing_zip })
    .eq("id", leadId);
  if (error) return { error: error.message };

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/postcards/${leadId}`);
  revalidatePath("/postcards");
  revalidatePath("/leads");
  return {};
}

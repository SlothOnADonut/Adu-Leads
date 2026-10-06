import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. SERVER ONLY — bypasses RLS.
 * Used exclusively by the public tracking route to call the
 * record_lead_visit / record_lead_cta database functions.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

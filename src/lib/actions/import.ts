"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ImportLeadRow } from "@/lib/types";

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  error?: string;
}

const CHUNK = 250;

/**
 * Sends cleaned rows to the import_leads() database function in chunks.
 * New APN + permit combos are inserted (and get a lead code automatically).
 * Existing ones only get permit/enrichment fields refreshed.
 */
export async function importLeads(rows: ImportLeadRow[], campaignId: string | null): Promise<ImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { inserted: 0, updated: 0, skipped: 0, error: "Not signed in" };

  const total: ImportResult = { inserted: 0, updated: 0, skipped: 0 };

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await supabase.rpc("import_leads", {
      p_rows: chunk,
      p_campaign_id: campaignId || null,
    });
    if (error) {
      revalidatePath("/", "layout");
      return {
        ...total,
        error: `Stopped at row ${i + 1}: ${error.message}. Rows before this were saved.`,
      };
    }
    const result = data as { inserted: number; updated: number; skipped: number };
    total.inserted += result.inserted;
    total.updated += result.updated;
    total.skipped += result.skipped;
  }

  revalidatePath("/", "layout");
  return total;
}

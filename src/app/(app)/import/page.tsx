import { createClient } from "@/lib/supabase/server";
import { fetchCampaigns } from "@/lib/data";
import ImportWizard from "./ImportWizard";

export const metadata = { title: "Import · ADU Lead Tracker" };

export default async function ImportPage() {
  const supabase = await createClient();
  const campaigns = await fetchCampaigns(supabase);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Import leads</h1>
        <p className="mt-1 max-w-2xl text-sm text-charcoal-light">
          Upload a CSV, match its columns, preview, then import. New leads get a code automatically (ANA-0001…).
          Re-importing the same APN + permit number only refreshes permit and enrichment data — your notes,
          statuses, follow-up dates and scan history are never overwritten.
        </p>
      </div>
      <ImportWizard campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, city: c.city }))} />
    </div>
  );
}

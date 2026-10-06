import { createClient } from "@/lib/supabase/server";
import { campaignStats, fetchAllLeads, fetchCampaigns, LEAD_LIST_COLUMNS } from "@/lib/data";
import { formatDate, formatPercent, todayISO } from "@/lib/format";
import CampaignForm from "./CampaignForm";
import CampaignRowActions from "./CampaignRowActions";

export const metadata = { title: "Campaigns · ADU Lead Tracker" };

export default async function CampaignsPage() {
  const supabase = await createClient();
  const [campaigns, leads] = await Promise.all([fetchCampaigns(supabase), fetchAllLeads(supabase, LEAD_LIST_COLUMNS)]);
  const rows = campaignStats(campaigns, leads);
  const today = todayISO();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Campaigns</h1>
        <p className="mt-1 text-sm text-charcoal-light">Each mail drop is a campaign. Rates are based on postcards sent.</p>
      </div>

      <div className="space-y-4">
        {rows.length === 0 && (
          <div className="card px-5 py-10 text-center text-sm text-charcoal-light">No campaigns yet — create one below.</div>
        )}
        {rows.map((c) => (
          <section key={c.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-200 px-5 py-4">
              <div>
                <h2 className="font-serif text-lg font-semibold text-forest-900">{c.name}</h2>
                <p className="text-xs text-charcoal-light">
                  {[c.city, c.vertical].filter(Boolean).join(" · ")}
                  {c.sent_date ? ` · Sent ${formatDate(c.sent_date)}` : ""}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-cream-100 px-2.5 py-1 text-charcoal-light">Postcard: <b className="text-charcoal">{c.postcard_version || "—"}</b></span>
                <span className="rounded-full bg-cream-100 px-2.5 py-1 text-charcoal-light">Landing: <b className="text-charcoal">{c.landing_page_version || "—"}</b></span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px bg-cream-200 sm:grid-cols-4 lg:grid-cols-8">
              {[
                ["Leads", c.stats.total],
                ["Sent", c.stats.sent],
                ["Scans", c.stats.scans],
                ["Scanners", c.stats.uniqueScanners],
                ["Scan rate", formatPercent(c.stats.scanRate)],
                ["Appointments", c.stats.appointments],
                ["Applications", c.stats.applications],
                ["Funded", c.stats.funded],
              ].map(([label, value]) => (
                <div key={label as string} className="bg-white px-4 py-3">
                  <div className="text-[11px] font-medium tracking-wide text-charcoal-light uppercase">{label}</div>
                  <div className="font-serif text-xl font-semibold tabular-nums text-forest-900">{value}</div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3">
              {c.notes && <p className="mb-2 text-sm text-charcoal-light">{c.notes}</p>}
              <CampaignRowActions campaign={c} today={today} />
            </div>
          </section>
        ))}
      </div>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">New campaign</h2>
        </div>
        <div className="p-5">
          <CampaignForm />
        </div>
      </section>
    </div>
  );
}

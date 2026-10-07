import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { campaignStats, fetchAllLeads, fetchCampaigns, LEAD_LIST_COLUMNS } from "@/lib/data";
import { formatDate, formatPercent, todayISO } from "@/lib/format";
import CampaignForm from "./CampaignForm";
import CampaignRowActions from "./CampaignRowActions";
import { PROPERTY_IMAGE_STATUS_LABELS, type PropertyImageStatus } from "@/lib/property-images/types";

/** Image counts per campaign: the everyday four, plus any others that exist. */
function imageCounts(leads: { property_image_status: PropertyImageStatus; postcard_image_ready: boolean }[]) {
  const by: Partial<Record<PropertyImageStatus, number>> = {};
  for (const l of leads) by[l.property_image_status] = (by[l.property_image_status] ?? 0) + 1;
  const ready = leads.filter((l) => l.postcard_image_ready).length;
  return { by, ready, total: leads.length };
}

const SUMMARY_ORDER: PropertyImageStatus[] = ["approved", "needs_review", "missing", "rejected", "fetched", "manual"];

export const metadata = { title: "Campaigns · ADU Lead Tracker" };

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const showArchived = view === "archived";
  const supabase = await createClient();
  const [campaigns, leads] = await Promise.all([fetchCampaigns(supabase), fetchAllLeads(supabase, LEAD_LIST_COLUMNS)]);
  const archivedCount = campaigns.filter((c) => c.archived_at).length;
  const visible = campaigns.filter((c) => (showArchived ? !!c.archived_at : !c.archived_at));
  const rows = campaignStats(visible, leads);
  const today = todayISO();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{showArchived ? "Archived campaigns" : "Campaigns"}</h1>
          <p className="mt-1 text-sm text-charcoal-light">
            {showArchived
              ? "Hidden from normal views. All leads, scans and notes are kept — restore any time."
              : "Each mail drop is a campaign. Rates are based on postcards sent."}
          </p>
        </div>
        <div className="flex rounded-lg border border-cream-300 bg-white p-0.5 text-sm">
          <Link href="/campaigns" className={`rounded-md px-3 py-1.5 ${!showArchived ? "bg-forest-700 text-white" : "text-charcoal-light hover:text-charcoal"}`}>
            Active
          </Link>
          <Link href="/campaigns?view=archived" className={`rounded-md px-3 py-1.5 ${showArchived ? "bg-forest-700 text-white" : "text-charcoal-light hover:text-charcoal"}`}>
            Archived ({archivedCount})
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {rows.length === 0 && (
          <div className="card px-5 py-10 text-center text-sm text-charcoal-light">
            {showArchived ? "No archived campaigns." : "No active campaigns — create one below."}
          </div>
        )}
        {rows.map((c) => (
          <section key={c.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-200 px-5 py-4">
              <div>
                <h2 className="font-serif text-lg font-semibold text-forest-900">
                  {c.name}
                  {c.archived_at && (
                    <span className="ml-2 align-middle rounded-full bg-cream-200 px-2 py-0.5 font-sans text-xs font-medium text-charcoal-light">
                      Archived {formatDate(c.archived_at.slice(0, 10))}
                    </span>
                  )}
                </h2>
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
              {(() => {
                const img = imageCounts(leads.filter((l) => l.campaign_id === c.id));
                const pct = img.total > 0 ? Math.round((img.ready / img.total) * 100) : 0;
                return (
                  <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-cream-100/60 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs font-medium tracking-wide text-charcoal-light uppercase">Property images</span>
                      {SUMMARY_ORDER.filter((st) => st === "approved" || st === "needs_review" || st === "missing" || (img.by[st] ?? 0) > 0).map((st) => (
                        <Link
                          key={st}
                          href={`/leads?campaign=${c.id}&img=${st}`}
                          className="tabular-nums text-charcoal hover:text-forest-700 hover:underline"
                        >
                          <b>{img.by[st] ?? 0}</b> {PROPERTY_IMAGE_STATUS_LABELS[st].toLowerCase()}
                        </Link>
                      ))}
                      <Link href={`/property-images?campaign=${c.id}`} className="text-xs font-medium text-forest-600 hover:underline">
                        Review →
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium tracking-wide text-charcoal-light uppercase">Postcard image readiness</span>
                      <Link href={`/leads?campaign=${c.id}&img=approved`} className="tabular-nums hover:underline">
                        <b>{img.ready}</b> / {img.total} ready
                      </Link>
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-cream-200" aria-hidden>
                        <span className="block h-full rounded-full bg-forest-500" style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  </div>
                );
              })()}
              {c.notes && <p className="mb-2 text-sm text-charcoal-light">{c.notes}</p>}
              <CampaignRowActions campaign={c} today={today} />
            </div>
          </section>
        ))}
      </div>

      {!showArchived && (
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">New campaign</h2>
        </div>
        <div className="p-5">
          <CampaignForm />
        </div>
      </section>
      )}
    </div>
  );
}

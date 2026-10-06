import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { campaignStats, fetchAllLeads, fetchCampaigns, LEAD_LIST_COLUMNS } from "@/lib/data";
import { reached, summarize } from "@/lib/metrics";
import { formatDate, formatPercent, fullPropertyAddress, ownerName, timeAgo, todayISO } from "@/lib/format";
import StatCard from "@/components/StatCard";
import StatusBadge, { ScoreBadge } from "@/components/StatusBadge";
import QuickActions from "@/components/QuickActions";
import { FOLLOW_UP_ACTIONS } from "@/lib/quick-actions";
import type { Lead } from "@/lib/types";

export const metadata = { title: "Dashboard · ADU Lead Tracker" };

interface ScanRow {
  id: string;
  created_at: string;
  lead: Pick<Lead, "id" | "lead_code" | "first_name" | "last_name" | "owner_name_raw" | "property_address" | "city" | "state" | "zip" | "follow_up_status"> | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [leads, campaigns, scansRes] = await Promise.all([
    fetchAllLeads(supabase, LEAD_LIST_COLUMNS),
    fetchCampaigns(supabase),
    supabase
      .from("tracking_events")
      .select(
        "id, created_at, lead:leads(id, lead_code, first_name, last_name, owner_name_raw, property_address, city, state, zip, follow_up_status)"
      )
      .eq("event_type", "qr_scan")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const recentScans = (scansRes.data ?? []) as unknown as ScanRow[];
  const s = summarize(leads);
  const today = todayISO();

  const active = leads.filter((l) => l.follow_up_status !== "Do not contact" && l.follow_up_status !== "Funded");
  const needsFollowUp = active
    .filter(
      (l) =>
        (l.next_follow_up_date && l.next_follow_up_date <= today) ||
        (reached(l, "scanned") && !reached(l, "contacted"))
    )
    .sort(
      (a, b) =>
        (a.next_follow_up_date ?? "9999").localeCompare(b.next_follow_up_date ?? "9999") ||
        (b.final_priority_score ?? 0) - (a.final_priority_score ?? 0)
    )
    .slice(0, 8);

  const perCampaign = campaignStats(campaigns, leads);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-1 text-sm text-charcoal-light">ADU → HELOC direct-mail performance</p>
        </div>
        <div className="flex gap-2">
          <Link href="/import" className="btn-secondary">Import leads</Link>
          <Link href="/follow-ups" className="btn-primary">Follow-ups</Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total leads" value={s.total} />
        <StatCard label="Postcards sent" value={s.sent} />
        <StatCard label="QR scans" value={s.scans} hint="Total scans" />
        <StatCard label="Unique scanners" value={s.uniqueScanners} accent />
        <StatCard label="Appointments" value={s.appointments} />
        <StatCard label="Applications" value={s.applications} />
        <StatCard label="Funded" value={s.funded} accent />
        <StatCard label="Scan rate" value={formatPercent(s.scanRate)} hint="Scanners ÷ sent" />
        <StatCard label="Appointment rate" value={formatPercent(s.appointmentRate)} hint="Appointments ÷ sent" />
        <StatCard label="Application rate" value={formatPercent(s.applicationRate)} hint="Applications ÷ sent" />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <div className="card-header">
            <h2 className="card-title">Leads needing follow-up</h2>
            <Link href="/follow-ups" className="text-xs font-medium text-forest-600 hover:underline">View all →</Link>
          </div>
          {needsFollowUp.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-charcoal-light">Nothing due. Nice work.</p>
          ) : (
            <ul className="divide-y divide-cream-100">
              {needsFollowUp.map((l) => (
                <li key={l.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/leads/${l.id}`} className="font-medium text-forest-800 hover:underline">
                        {ownerName(l)}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-charcoal-light">{l.lead_code}</span>
                      <div className="truncate text-xs text-charcoal-light">{fullPropertyAddress(l)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={l.final_priority_score} />
                      <StatusBadge status={l.follow_up_status} />
                    </div>
                  </div>
                  <div className="mt-1 mb-2 text-xs text-charcoal-light">
                    {l.next_follow_up_date ? (
                      <span className={l.next_follow_up_date < today ? "font-medium text-red-700" : ""}>
                        Follow up {l.next_follow_up_date < today ? "was due" : "due"} {formatDate(l.next_follow_up_date)}
                      </span>
                    ) : (
                      <span>Scanned {timeAgo(l.last_qr_scan_at)} · not contacted yet</span>
                    )}
                  </div>
                  <QuickActions leadId={l.id} actions={FOLLOW_UP_ACTIONS} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">Recent QR scans</h2>
          </div>
          {recentScans.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-charcoal-light">No scans yet.</p>
          ) : (
            <ul className="divide-y divide-cream-100">
              {recentScans.map((e) =>
                e.lead ? (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link href={`/leads/${e.lead.id}`} className="text-sm font-medium text-forest-800 hover:underline">
                        {ownerName(e.lead)}
                      </Link>
                      <div className="truncate text-xs text-charcoal-light">
                        {e.lead.lead_code} · {e.lead.property_address ?? "—"}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-charcoal-light">{timeAgo(e.created_at)}</span>
                  </li>
                ) : null
              )}
            </ul>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="card-header">
          <h2 className="card-title">Campaign performance</h2>
          <Link href="/campaigns" className="text-xs font-medium text-forest-600 hover:underline">Manage →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Campaign</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Sent</th>
                <th className="text-right">Scanners</th>
                <th className="text-right">Scan rate</th>
                <th className="text-right">Appts</th>
                <th className="text-right">Apps</th>
                <th className="text-right">Funded</th>
              </tr>
            </thead>
            <tbody>
              {perCampaign.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-charcoal-light">No campaigns yet.</td>
                </tr>
              )}
              {perCampaign.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/leads?campaign=${c.id}`} className="font-medium text-forest-800 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{c.stats.total}</td>
                  <td className="text-right tabular-nums">{c.stats.sent}</td>
                  <td className="text-right tabular-nums">{c.stats.uniqueScanners}</td>
                  <td className="text-right tabular-nums">{formatPercent(c.stats.scanRate)}</td>
                  <td className="text-right tabular-nums">{c.stats.appointments}</td>
                  <td className="text-right tabular-nums">{c.stats.applications}</td>
                  <td className="text-right tabular-nums">{c.stats.funded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

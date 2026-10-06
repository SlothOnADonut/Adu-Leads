import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { campaignOptions, fetchCampaigns, LEAD_LIST_COLUMNS } from "@/lib/data";
import { FOLLOW_UP_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate, ownerName, timeAgo, todayISO } from "@/lib/format";
import { applyLeadFilters, describeFilters, hasNarrowingFilter, pickFilters, type LeadFilterParams } from "@/lib/lead-filters";
import { BulkBar, RowCheckbox, SelectAllCheckbox, SelectionProvider } from "./LeadSelection";
import StatusBadge, { ScoreBadge } from "@/components/StatusBadge";
import type { Lead } from "@/lib/types";

export const metadata = { title: "Leads · ADU Lead Tracker" };

type Params = LeadFilterParams & { sort?: string; dir?: string };

const ROW_LIMIT = 2000;

const SORTS: Record<string, { column: string; label: string }> = {
  priority: { column: "final_priority_score", label: "Priority" },
  recency: { column: "permit_issue_date", label: "Permit date" },
  valuation: { column: "job_valuation", label: "Job value" },
  scans: { column: "qr_scan_count", label: "QR scans" },
  activity: { column: "last_activity_at", label: "Last activity" },
  code: { column: "lead_code", label: "Lead code" },
  followup: { column: "next_follow_up_date", label: "Next follow-up" },
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayISO();

  const sortKey = params.sort && SORTS[params.sort] ? params.sort : "priority";
  const ascending = params.dir === "asc" || (!params.dir && (sortKey === "code" || sortKey === "followup"));

  const filters = pickFilters(params as Record<string, unknown>);
  const campaigns = await fetchCampaigns(supabase);
  const archivedIds = campaigns.filter((c) => c.archived_at).map((c) => c.id);

  // Same filter function the "Delete all filtered leads" action uses.
  const query = applyLeadFilters(
    supabase.from("leads").select(LEAD_LIST_COLUMNS, { count: "exact" }),
    filters,
    today,
    archivedIds
  )
    .order(SORTS[sortKey].column, { ascending, nullsFirst: false })
    .order("lead_code", { ascending: true })
    .limit(ROW_LIMIT);

  const [{ data, count, error }, citiesRes] = await Promise.all([
    query,
    supabase.from("leads").select("city").not("city", "is", null).limit(5000),
  ]);

  const leads = (data ?? []) as unknown as Lead[];
  const cities = Array.from(
    new Set(((citiesRes.data ?? []) as unknown as { city: string }[]).map((r) => r.city))
  ).sort();
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));

  const sortHref = (key: string) => {
    const next = new URLSearchParams(params as Record<string, string>);
    const isCurrent = sortKey === key;
    next.set("sort", key);
    next.set("dir", isCurrent ? (ascending ? "desc" : "asc") : key === "code" || key === "followup" ? "asc" : "desc");
    return `/leads?${next.toString()}`;
  };
  const SortTh = ({ k, children, right }: { k: string; children: React.ReactNode; right?: boolean }) => (
    <th className={right ? "text-right" : ""}>
      <Link href={sortHref(k)} className="inline-flex items-center gap-1 hover:text-forest-700">
        {children}
        {sortKey === k && <span className="text-gold">{ascending ? "↑" : "↓"}</span>}
      </Link>
    </th>
  );

  const hasFilters = Object.keys(filters).length > 0;
  const narrowing = hasNarrowingFilter(filters);
  const total = count ?? leads.length;
  const filterKey = JSON.stringify(filters);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="mt-1 text-sm text-charcoal-light">
            {total} lead{total === 1 ? "" : "s"}
            {narrowing ? " match your filters" : ""}
            {total > leads.length ? ` · showing first ${leads.length}` : ""}
          </p>
        </div>
        <Link href="/import" className="btn-primary">Import CSV</Link>
      </div>

      <form method="get" className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 sm:col-span-3 lg:col-span-2">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Name, address, APN, permit, code" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="campaign">Campaign</label>
          <select id="campaign" name="campaign" defaultValue={params.campaign ?? ""} className="input">
            <option value="">All</option>
            {campaignOptions(campaigns, params.campaign).map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.archived_at ? " (archived)" : ""}</option>
            ))}
            <option value="none">No campaign</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="city">City</label>
          <select id="city" name="city" defaultValue={params.city ?? ""} className="input">
            <option value="">All</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={params.status ?? ""} className="input">
            <option value="">All</option>
            {FOLLOW_UP_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="min">Min priority</label>
          <select id="min" name="min" defaultValue={params.min ?? ""} className="input">
            <option value="">Any</option>
            <option value="80">80+</option>
            <option value="60">60+</option>
            <option value="40">40+</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="scanned">Scanned</label>
          <select id="scanned" name="scanned" defaultValue={params.scanned ?? ""} className="input">
            <option value="">Any</option>
            <option value="yes">Scanned</option>
            <option value="no">Not scanned</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sent">Postcard</label>
          <select id="sent" name="sent" defaultValue={params.sent ?? ""} className="input">
            <option value="">Any</option>
            <option value="yes">Sent</option>
            <option value="no">Not sent</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="due">Follow-up</label>
          <select id="due" name="due" defaultValue={params.due ?? ""} className="input">
            <option value="">Any</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="due">Due or overdue</option>
            <option value="week">Due within 7 days</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mailing">Occupancy</label>
          <select id="mailing" name="mailing" defaultValue={params.mailing ?? ""} className="input">
            <option value="">Any</option>
            <option value="same">Likely owner-occupied</option>
            <option value="different">Different mailing address</option>
          </select>
        </div>
        {archivedIds.length > 0 && (
          <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-sm text-charcoal-light sm:col-span-1">
            <input type="checkbox" name="archived" value="1" defaultChecked={params.archived === "1"} className="h-4 w-4 accent-forest-700" />
            Include archived campaigns
          </label>
        )}
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={ascending ? "asc" : "desc"} />
        <div className="col-span-2 flex items-end gap-2 sm:col-span-1 lg:col-span-2">
          <button type="submit" className="btn-primary">Apply</button>
          {hasFilters && <Link href="/leads" className="btn-ghost">Clear</Link>}
        </div>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>}

      <SelectionProvider key={filterKey} visibleIds={leads.map((l) => l.id)}>
      <BulkBar
        filters={filters as Record<string, string>}
        filterDescriptions={describeFilters(filters, campaigns, today)}
        filteredCount={total}
        canDeleteFiltered={narrowing && !error}
        truncated={total > leads.length}
      />
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-8"><SelectAllCheckbox /></th>
                <SortTh k="code">Lead</SortTh>
                <th>Owner</th>
                <th>Property</th>
                <th>Mailing</th>
                <SortTh k="recency">Permit date</SortTh>
                <SortTh k="valuation" right>Job value</SortTh>
                <SortTh k="priority">Priority</SortTh>
                <th>Postcard</th>
                <SortTh k="scans" right>Scans</SortTh>
                <th>Status</th>
                <SortTh k="followup">Next follow-up</SortTh>
                <SortTh k="activity">Last activity</SortTh>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-charcoal-light">
                    No leads found. {hasFilters ? "Try clearing filters." : <Link href="/import" className="text-forest-700 underline">Import your first CSV</Link>}
                  </td>
                </tr>
              )}
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="w-8"><RowCheckbox id={l.id} label={l.lead_code} /></td>
                  <td className="whitespace-nowrap">
                    <Link href={`/leads/${l.id}`} className="font-mono text-xs font-semibold text-forest-700 hover:underline">
                      {l.lead_code}
                    </Link>
                    {l.campaign_id && (
                      <div className="max-w-32 truncate text-[11px] text-charcoal-light">{campaignName.get(l.campaign_id)}</div>
                    )}
                  </td>
                  <td className="min-w-36">
                    <Link href={`/leads/${l.id}`} className="font-medium text-charcoal hover:text-forest-700">
                      {ownerName(l)}
                    </Link>
                  </td>
                  <td className="min-w-44 text-xs">
                    {l.property_address ?? "—"}
                    <div className="text-charcoal-light">{[l.city, l.zip].filter(Boolean).join(" ")}</div>
                  </td>
                  <td className="min-w-44 text-xs">
                    {l.mailing_differs === true ? (
                      <>
                        <span className="text-charcoal">{l.mailing_address}</span>
                        <div className="mt-0.5 inline-block rounded bg-gold-light px-1.5 text-[10px] font-medium text-gold-dark">Different</div>
                      </>
                    ) : l.mailing_differs === false ? (
                      <span className="text-charcoal-light">Same as property</span>
                    ) : (
                      <span className="text-charcoal-light">{l.mailing_address ?? "—"}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs">{formatDate(l.permit_issue_date)}</td>
                  <td className="text-right text-xs tabular-nums">{formatCurrency(l.job_valuation)}</td>
                  <td><ScoreBadge score={l.final_priority_score} /></td>
                  <td className="whitespace-nowrap text-xs">
                    {l.postcard_sent_date ? (
                      <span className="text-forest-700">Sent {formatDate(l.postcard_sent_date)}</span>
                    ) : l.follow_up_status === "Postcard queued" ? (
                      <span className="text-amber-700">Queued</span>
                    ) : (
                      <span className="text-charcoal-light">Not sent</span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    {l.qr_scan_count > 0 ? <span className="font-semibold text-gold-dark">{l.qr_scan_count}</span> : <span className="text-charcoal-light">0</span>}
                  </td>
                  <td><StatusBadge status={l.follow_up_status} /></td>
                  <td className="whitespace-nowrap text-xs">
                    {l.next_follow_up_date ? (
                      <span className={l.next_follow_up_date < today ? "font-medium text-red-700" : l.next_follow_up_date === today ? "font-medium text-gold-dark" : ""}>
                        {formatDate(l.next_follow_up_date)}
                      </span>
                    ) : (
                      <span className="text-charcoal-light">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs text-charcoal-light">{timeAgo(l.last_activity_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </SelectionProvider>
    </div>
  );
}

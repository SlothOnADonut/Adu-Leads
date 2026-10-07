import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { campaignOptions, fetchCampaigns } from "@/lib/data";
import { fullPropertyAddress, ownerName } from "@/lib/format";
import {
  canGeneratePostcard,
  notReadyReason,
  POSTCARD_LEAD_COLUMNS,
  renderPostcardSide,
  type PostcardLead,
} from "@/lib/postcards/data";
import PostcardSvg from "@/components/postcards/PostcardSvg";
import PostcardStatusBadge from "@/components/postcards/PostcardStatusBadge";
import DownloadPostcardButton from "@/components/postcards/DownloadPostcardButton";
import ApprovePostcardButton from "@/components/postcards/ApprovePostcardButton";
import { ImageStatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Postcards · ADU Lead Tracker" };

const PAGE_SIZE = 24;
const FILTERS = [
  { key: "", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "approved", label: "Approved" },
  { key: "not_ready", label: "Not ready" },
] as const;

export default async function PostcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const campaigns = await fetchCampaigns(supabase);
  const options = campaignOptions(campaigns, params.campaign);
  const campaignId = params.campaign ?? options.find((c) => !c.archived_at)?.id ?? "";
  const campaign = campaigns.find((c) => c.id === campaignId) ?? null;
  const status = ["ready", "approved", "not_ready"].includes(params.status ?? "") ? params.status! : "";
  const page = Math.max(1, Number(params.page) || 1);

  const leads: PostcardLead[] = [];
  if (campaign) {
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from("leads")
        .select(POSTCARD_LEAD_COLUMNS)
        .eq("campaign_id", campaign.id)
        .order("lead_code", { ascending: true })
        .range(from, from + 999);
      const rows = (data ?? []) as unknown as PostcardLead[];
      leads.push(...rows);
      if (rows.length < 1000) break;
    }
  }

  const total = leads.length;
  const imageReady = leads.filter((l) => l.property_image_status === "approved").length;
  const missingImages = leads.filter((l) => l.property_image_status === "missing").length;
  const postcardsReady = leads.filter((l) => l.postcard_status !== "not_ready").length;
  const approved = leads.filter((l) => l.postcard_status === "approved").length;
  const counts: Record<string, number> = {
    "": total,
    ready: leads.filter((l) => l.postcard_status === "ready").length,
    approved,
    not_ready: leads.filter((l) => l.postcard_status === "not_ready").length,
  };

  const filtered = status ? leads.filter((l) => l.postcard_status === status) : leads;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const href = (o: { status?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (campaignId) q.set("campaign", campaignId);
    const s = o.status ?? status;
    if (s) q.set("status", s);
    if (o.page && o.page > 1) q.set("page", String(o.page));
    return `/postcards?${q.toString()}`;
  };
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Postcards</h1>
          <p className="mt-1 text-sm text-charcoal-light">
            Personalized 9×6 postcards. Only leads with an <b>Approved</b> property image get a postcard.
          </p>
        </div>
        {campaign && (
          <div className="flex flex-wrap gap-2">
            <a href={`/api/postcards/manifest?campaign=${campaign.id}`} className="btn-secondary">Export manifest CSV</a>
            <a href={`/print/postcards?campaign=${campaign.id}`} target="_blank" rel="noopener" className="btn-primary">
              Print approved (PDF)
            </a>
          </div>
        )}
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-64">
          <label className="label" htmlFor="campaign">Campaign</label>
          <select id="campaign" name="campaign" defaultValue={campaignId} className="input">
            {options.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.archived_at ? " (archived)" : ""}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">Show</button>
      </form>

      {!campaign ? (
        <div className="card px-5 py-12 text-center text-sm text-charcoal-light">Create a campaign and import leads first.</div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Total leads", total],
              ["Image ready", imageReady],
              ["Missing images", missingImages],
              ["Postcards ready", postcardsReady],
            ].map(([label, value]) => (
              <div key={label as string} className="card px-4 py-3">
                <div className="text-xs font-medium tracking-wide text-charcoal-light uppercase">{label}</div>
                <div className="mt-1 font-serif text-2xl font-semibold tabular-nums text-forest-900">{value}</div>
              </div>
            ))}
          </section>

          <section className="card grid gap-4 p-4 sm:grid-cols-2">
            {[
              ["image ready", imageReady, "bg-gold"],
              ["postcard approved", approved, "bg-forest-500"],
            ].map(([label, n, bar]) => (
              <div key={label as string}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>
                    <b className="tabular-nums">{n as number} / {total}</b> {label as string}
                  </span>
                  <span className="text-xs text-charcoal-light">{pct(n as number)}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream-200">
                  <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct(n as number)}%` }} />
                </div>
              </div>
            ))}
          </section>

          <nav className="flex flex-wrap gap-2 text-sm" aria-label="Filter postcards">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={href({ status: f.key, page: 1 })}
                className={`rounded-full border px-3 py-1 ${
                  status === f.key ? "border-forest-700 bg-forest-700 text-white" : "border-cream-300 bg-white hover:border-forest-200"
                }`}
              >
                {f.label} <span className="tabular-nums opacity-80">{counts[f.key]}</span>
              </Link>
            ))}
          </nav>

          {shown.length === 0 ? (
            <div className="card px-5 py-12 text-center text-sm text-charcoal-light">Nothing here for this filter.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {shown.map((l, i) => {
                const ready = canGeneratePostcard(l);
                const dnc = l.follow_up_status === "Do not contact";
                return (
                  <article key={l.id} className="card overflow-hidden">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-cream-200 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-forest-700">{l.lead_code}</span>
                          <PostcardStatusBadge status={l.postcard_status} />
                          {dnc && (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">
                              Do not contact — excluded from exports
                            </span>
                          )}
                        </div>
                        <div className="truncate text-sm font-medium">{ownerName(l)}</div>
                        <div className="truncate text-xs text-charcoal-light">{fullPropertyAddress(l)}</div>
                      </div>
                      {ready && <ApprovePostcardButton leadId={l.id} status={l.postcard_status} imageUrl={l.property_image_url} />}
                    </div>

                    {ready ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 bg-cream-100/60 p-3">
                          <Link href={`/postcards/${l.id}`} title="Open preview" className="block rounded border border-cream-200 bg-white">
                            <PostcardSvg svg={renderPostcardSide(l, "front", { idPrefix: `l${i}f` })} />
                          </Link>
                          <Link href={`/postcards/${l.id}?side=back`} title="Open preview" className="block rounded border border-cream-200 bg-white">
                            <PostcardSvg svg={renderPostcardSide(l, "back", { idPrefix: `l${i}b` })} />
                          </Link>
                        </div>
                        <div className="flex flex-wrap items-start gap-2 px-4 py-3">
                          <Link href={`/postcards/${l.id}`} className="btn-primary btn-sm">Preview</Link>
                          <DownloadPostcardButton leadId={l.id} leadCode={l.lead_code} side="front" label="Download front" />
                          <DownloadPostcardButton leadId={l.id} leadCode={l.lead_code} side="back" label="Download back" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm">
                        <span className="flex items-center gap-2 text-charcoal-light">
                          <ImageStatusBadge status={l.property_image_status} />
                          {notReadyReason(l)} — no postcard is generated.
                        </span>
                        <span className="flex gap-3 text-xs">
                          <Link href={`/property-images?campaign=${campaignId}`} className="font-medium text-forest-600 hover:underline">Review images</Link>
                          <Link href={`/leads/${l.id}`} className="font-medium text-forest-600 hover:underline">Open lead</Link>
                        </span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {pages > 1 && (
            <nav className="flex items-center justify-center gap-3 text-sm">
              {page > 1 && <Link href={href({ page: page - 1 })} className="btn-secondary btn-sm">← Previous</Link>}
              <span className="text-charcoal-light">Page {page} of {pages}</span>
              {page < pages && <Link href={href({ page: page + 1 })} className="btn-secondary btn-sm">Next →</Link>}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

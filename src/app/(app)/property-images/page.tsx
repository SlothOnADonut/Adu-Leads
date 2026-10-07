import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { campaignOptions, fetchCampaigns } from "@/lib/data";
import { fullPropertyAddress, ownerName } from "@/lib/format";
import { getPropertyImageProviderInfo } from "@/lib/property-images/provider";
import FetchImagesPanel from "./FetchImagesPanel";
import {
  isImageStatus,
  PROPERTY_IMAGE_FILTER_ORDER,
  PROPERTY_IMAGE_STATUS_LABELS,
  type PropertyImageStatus,
} from "@/lib/property-images/types";
import ImageReviewCard, { type ReviewCardLead } from "./ImageReviewCard";
import type { Lead } from "@/lib/types";

export const metadata = { title: "Property Images · ADU Lead Tracker" };

const LIMIT = 500;
const COLUMNS =
  "id, lead_code, first_name, last_name, owner_name_raw, property_address, city, state, zip, campaign_id, property_image_url, property_image_source, property_image_status";

export default async function PropertyImagesPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const campaigns = await fetchCampaigns(supabase);
  const options = campaignOptions(campaigns, params.campaign);
  const archivedIds = campaigns.filter((c) => c.archived_at).map((c) => c.id);

  // Default to the newest active campaign so you review one mail drop at a time.
  const campaignId = params.campaign ?? options.find((c) => !c.archived_at)?.id ?? "";
  const status: PropertyImageStatus | "" = isImageStatus(params.status) ? params.status : "";

  let base = supabase.from("leads").select(COLUMNS, { count: "exact" });
  let countBase = supabase.from("leads").select("property_image_status");
  if (campaignId === "all") {
    if (archivedIds.length > 0) {
      const notArchived = `campaign_id.is.null,campaign_id.not.in.(${archivedIds.join(",")})`;
      base = base.or(notArchived);
      countBase = countBase.or(notArchived);
    }
  } else if (campaignId) {
    base = base.eq("campaign_id", campaignId);
    countBase = countBase.eq("campaign_id", campaignId);
  }
  if (status) base = base.eq("property_image_status", status);

  const [{ data, count, error }, { data: allStatuses }] = await Promise.all([
    base.order("lead_code", { ascending: true }).limit(LIMIT),
    countBase.limit(10000),
  ]);

  const leads = (data ?? []) as unknown as Lead[];
  const counts: Record<string, number> = {};
  for (const r of (allStatuses ?? []) as unknown as { property_image_status: string }[]) {
    counts[r.property_image_status] = (counts[r.property_image_status] ?? 0) + 1;
  }
  const totalInScope = Object.values(counts).reduce((a, b) => a + b, 0);
  const ready = counts.approved ?? 0;

  const cards: ReviewCardLead[] = leads.map((l) => ({
    id: l.id,
    lead_code: l.lead_code,
    owner: ownerName(l),
    address: fullPropertyAddress(l),
    property_image_url: l.property_image_url,
    property_image_source: l.property_image_source,
    property_image_status: l.property_image_status,
  }));

  const provider = getPropertyImageProviderInfo(); // name only — no secrets reach the browser
  const href = (s: string) => {
    const q = new URLSearchParams();
    if (campaignId) q.set("campaign", campaignId);
    if (s) q.set("status", s);
    return `/property-images?${q.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Property images</h1>
          <p className="mt-1 text-sm text-charcoal-light">
            Check each house photo before postcards are personalized. Postcard image ready: <b className="text-charcoal">{ready} / {totalInScope}</b>
          </p>
        </div>
        <FetchImagesPanel
          provider={provider}
          campaignId={campaignId}
          campaignName={campaigns.find((c) => c.id === campaignId)?.name ?? null}
          missingCount={counts.missing ?? 0}
        />
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-60">
          <label className="label" htmlFor="campaign">Campaign</label>
          <select id="campaign" name="campaign" defaultValue={campaignId} className="input">
            {options.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.archived_at ? " (archived)" : ""}</option>
            ))}
            <option value="all">All active campaigns</option>
          </select>
        </div>
        <div className="min-w-44">
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status} className="input">
            <option value="">All</option>
            {PROPERTY_IMAGE_FILTER_ORDER.map((s) => (
              <option key={s} value={s}>{PROPERTY_IMAGE_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">Show</button>
      </form>

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Filter by image status">
        <Link href={href("")} className={`rounded-full border px-3 py-1 ${!status ? "border-forest-700 bg-forest-700 text-white" : "border-cream-300 bg-white hover:border-forest-200"}`}>
          All <span className="tabular-nums opacity-80">{totalInScope}</span>
        </Link>
        {PROPERTY_IMAGE_FILTER_ORDER.filter((s) => ["approved", "needs_review", "missing", "rejected"].includes(s) || (counts[s] ?? 0) > 0).map((s) => (
          <Link
            key={s}
            href={href(s)}
            className={`rounded-full border px-3 py-1 ${status === s ? "border-forest-700 bg-forest-700 text-white" : "border-cream-300 bg-white hover:border-forest-200"}`}
          >
            {PROPERTY_IMAGE_STATUS_LABELS[s]} <span className="tabular-nums opacity-80">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </nav>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error.message}</p>}

      {cards.length === 0 ? (
        <div className="card px-5 py-12 text-center text-sm text-charcoal-light">
          {campaignId ? "No leads match. Try another status or campaign." : "Create a campaign and import leads first."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((c) => (
            <ImageReviewCard key={`${c.id}-${c.property_image_status}-${c.property_image_url ?? ""}`} lead={c} providerName={provider?.name ?? null} />
          ))}
        </div>
      )}
      {(count ?? 0) > cards.length && (
        <p className="text-xs text-charcoal-light">Showing the first {cards.length} of {count}. Narrow by status to see the rest.</p>
      )}
    </div>
  );
}

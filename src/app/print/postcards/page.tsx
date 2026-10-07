import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canGeneratePostcard, POSTCARD_LEAD_COLUMNS, renderPostcardSide, type PostcardLead } from "@/lib/postcards/data";
import PrintToolbar from "./PrintToolbar";
import "./print.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Print postcards · ADU Lead Tracker", robots: { index: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 300;

/**
 * Printable batch for ONE campaign: every APPROVED postcard (front, back, front, back…).
 * Excludes not-approved postcards and "Do not contact" leads.
 *   /print/postcards?campaign=<id>[&address=1]
 */
export default async function PrintCampaignPostcards({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; address?: string }>;
}) {
  const { campaign, address } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!campaign || !UUID_RE.test(campaign)) return <p className="p-8 text-sm">Pick a campaign on the Postcards page first.</p>;

  const { data } = await supabase
    .from("leads")
    .select(POSTCARD_LEAD_COLUMNS)
    .eq("campaign_id", campaign)
    .eq("postcard_status", "approved")
    .neq("follow_up_status", "Do not contact")
    .order("lead_code", { ascending: true })
    .limit(MAX);
  const leads = ((data ?? []) as unknown as PostcardLead[]).filter(canGeneratePostcard);

  return (
    <main className="min-h-screen bg-cream-100">
      <PrintToolbar count={leads.length} backHref={`/postcards?campaign=${campaign}`} />
      {leads.length === 0 && <p className="print-hide p-8 text-sm">No approved postcards in this campaign yet.</p>}
      {/* flat list of pages (front, back, front, back…) so print breaks are exact */}
      {leads.flatMap((l, i) => [
        <div key={`${l.id}-f`} className="postcard-page" dangerouslySetInnerHTML={{ __html: renderPostcardSide(l, "front", { idPrefix: `b${i}f` }) }} />,
        <div
          key={`${l.id}-b`}
          className="postcard-page"
          dangerouslySetInnerHTML={{ __html: renderPostcardSide(l, "back", { idPrefix: `b${i}b`, withAddress: address === "1" }) }}
        />,
      ])}
    </main>
  );
}

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canGeneratePostcard, isPostcardReady, loadPostcardLead, missingMailingFields, notReadyReason, renderPostcardSide } from "@/lib/postcards/data";
import PrintToolbar from "../PrintToolbar";
import "../print.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Print postcard · ADU Lead Tracker", robots: { index: false } };

/** Printable postcard (front + back) for one lead. ?address=1 prints the recipient on the back. */
export default async function PrintOnePostcard({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ address?: string }>;
}) {
  const { id } = await params;
  const { address } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lead = await loadPostcardLead(supabase, id);
  if (!lead) notFound();
  if (!canGeneratePostcard(lead)) {
    return <p className="p-8 text-sm">Postcard not available: {notReadyReason(lead)}.</p>;
  }
  if (lead.follow_up_status === "Do not contact") {
    return <p className="p-8 text-sm">This lead is marked Do not contact — printing is disabled.</p>;
  }
  if (!isPostcardReady(lead)) {
    return <p className="p-8 text-sm">Missing mailing information ({missingMailingFields(lead).join(", ")}). Complete it on the lead page before printing.</p>;
  }

  return (
    <main className="min-h-screen bg-cream-100">
      <PrintToolbar count={1} backHref={`/postcards/${lead.id}`} />
      <div className="postcard-page" dangerouslySetInnerHTML={{ __html: renderPostcardSide(lead, "front", { idPrefix: "p1f" }) }} />
      <div
        className="postcard-page"
        dangerouslySetInnerHTML={{ __html: renderPostcardSide(lead, "back", { idPrefix: "p1b", withAddress: address === "1" }) }}
      />
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, fullPropertyAddress, ownerName } from "@/lib/format";
import { trackingUrl } from "@/lib/tracking";
import { sourceLabel } from "@/lib/property-images/types";
import { canGeneratePostcard, loadPostcardLead, notReadyReason, recipientFor, renderPostcardSide } from "@/lib/postcards/data";
import PostcardStatusBadge from "@/components/postcards/PostcardStatusBadge";
import ApprovePostcardButton from "@/components/postcards/ApprovePostcardButton";
import DownloadPostcardButton from "@/components/postcards/DownloadPostcardButton";
import CopyButton from "@/components/CopyButton";
import { ImageStatusBadge } from "@/components/StatusBadge";
import PostcardViewer from "./PostcardViewer";

export const metadata = { title: "Postcard preview · ADU Lead Tracker" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-charcoal-light">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default async function PostcardPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ side?: string }>;
}) {
  const { id } = await params;
  const { side } = await searchParams;
  const supabase = await createClient();
  const lead = await loadPostcardLead(supabase, id);
  if (!lead) notFound();

  const ready = canGeneratePostcard(lead);
  const recipient = recipientFor(lead);
  const url = trackingUrl(lead.lead_code);
  const backHref = lead.campaign_id ? `/postcards?campaign=${lead.campaign_id}` : "/postcards";

  return (
    <div className="space-y-5">
      <div>
        <Link href={backHref} className="text-xs font-medium text-forest-600 hover:underline">← All postcards</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title">{ownerName(lead)}</h1>
              <span className="rounded-md bg-forest-900 px-2 py-0.5 font-mono text-xs font-semibold text-cream">{lead.lead_code}</span>
              <PostcardStatusBadge status={lead.postcard_status} />
            </div>
            <p className="mt-1 text-sm text-charcoal-light">{fullPropertyAddress(lead)}</p>
          </div>
          {ready && <ApprovePostcardButton leadId={lead.id} status={lead.postcard_status} imageUrl={lead.property_image_url} label="Mark postcard approved" size="md" />}
        </div>
      </div>

      {!ready ? (
        <div className="card space-y-3 p-6 text-sm">
          <p className="font-medium">No postcard for this lead yet.</p>
          <p className="flex items-center gap-2 text-charcoal-light">
            <ImageStatusBadge status={lead.property_image_status} /> {notReadyReason(lead)}. Postcards are only generated from an <b>Approved</b> property image.
          </p>
          <div className="flex gap-2">
            <Link href={`/leads/${lead.id}`} className="btn-primary btn-sm">Open lead</Link>
            {lead.campaign_id && <Link href={`/property-images?campaign=${lead.campaign_id}`} className="btn-secondary btn-sm">Review images</Link>}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
          <PostcardViewer
            initialSide={side === "back" ? "back" : "front"}
            variants={{
              front: renderPostcardSide(lead, "front", { idPrefix: "v-f" }),
              frontGuides: renderPostcardSide(lead, "front", { idPrefix: "v-fg", guides: true }),
              back: renderPostcardSide(lead, "back", { idPrefix: "v-b" }),
              backGuides: renderPostcardSide(lead, "back", { idPrefix: "v-bg", guides: true }),
              backAddress: renderPostcardSide(lead, "back", { idPrefix: "v-ba", withAddress: true }),
              backAddressGuides: renderPostcardSide(lead, "back", { idPrefix: "v-bag", withAddress: true, guides: true }),
            }}
          />

          <aside className="space-y-4">
            <section className="card p-4">
              <h2 className="card-title mb-3">Verify</h2>
              <dl className="space-y-3">
                <Row label="Lead code">
                  <span className="font-mono">{lead.lead_code}</span> <span className="text-xs text-charcoal-light">(printed as “Ref” on both sides)</span>
                </Row>
                <Row label="Recipient">
                  {recipient.name}
                  <br />
                  {recipient.lines.join(", ")}
                  {recipient.usedPropertyAddress && <div className="mt-1 text-xs text-gold-dark">No mailing address — using the property address.</div>}
                </Row>
                <Row label="QR opens">
                  <span className="break-all font-mono text-xs">{url}</span>
                  <div className="mt-1 flex items-center gap-2">
                    <CopyButton text={url} label="Copy URL" />
                    <span className="text-[11px] text-charcoal-light">Opening it counts as a scan.</span>
                  </div>
                </Row>
                <Row label="Property image">
                  <span className="flex items-center gap-2">
                    <ImageStatusBadge status={lead.property_image_status} />
                    <span className="text-xs text-charcoal-light">{sourceLabel(lead.property_image_source)}</span>
                  </span>
                  <a href={lead.property_image_url!} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs text-forest-600 hover:underline">
                    Open original image
                  </a>
                </Row>
                {lead.postcard_approved_at && <Row label="Postcard approved">{formatDateTime(lead.postcard_approved_at)}</Row>}
              </dl>
            </section>

            <section className="card space-y-2 p-4">
              <h2 className="card-title">Download</h2>
              <p className="text-xs text-charcoal-light">300-DPI PNG, 9×6 with 0.125″ bleed (2775 × 1875 px).</p>
              <div className="flex flex-wrap gap-2">
                <DownloadPostcardButton leadId={lead.id} leadCode={lead.lead_code} side="front" label="Front PNG" />
                <DownloadPostcardButton leadId={lead.id} leadCode={lead.lead_code} side="back" label="Back PNG" />
                <DownloadPostcardButton leadId={lead.id} leadCode={lead.lead_code} side="back" withAddress label="Back + address PNG" />
              </div>
              <div className="flex flex-wrap gap-3 pt-1 text-xs">
                <a href={`/api/postcards/${lead.id}/front.svg?download=1`} className="text-forest-600 hover:underline">Front SVG</a>
                <a href={`/api/postcards/${lead.id}/back.svg?download=1`} className="text-forest-600 hover:underline">Back SVG</a>
                <a href={`/print/postcards/${lead.id}`} target="_blank" rel="noopener" className="text-forest-600 hover:underline">Print / PDF</a>
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

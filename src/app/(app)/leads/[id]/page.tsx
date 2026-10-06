import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { campaignOptions, fetchCampaigns } from "@/lib/data";
import { EVENT_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, fullPropertyAddress, ownerName, todayISO } from "@/lib/format";
import { qrImagePath, trackingUrl } from "@/lib/tracking";
import StatusBadge, { ScoreBadge } from "@/components/StatusBadge";
import QuickActions from "@/components/QuickActions";
import CopyButton from "@/components/CopyButton";
import { DETAIL_ACTIONS } from "@/lib/quick-actions";
import StatusForm from "./StatusForm";
import NotesPanel from "./NotesPanel";
import type { Lead, TrackingEvent } from "@/lib/types";

export const metadata = { title: "Lead · ADU Lead Tracker" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-charcoal-light">{label}</dt>
      <dd className="mt-0.5 text-sm text-charcoal">{children || "—"}</dd>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function eventDetail(e: TrackingEvent): string {
  const m = e.metadata || {};
  const parts: string[] = [];
  if (e.event_type === "status_changed" && m.from_status && m.to_status) parts.push(`${m.from_status} → ${m.to_status}`);
  if (e.event_type === "cta_click" && m.cta) parts.push(`Button: ${String(m.cta)}`);
  if (e.event_type === "note_added" && m.note) parts.push(`“${String(m.note).slice(0, 120)}”`);
  if (typeof m.user_agent === "string") {
    const ua = m.user_agent;
    parts.push(/iphone|ipad/i.test(ua) ? "iPhone/iPad" : /android/i.test(ua) ? "Android" : /mac/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "Windows" : "Browser");
  }
  if (m.bulk) parts.push("bulk update");
  if (typeof m.by === "string") parts.push(`by ${m.by}`);
  return parts.join(" · ");
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: leadData }, { data: eventData }, campaigns] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("tracking_events")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    fetchCampaigns(supabase),
  ]);

  if (!leadData) notFound();
  const lead = leadData as unknown as Lead;
  const events = (eventData ?? []) as unknown as TrackingEvent[];
  const campaign = campaigns.find((c) => c.id === lead.campaign_id) ?? null;
  const url = trackingUrl(lead.lead_code);
  const today = todayISO();

  return (
    <div className="space-y-5">
      <div>
        <Link href="/leads" className="text-xs font-medium text-forest-600 hover:underline">← All leads</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title">{ownerName(lead)}</h1>
              <span className="rounded-md bg-forest-900 px-2 py-0.5 font-mono text-xs font-semibold text-cream">{lead.lead_code}</span>
            </div>
            <p className="mt-1 text-sm text-charcoal-light">{fullPropertyAddress(lead)}</p>
          </div>
          <div className="flex items-center gap-2">
            <ScoreBadge score={lead.final_priority_score} />
            <StatusBadge status={lead.follow_up_status} />
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-2 text-xs font-medium tracking-wide text-charcoal-light uppercase">Quick actions</div>
        <QuickActions leadId={lead.id} actions={DETAIL_ACTIONS} />
        {lead.next_follow_up_date && (
          <p className={`mt-3 text-sm ${lead.next_follow_up_date < today ? "font-medium text-red-700" : "text-charcoal-light"}`}>
            Next follow-up: {formatDate(lead.next_follow_up_date)}
            {lead.next_follow_up_date < today ? " (overdue)" : lead.next_follow_up_date === today ? " (today)" : ""}
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="grid gap-5 md:grid-cols-2">
            <Section title="Homeowner">
              <dl className="grid grid-cols-2 gap-4">
                <Field label="First name">{lead.first_name}</Field>
                <Field label="Last name">{lead.last_name}</Field>
                <div className="col-span-2"><Field label="Owner (as recorded)">{lead.owner_name_raw}</Field></div>
                <div className="col-span-2">
                  <Field label="Mailing address">
                    {lead.mailing_address}
                    {lead.mailing_differs === true && (
                      <span className="ml-2 rounded bg-gold-light px-1.5 py-0.5 text-[11px] font-medium text-gold-dark">Differs from property</span>
                    )}
                    {lead.mailing_differs === false && (
                      <span className="ml-2 rounded bg-forest-50 px-1.5 py-0.5 text-[11px] font-medium text-forest-700">Likely owner-occupied</span>
                    )}
                  </Field>
                </div>
              </dl>
            </Section>

            <Section title="Property">
              <dl className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><Field label="Address">{lead.property_address}</Field></div>
                <Field label="City">{lead.city}</Field>
                <Field label="State / ZIP">{[lead.state, lead.zip].filter(Boolean).join(" ")}</Field>
                <Field label="APN"><span className="font-mono text-xs">{lead.apn}</span></Field>
                <Field label="Last sale">
                  {lead.last_sale_date ? `${formatDate(lead.last_sale_date)} · ${formatCurrency(lead.last_sale_price)}` : null}
                </Field>
              </dl>
            </Section>
          </div>

          <Section title="Permit">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Permit #"><span className="font-mono text-xs">{lead.permit_number}</span></Field>
              <Field label="Issued">{formatDate(lead.permit_issue_date)}</Field>
              <Field label="Status">{lead.permit_status}</Field>
              <Field label="Job valuation">{formatCurrency(lead.job_valuation)}</Field>
              <Field label="Project type">{lead.project_type}</Field>
              <Field label="Owner builder">{lead.owner_builder}</Field>
              <Field label="Plan check">{lead.plan_check}</Field>
              <div className="col-span-2 sm:col-span-4"><Field label="Description">{lead.permit_description}</Field></div>
            </dl>
          </Section>

          <div className="grid gap-5 md:grid-cols-2">
            <Section title="Scoring">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  ["Permit", lead.permit_score],
                  ["Equity", lead.equity_signal_score],
                  ["Priority", lead.final_priority_score],
                ].map(([label, score]) => (
                  <div key={label as string} className="rounded-lg bg-cream-100/70 py-3">
                    <div className="font-serif text-2xl font-semibold text-forest-900">{score ?? "—"}</div>
                    <div className="text-xs text-charcoal-light">{label}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Mail & campaign">
              <dl className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Campaign">
                    {campaign ? (
                      <Link href={`/leads?campaign=${campaign.id}`} className="text-forest-700 hover:underline">
                        {campaign.name}
                        {campaign.archived_at ? " (archived)" : ""}
                      </Link>
                    ) : null}
                  </Field>
                </div>
                <Field label="Postcard sent">{formatDate(lead.postcard_sent_date)}</Field>
                <Field label="Postcard version">{campaign?.postcard_version}</Field>
                <Field label="QR scans">{lead.qr_scan_count}</Field>
                <Field label="Page visits">{lead.landing_page_visit_count}</Field>
                <Field label="First scan">{formatDateTime(lead.first_qr_scan_at)}</Field>
                <Field label="Last scan">{formatDateTime(lead.last_qr_scan_at)}</Field>
              </dl>
            </Section>
          </div>

          <Section title="Notes">
            <NotesPanel leadId={lead.id} notes={lead.notes} />
          </Section>

          <Section title="Activity timeline">
            {events.length === 0 ? (
              <p className="text-sm text-charcoal-light">No activity yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-cream-200 pl-5">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span
                      className={`absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                        e.event_type === "qr_scan" ? "bg-gold" : e.event_type === "funded" ? "bg-forest-700" : "bg-forest-200"
                      }`}
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-sm font-medium text-charcoal">{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                      <span className="text-xs text-charcoal-light">{formatDateTime(e.created_at)}</span>
                    </div>
                    {eventDetail(e) && <div className="text-xs text-charcoal-light">{eventDetail(e)}</div>}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Status">
            <StatusForm lead={lead} campaigns={campaignOptions(campaigns, lead.campaign_id)} />
          </Section>

          <Section title="QR code">
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImagePath(lead.lead_code, 400)}
                alt={`QR code for ${lead.lead_code}`}
                width={200}
                height={200}
                className="rounded-lg border border-cream-200"
              />
              <div className="mt-3 w-full break-all rounded-lg bg-cream-100/70 px-3 py-2 font-mono text-xs">{url}</div>
              <div className="mt-3 flex gap-2">
                <CopyButton text={url} label="Copy URL" />
                <a href={qrImagePath(lead.lead_code, 1200)} download={`${lead.lead_code}.png`} className="btn-secondary btn-sm">
                  Download PNG
                </a>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

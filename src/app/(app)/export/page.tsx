import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { campaignOptions, fetchCampaigns } from "@/lib/data";
import { getExportRows } from "@/lib/export";
import { qrImagePath } from "@/lib/tracking";
import MarkQueuedButton from "./MarkQueuedButton";

export const metadata = { title: "QR Export · ADU Lead Tracker" };

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; include_sent?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const [campaigns, rows] = await Promise.all([
    fetchCampaigns(supabase),
    getExportRows(supabase, origin, { campaign: params.campaign || null, includeSent: params.include_sent === "1" }),
  ]);

  const qs = new URLSearchParams();
  if (params.campaign) qs.set("campaign", params.campaign);
  if (params.include_sent === "1") qs.set("include_sent", "1");
  const query = qs.toString() ? `?${qs.toString()}` : "";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">QR export</h1>
        <p className="mt-1 max-w-2xl text-sm text-charcoal-light">
          Download everything your printer or mail-merge tool needs: names, addresses, each lead&apos;s unique tracking
          URL and a print-ready QR image. &ldquo;Do not contact&rdquo; leads are always excluded.
        </p>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-56">
          <label className="label" htmlFor="campaign">Campaign</label>
          <select id="campaign" name="campaign" defaultValue={params.campaign ?? ""} className="input">
            <option value="">All active campaigns</option>
            {campaignOptions(campaigns, params.campaign).map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.archived_at ? " (archived)" : ""}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="include_sent" value="1" defaultChecked={params.include_sent === "1"} className="h-4 w-4 accent-forest-700" />
          Include leads already mailed
        </label>
        <button type="submit" className="btn-secondary">Update list</button>
      </form>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          <b>{rows.length}</b> lead{rows.length === 1 ? "" : "s"} in this export
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/export${query}`} className="btn-primary">Download CSV</a>
          <a href={`/api/export/zip${query}`} className="btn-gold">Download QR images (ZIP)</a>
          {params.campaign && rows.length > 0 && <MarkQueuedButton campaignId={params.campaign} />}
        </div>
      </div>

      <div className="rounded-xl border border-gold/30 bg-gold-light/40 px-4 py-3 text-xs leading-relaxed text-charcoal">
        <b>How to use:</b> the CSV has a <code>qr_image_url</code> column (a link to a 1200px PNG) for tools like Canva Bulk Create,
        Lob or your print shop. The ZIP contains every QR as <code>ANA-0001.png</code> plus the same CSV, for tools that need image files.
        Export from your live (deployed) site so the image links work for your printer. After the postcards actually go out, open{" "}
        <Link href="/campaigns" className="font-medium text-forest-700 underline">Campaigns</Link> and click <b>Mark all sent</b>.
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>QR</th>
                <th>Lead</th>
                <th>Owner</th>
                <th>Mailing address</th>
                <th>Property address</th>
                <th>Tracking URL</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-charcoal-light">
                    No leads to export. Try &ldquo;Include leads already mailed&rdquo; or another campaign.
                  </td>
                </tr>
              )}
              {rows.slice(0, 200).map((r) => (
                <tr key={r.lead_code}>
                  <td>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrImagePath(r.public_token, 160)} alt="" width={48} height={48} loading="lazy" className="rounded border border-cream-200" />
                  </td>
                  <td className="font-mono text-xs font-semibold text-forest-700">{r.lead_code}</td>
                  <td className="text-sm">{r.owner_name}</td>
                  <td className="text-xs">{r.mailing_address || "—"}</td>
                  <td className="text-xs">{r.property_address || "—"}</td>
                  <td className="max-w-72 break-all font-mono text-[11px] text-charcoal-light">{r.unique_tracking_url}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 200 && <p className="px-4 py-3 text-xs text-charcoal-light">Showing first 200 — the downloads include all {rows.length}.</p>}
      </div>
    </div>
  );
}

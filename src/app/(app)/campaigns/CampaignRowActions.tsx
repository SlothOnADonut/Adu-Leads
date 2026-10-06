"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  archiveCampaign,
  deleteCampaignPermanently,
  getCampaignDeletionPreview,
  markCampaignPostcards,
  restoreCampaign,
  type CampaignDeletionPreview,
} from "@/lib/actions/campaigns";
import type { Campaign } from "@/lib/types";
import { formatDate } from "@/lib/format";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import CampaignForm from "./CampaignForm";

export default function CampaignRowActions({ campaign, today }: { campaign: Campaign; today: string }) {
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(today);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [preview, setPreview] = useState<CampaignDeletionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const archived = !!campaign.archived_at;

  // close the menu when clicking elsewhere
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const run = (mode: "queued" | "sent") => {
    const verb = mode === "queued" ? "Postcard queued" : `Postcard sent on ${date}`;
    if (!confirm(`Mark every eligible lead in "${campaign.name}" as ${verb}? Leads already further along (or Do not contact) are skipped.`)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await markCampaignPostcards(campaign.id, mode, date);
      setMessage(res.error ? res.error : `${res.count ?? 0} lead${res.count === 1 ? "" : "s"} updated`);
    });
  };

  const doArchive = () => {
    setMenuOpen(false);
    if (!confirm(`Archive "${campaign.name}"?\n\nIt will be hidden from normal views. No leads, scans, notes or history are deleted, and you can restore it any time.`)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await archiveCampaign(campaign.id);
      setMessage(res.error ?? "Archived");
    });
  };

  const doRestore = () => {
    setMenuOpen(false);
    setMessage(null);
    startTransition(async () => {
      const res = await restoreCampaign(campaign.id);
      setMessage(res.error ?? "Restored");
    });
  };

  const openDelete = () => {
    setMenuOpen(false);
    setPreview(null);
    setPreviewError(null);
    setDeleteOpen(true);
    startTransition(async () => {
      const res = await getCampaignDeletionPreview(campaign.id);
      if (res.error) setPreviewError(res.error);
      else setPreview(res.preview ?? null);
    });
  };

  const mailed = !!preview && (preview.mailed_lead_count > 0 || !!preview.sent_date);

  if (editing) {
    return (
      <div className="rounded-lg bg-cream-100/60 p-4">
        <CampaignForm campaign={campaign} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/leads?campaign=${campaign.id}`} className="btn-secondary btn-sm">View leads</Link>
      {!archived && (
        <>
          <Link href={`/export?campaign=${campaign.id}`} className="btn-secondary btn-sm">QR export</Link>
          <button type="button" disabled={pending} onClick={() => run("queued")} className="btn-secondary btn-sm">
            Mark all queued
          </button>
          <span className="inline-flex items-center gap-1">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-36 py-1 text-xs" />
            <button type="button" disabled={pending} onClick={() => run("sent")} className="btn-primary btn-sm">
              Mark all sent
            </button>
          </span>
          <button type="button" onClick={() => setEditing(true)} className="btn-ghost btn-sm">Edit</button>
        </>
      )}
      {archived && (
        <button type="button" disabled={pending} onClick={doRestore} className="btn-secondary btn-sm">
          Restore
        </button>
      )}

      {/* Actions menu — destructive options live here, not on the page */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="btn-ghost btn-sm"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          More ▾
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-cream-200 bg-white py-1 shadow-lg">
            {archived ? (
              <button type="button" role="menuitem" onClick={doRestore} className="block w-full px-3 py-2 text-left text-sm hover:bg-cream-100">
                Restore campaign
              </button>
            ) : (
              <button type="button" role="menuitem" onClick={doArchive} className="block w-full px-3 py-2 text-left text-sm hover:bg-cream-100">
                Archive campaign
                <span className="block text-xs text-charcoal-light">Hide it — keeps all data</span>
              </button>
            )}
            <div className="my-1 border-t border-cream-100" />
            <button type="button" role="menuitem" onClick={openDelete} className="block w-full px-3 py-2 text-left text-sm text-charcoal-light hover:bg-cream-100 hover:text-charcoal">
              Permanently delete…
            </button>
          </div>
        )}
      </div>

      {pending && !deleteOpen && <span className="text-xs text-charcoal-light">Updating…</span>}
      {message && <span className="text-xs text-forest-700">{message}</span>}

      {deleteOpen && (
        <ConfirmDeleteModal
          title="Permanently delete campaign?"
          confirmLabel="Delete campaign forever"
          disabled={!preview}
          onClose={() => setDeleteOpen(false)}
          onConfirm={async (typed) => {
            const res = await deleteCampaignPermanently(campaign.id, typed);
            if (res.error) return { error: res.error };
            setDeleteOpen(false);
            return {};
          }}
          footerExtra={
            !archived && mailed ? (
              <button
                type="button"
                className="btn-primary mr-auto"
                onClick={() => {
                  setDeleteOpen(false);
                  doArchive();
                }}
              >
                Archive instead
              </button>
            ) : null
          }
        >
          <div className="rounded-lg bg-cream-100/70 px-3 py-2">
            <div className="text-xs text-charcoal-light">Campaign</div>
            <div className="font-semibold">{campaign.name}</div>
          </div>

          {previewError ? (
            <p className="text-red-800">Couldn&apos;t load counts: {previewError}</p>
          ) : !preview ? (
            <p className="text-charcoal-light">Counting leads and history…</p>
          ) : (
            <>
              <ul className="grid grid-cols-3 gap-2 text-center">
                <li className="rounded-lg border border-red-100 py-2">
                  <div className="font-serif text-xl font-semibold text-red-800">{preview.lead_count}</div>
                  <div className="text-xs text-charcoal-light">leads</div>
                </li>
                <li className="rounded-lg border border-red-100 py-2">
                  <div className="font-serif text-xl font-semibold text-red-800">{preview.scan_count}</div>
                  <div className="text-xs text-charcoal-light">QR scans</div>
                </li>
                <li className="rounded-lg border border-red-100 py-2">
                  <div className="font-serif text-xl font-semibold text-red-800">{preview.event_count}</div>
                  <div className="text-xs text-charcoal-light">activity events</div>
                </li>
              </ul>
              <p>
                This deletes the campaign <b>and every lead in it</b>, including their scan history, activity
                timeline, notes, statuses and follow-up dates. Leads in other campaigns are not affected.
              </p>
              {mailed && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
                  <b>This campaign has already been mailed</b>
                  {preview.mailed_lead_count > 0 && <> ({preview.mailed_lead_count} postcards sent</>}
                  {preview.mailed_lead_count > 0 && preview.sent_date && <>, {formatDate(preview.sent_date)}</>}
                  {preview.mailed_lead_count > 0 && <>)</>}. QR codes already in mailboxes would stop being tracked.
                  {!archived && <> We strongly recommend <b>Archive</b> instead — it hides the campaign but keeps everything.</>}
                </div>
              )}
            </>
          )}
        </ConfirmDeleteModal>
      )}
    </div>
  );
}

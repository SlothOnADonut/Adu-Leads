"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { markCampaignPostcards } from "@/lib/actions/campaigns";
import type { Campaign } from "@/lib/types";
import CampaignForm from "./CampaignForm";

export default function CampaignRowActions({ campaign, today }: { campaign: Campaign; today: string }) {
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(today);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const run = (mode: "queued" | "sent") => {
    const verb = mode === "queued" ? "Postcard queued" : `Postcard sent on ${date}`;
    if (!confirm(`Mark every eligible lead in "${campaign.name}" as ${verb}? Leads already further along (or Do not contact) are skipped.`)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await markCampaignPostcards(campaign.id, mode, date);
      setMessage(res.error ? res.error : `${res.count ?? 0} lead${res.count === 1 ? "" : "s"} updated`);
    });
  };

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
      {pending && <span className="text-xs text-charcoal-light">Updating…</span>}
      {message && <span className="text-xs text-forest-700">{message}</span>}
    </div>
  );
}

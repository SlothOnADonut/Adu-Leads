"use client";

import { useRef, useState, useTransition } from "react";
import { createCampaign, updateCampaign } from "@/lib/actions/campaigns";
import type { Campaign } from "@/lib/types";

export default function CampaignForm({ campaign, onDone }: { campaign?: Campaign; onDone?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const res = campaign ? await updateCampaign(campaign.id, fd) : await createCampaign(fd);
          if (res.error) setError(res.error);
          else {
            if (!campaign) formRef.current?.reset();
            onDone?.();
          }
        });
      }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="sm:col-span-2 lg:col-span-1">
        <label className="label">Name *</label>
        <input name="name" required defaultValue={campaign?.name ?? ""} placeholder="Anaheim ADU – Wave 2" className="input" />
      </div>
      <div>
        <label className="label">City</label>
        <input name="city" defaultValue={campaign?.city ?? "Anaheim"} className="input" />
      </div>
      <div>
        <label className="label">Vertical</label>
        <input name="vertical" defaultValue={campaign?.vertical ?? "ADU → HELOC"} className="input" />
      </div>
      <div>
        <label className="label">Postcard version</label>
        <input name="postcard_version" defaultValue={campaign?.postcard_version ?? ""} placeholder="PC-v1" className="input" />
      </div>
      <div>
        <label className="label">Landing page version</label>
        <input name="landing_page_version" defaultValue={campaign?.landing_page_version ?? ""} placeholder="LP-v1" className="input" />
      </div>
      {campaign && (
        <div>
          <label className="label">Sent date</label>
          <input name="sent_date" type="date" defaultValue={campaign.sent_date ?? ""} className="input" />
        </div>
      )}
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="label">Notes</label>
        <input name="notes" defaultValue={campaign?.notes ?? ""} className="input" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : campaign ? "Save campaign" : "Create campaign"}
        </button>
        {campaign && onDone && (
          <button type="button" onClick={onDone} className="btn-ghost">Cancel</button>
        )}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </form>
  );
}

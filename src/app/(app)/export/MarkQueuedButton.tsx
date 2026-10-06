"use client";

import { useState, useTransition } from "react";
import { markCampaignPostcards } from "@/lib/actions/campaigns";

export default function MarkQueuedButton({ campaignId }: { campaignId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="btn-secondary"
        onClick={() =>
          startTransition(async () => {
            const res = await markCampaignPostcards(campaignId, "queued");
            setMsg(res.error ?? `${res.count ?? 0} marked as Postcard queued`);
          })
        }
      >
        {pending ? "Updating…" : "Mark these as Postcard queued"}
      </button>
      {msg && <span className="text-xs text-forest-700">{msg}</span>}
    </span>
  );
}

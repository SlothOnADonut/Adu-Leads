"use client";

import { useState, useTransition } from "react";
import { approvePostcard, unapprovePostcard } from "@/lib/actions/postcards";

export default function ApprovePostcardButton({
  leadId,
  status,
  imageUrl,
  label = "Approve postcard",
  size = "sm",
}: {
  leadId: string;
  status: string;
  /** The image the reviewer is looking at — approval is refused if it changed. */
  imageUrl: string | null;
  label?: string;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sm = size === "sm" ? "btn-sm" : "";

  if (status === "not_ready") return null;

  return (
    <span className="inline-flex flex-col gap-1">
      {status === "approved" ? (
        <span className="inline-flex items-center gap-2">
          <span className={`btn ${sm} cursor-default bg-forest-50 text-forest-700`}>Approved ✓</span>
          <button
            type="button"
            disabled={pending}
            className="text-xs text-charcoal-light hover:text-charcoal hover:underline"
            onClick={() =>
              startTransition(async () => {
                const r = await unapprovePostcard(leadId);
                if (r.error) setError(r.error);
              })
            }
          >
            Undo
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={pending || !imageUrl}
          className={`btn-primary ${sm}`}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await approvePostcard(leadId, imageUrl ?? "");
              if (r.error) setError(r.error);
            })
          }
        >
          {pending ? "Saving…" : label}
        </button>
      )}
      {error && <span className="max-w-60 text-[11px] text-rose-700">{error}</span>}
    </span>
  );
}

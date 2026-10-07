"use client";

import { useState, useTransition } from "react";
import { setImageStatus } from "@/lib/actions/property-images";

/** Approve / Reject / Needs review buttons, used on the lead page and the review grid. */
export default function PropertyImageReviewButtons({
  leadId,
  status,
  hasImage,
  size = "md",
  onChanged,
}: {
  leadId: string;
  status: string;
  hasImage: boolean;
  size?: "sm" | "md";
  onChanged?: (status: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sm = size === "sm" ? "btn-sm" : "";

  const run = (action: "approve" | "reject" | "needs_review") => {
    setActive(action);
    setError(null);
    startTransition(async () => {
      const res = await setImageStatus(leadId, action);
      if (res.error) setError(res.error);
      else if (res.status) onChanged?.(res.status);
      setActive(null);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={pending || !hasImage || status === "approved"}
          onClick={() => run("approve")}
          className={`btn-primary ${sm}`}
          title={!hasImage ? "Add an image first" : undefined}
        >
          {pending && active === "approve" ? "…" : status === "approved" ? "Approved ✓" : "Approve"}
        </button>
        <button
          type="button"
          disabled={pending || status === "rejected" || status === "missing"}
          onClick={() => run("reject")}
          className={`btn-secondary ${sm}`}
        >
          {pending && active === "reject" ? "…" : "Reject"}
        </button>
        <button
          type="button"
          disabled={pending || !hasImage || status === "needs_review"}
          onClick={() => run("needs_review")}
          className={`btn-secondary ${sm}`}
        >
          {pending && active === "needs_review" ? "…" : "Needs review"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-700">{error}</p>}
    </div>
  );
}

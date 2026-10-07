"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchLeadImage } from "@/lib/actions/property-image-fetch";

/** Fetch one lead's image from the connected provider. Hidden for approved images. */
export default function FetchOneImageButton({
  leadId,
  providerName,
  status,
  hasImage,
  size = "sm",
}: {
  leadId: string;
  providerName: string;
  status: string;
  hasImage: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (status === "approved") return null;

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        className={`btn-secondary ${size === "sm" ? "btn-sm" : ""}`}
        onClick={() => {
          if (hasImage && !confirm(`Replace the current (not approved) image with a new ${providerName} image? It will need review.`)) return;
          setResult(null);
          startTransition(async () => {
            const r = await fetchLeadImage(leadId, { mode: "single" });
            setResult({
              ok: r.outcome === "success",
              text:
                r.outcome === "success"
                  ? "Fetched — needs review"
                  : r.outcome === "no_imagery"
                    ? `No imagery: ${r.message}`
                    : r.message,
            });
            router.refresh();
          });
        }}
      >
        {pending ? "Fetching…" : `Fetch from ${providerName}`}
      </button>
      {result && <span className={`text-[11px] ${result.ok ? "text-forest-700" : "text-rose-700"}`}>{result.text}</span>}
    </span>
  );
}

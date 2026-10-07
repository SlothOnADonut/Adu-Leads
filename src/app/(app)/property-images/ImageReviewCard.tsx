"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setImageUrl } from "@/lib/actions/property-images";
import { sourceLabel } from "@/lib/property-images/types";
import { ImageStatusBadge } from "@/components/StatusBadge";
import PropertyImageReviewButtons from "@/components/PropertyImageReviewButtons";

export interface ReviewCardLead {
  id: string;
  lead_code: string;
  owner: string;
  address: string;
  property_image_url: string | null;
  property_image_source: string | null;
  property_image_status: string;
}

export default function ImageReviewCard({ lead }: { lead: ReviewCardLead }) {
  const [status, setStatus] = useState(lead.property_image_status);
  const [broken, setBroken] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasImage = !!lead.property_image_url;
  const changed = status !== lead.property_image_status;

  return (
    <article
      className={`card flex flex-col overflow-hidden transition ${
        status === "approved" ? "ring-1 ring-forest-200" : ""
      } ${changed ? "opacity-80" : ""}`}
    >
      <div className="relative bg-cream-100/70">
        {hasImage && !broken ? (
          <a href={lead.property_image_url!} target="_blank" rel="noopener noreferrer" title="Open full size">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lead.property_image_url!}
              alt={`Property ${lead.lead_code}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
              className="aspect-[4/3] w-full object-cover"
            />
          </a>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center px-3 text-center text-xs text-charcoal-light">
            {hasImage ? "Image link didn’t load" : "No property image yet"}
          </div>
        )}
        <span className="absolute top-2 left-2">
          <ImageStatusBadge status={status} />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-xs font-semibold text-forest-700">{lead.lead_code}</span>
            <span className="truncate text-[11px] text-charcoal-light">{sourceLabel(lead.property_image_source)}</span>
          </div>
          <div className="truncate text-sm font-medium" title={lead.owner}>{lead.owner}</div>
          <div className="truncate text-xs text-charcoal-light" title={lead.address}>{lead.address}</div>
        </div>

        <PropertyImageReviewButtons
          leadId={lead.id}
          status={status}
          hasImage={hasImage}
          size="sm"
          onChanged={setStatus}
        />

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs">
          <Link href={`/leads/${lead.id}`} className="font-medium text-forest-600 hover:underline">Open lead →</Link>
          {status !== "approved" && (
            <button type="button" onClick={() => setAdding((a) => !a)} className="text-charcoal-light hover:text-charcoal hover:underline">
              {hasImage ? "Replace URL" : "Add URL"}
            </button>
          )}
        </div>

        {adding && (
          <form
            className="flex gap-1.5"
            action={(fd) => {
              setError(null);
              startTransition(async () => {
                const res = await setImageUrl(lead.id, String(fd.get("url") || ""), false);
                if (res.error) setError(res.error);
                else setAdding(false); // page refreshes with the new image
              });
            }}
          >
            <input name="url" type="url" required placeholder="https://…" className="input py-1 text-xs" />
            <button type="submit" disabled={pending} className="btn-primary btn-sm">{pending ? "…" : "Save"}</button>
          </form>
        )}
        {error && <p className="text-xs text-rose-700">{error}</p>}
      </div>
    </article>
  );
}

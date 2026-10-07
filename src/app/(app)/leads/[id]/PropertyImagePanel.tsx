"use client";

import { useRef, useState, useTransition } from "react";
import { saveImageNotes, setImageUrl, uploadImage } from "@/lib/actions/property-images";
import { sourceLabel } from "@/lib/property-images/types";
import { formatDateTime } from "@/lib/format";
import { ImageStatusBadge } from "@/components/StatusBadge";
import PropertyImageReviewButtons from "@/components/PropertyImageReviewButtons";
import FetchOneImageButton from "@/components/FetchOneImageButton";
import type { Lead } from "@/lib/types";

type ImageLead = Pick<
  Lead,
  | "id"
  | "property_image_url"
  | "property_image_source"
  | "property_image_status"
  | "property_image_notes"
  | "property_image_updated_at"
  | "postcard_image_ready"
>;

export default function PropertyImagePanel({ lead, providerName }: { lead: ImageLead; providerName?: string | null }) {
  const [mode, setMode] = useState<"none" | "url" | "upload">("none");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [broken, setBroken] = useState(false);
  const urlFormRef = useRef<HTMLFormElement>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);

  const approved = lead.property_image_status === "approved";
  const hasImage = !!lead.property_image_url;

  const done = (res: { error?: string }, okText: string) => {
    if (res.error) setMessage({ ok: false, text: res.error });
    else {
      setMessage({ ok: true, text: okText });
      setMode("none");
      setBroken(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Image */}
      <div className="overflow-hidden rounded-lg border border-cream-200 bg-cream-100/60">
        {hasImage && !broken ? (
          <a href={lead.property_image_url!} target="_blank" rel="noopener noreferrer" title="Open full size">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={lead.property_image_url}
              src={lead.property_image_url!}
              alt="Property"
              className="aspect-[4/3] w-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
            />
          </a>
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center px-4 text-center">
            <span className="text-sm font-medium text-charcoal-light">
              {hasImage ? "Image link didn’t load" : "No property image yet"}
            </span>
            {hasImage && (
              <span className="mt-1 text-xs text-charcoal-light">Check the link or replace it before approving.</span>
            )}
          </div>
        )}
      </div>

      {/* Facts */}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-charcoal-light">Status</dt>
          <dd className="mt-0.5"><ImageStatusBadge status={lead.property_image_status} /></dd>
        </div>
        <div>
          <dt className="text-xs text-charcoal-light">Postcard image ready</dt>
          <dd className={`mt-0.5 font-medium ${lead.postcard_image_ready ? "text-forest-700" : "text-charcoal-light"}`}>
            {lead.postcard_image_ready ? "Yes" : "No"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-charcoal-light">Source</dt>
          <dd className="mt-0.5">{sourceLabel(lead.property_image_source)}</dd>
        </div>
        <div>
          <dt className="text-xs text-charcoal-light">Last updated</dt>
          <dd className="mt-0.5">{formatDateTime(lead.property_image_updated_at)}</dd>
        </div>
      </dl>

      {/* Review */}
      <PropertyImageReviewButtons leadId={lead.id} status={lead.property_image_status} hasImage={hasImage} />

      {/* Replace / upload */}
      <div className="flex flex-wrap gap-1.5 border-t border-cream-200 pt-3">
        <button type="button" onClick={() => { setMode(mode === "url" ? "none" : "url"); setMessage(null); }} className="btn-secondary btn-sm">
          {hasImage ? "Replace image URL" : "Add image URL"}
        </button>
        <button type="button" onClick={() => { setMode(mode === "upload" ? "none" : "upload"); setMessage(null); }} className="btn-ghost btn-sm">
          Upload photo
        </button>
        {providerName && (
          <FetchOneImageButton leadId={lead.id} providerName={providerName} status={lead.property_image_status} hasImage={hasImage} />
        )}
      </div>

      {mode === "url" && (
        <form
          ref={urlFormRef}
          className="space-y-2 rounded-lg bg-cream-100/60 p-3"
          action={(fd) => {
            setMessage(null);
            startTransition(async () => {
              const res = await setImageUrl(lead.id, String(fd.get("url") || ""), fd.get("replace_approved") === "on");
              done(res, "Saved — marked Needs review.");
            });
          }}
        >
          <label className="label" htmlFor="img-url">Image link</label>
          <input id="img-url" name="url" type="url" required placeholder="https://…/house.jpg" className="input" />
          {approved && <ReplaceCheckbox />}
          <p className="text-[11px] text-charcoal-light">Saved as a manual image and set to “Needs review”. Use only photos you have the right to print.</p>
          <button type="submit" disabled={pending} className="btn-primary btn-sm">{pending ? "Saving…" : "Save image link"}</button>
        </form>
      )}

      {mode === "upload" && (
        <form
          ref={uploadFormRef}
          className="space-y-2 rounded-lg bg-cream-100/60 p-3"
          action={(fd) => {
            setMessage(null);
            startTransition(async () => {
              const res = await uploadImage(lead.id, fd);
              done(res, "Uploaded — marked Needs review.");
            });
          }}
        >
          <label className="label" htmlFor="img-file">Photo (JPG, PNG or WebP, max 4 MB)</label>
          <input id="img-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm" />
          {approved && <ReplaceCheckbox />}
          <button type="submit" disabled={pending} className="btn-primary btn-sm">{pending ? "Uploading…" : "Upload photo"}</button>
        </form>
      )}

      {message && <p className={`text-sm ${message.ok ? "text-forest-700" : "text-rose-700"}`}>{message.text}</p>}

      {/* Notes */}
      <form
        key={lead.property_image_notes ?? ""}
        className="space-y-1.5 border-t border-cream-200 pt-3"
        action={(fd) => {
          setMessage(null);
          startTransition(async () => {
            const res = await saveImageNotes(lead.id, String(fd.get("notes") ?? ""));
            if (res.error) setMessage({ ok: false, text: res.error });
            else setMessage({ ok: true, text: "Image notes saved." });
          });
        }}
      >
        <label className="label" htmlFor="img-notes">Image notes</label>
        <textarea id="img-notes" name="notes" rows={2} defaultValue={lead.property_image_notes ?? ""} placeholder="e.g. tree blocks front, use side angle" className="input" />
        <button type="submit" disabled={pending} className="btn-ghost btn-sm">Save notes</button>
      </form>
    </div>
  );
}

function ReplaceCheckbox() {
  return (
    <label className="flex items-start gap-2 rounded-md border border-gold/40 bg-gold-light/50 px-2.5 py-2 text-xs text-charcoal">
      <input type="checkbox" name="replace_approved" required className="mt-0.5 h-4 w-4 accent-forest-700" />
      <span>
        <b>Replace approved image.</b> The current approved photo will be replaced and this lead will need review again.
      </span>
    </label>
  );
}

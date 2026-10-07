"use client";

import { useState } from "react";

/** Front/back switcher with optional print guides and recipient overlay. */
export default function PostcardViewer({
  variants,
  initialSide,
}: {
  variants: { front: string; frontGuides: string; back: string; backGuides: string; backAddress: string; backAddressGuides: string };
  initialSide: "front" | "back";
}) {
  const [side, setSide] = useState<"front" | "back">(initialSide);
  const [guides, setGuides] = useState(false);
  const [address, setAddress] = useState(true);

  const svg =
    side === "front"
      ? guides ? variants.frontGuides : variants.front
      : address
        ? guides ? variants.backAddressGuides : variants.backAddress
        : guides ? variants.backGuides : variants.back;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-cream-300 bg-white p-0.5 text-sm" role="tablist">
          {(["front", "back"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={side === s}
              onClick={() => setSide(s)}
              className={`rounded-md px-4 py-1.5 capitalize ${side === s ? "bg-forest-700 text-white" : "text-charcoal-light hover:text-charcoal"}`}
            >
              View {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-charcoal-light">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="h-4 w-4 accent-forest-700" />
            Show print guides
          </label>
          {side === "back" && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={address} onChange={(e) => setAddress(e.target.checked)} className="h-4 w-4 accent-forest-700" />
              Show recipient address
            </label>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-sm [&>svg]:block [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      {guides && (
        <p className="text-xs text-charcoal-light">
          <span className="text-rose-600">Red dashed</span> = trim line (9×6). <span className="text-sky-600">Blue dashed</span> = safe area and areas reserved for the printer. Guides never appear in downloads or print files.
        </p>
      )}
    </div>
  );
}

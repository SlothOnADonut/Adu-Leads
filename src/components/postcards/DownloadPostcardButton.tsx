"use client";

import { useState } from "react";

const PX_W = 2775; // 9.25" × 300 DPI (9" trim + 0.125" bleed each side)
const PX_H = 1875; // 6.25" × 300 DPI

/**
 * Downloads one side as a 300-DPI PNG (with bleed). The server sends a
 * self-contained SVG (image embedded); the browser rasterizes it on a canvas.
 */
export default function DownloadPostcardButton({
  leadId,
  leadCode,
  side,
  withAddress = false,
  label,
  size = "sm",
}: {
  leadId: string;
  leadCode: string;
  side: "front" | "back";
  withAddress?: boolean;
  label?: string;
  size?: "sm" | "md";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    let objectUrl: string | null = null;
    try {
      const res = await fetch(`/api/postcards/${leadId}/${side}.svg${withAddress ? "?address=1" : ""}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }
      const svg = await res.text();
      objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const img = new Image();
      img.decoding = "async";
      img.src = objectUrl;
      await img.decode();

      const canvas = document.createElement("canvas");
      canvas.width = PX_W;
      canvas.height = PX_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, PX_W, PX_H);
      ctx.drawImage(img, 0, 0, PX_W, PX_H);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Couldn't create the PNG");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${leadCode}-${side}${withAddress ? "-with-address" : ""}-9x6-300dpi.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={run} disabled={busy} className={`btn-secondary ${size === "sm" ? "btn-sm" : ""}`}>
        {busy ? "Preparing…" : (label ?? `Download ${side}`)}
      </button>
      {error && <span className="mt-1 max-w-56 text-[11px] text-rose-700">{error}</span>}
    </span>
  );
}

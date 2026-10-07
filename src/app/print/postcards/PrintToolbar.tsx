"use client";

export default function PrintToolbar({ count, backHref }: { count: number; backHref: string }) {
  return (
    <div className="print-hide sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-cream-200 bg-white px-5 py-3">
      <div className="text-sm">
        <b>{count}</b> postcard{count === 1 ? "" : "s"} · {count * 2} pages · 9.25″ × 6.25″ (9×6 + 0.125″ bleed)
        <div className="text-xs text-charcoal-light">
          In the print dialog choose <b>Save as PDF</b>, margins <b>None</b>, and turn on <b>Background graphics</b>.
        </div>
      </div>
      <div className="flex gap-2">
        <a href={backHref} className="btn-secondary">Back</a>
        <button type="button" onClick={() => window.print()} className="btn-primary">Print / Save as PDF</button>
      </div>
    </div>
  );
}

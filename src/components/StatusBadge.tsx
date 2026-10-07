const STYLES: Record<string, string> = {
  "Not contacted": "bg-cream-100 text-charcoal-light border-cream-300",
  "Postcard queued": "bg-amber-50 text-amber-800 border-amber-200",
  "Postcard sent": "bg-sky-50 text-sky-800 border-sky-200",
  "Scanned QR": "bg-gold-light text-gold-dark border-gold/40",
  "Needs follow-up": "bg-orange-50 text-orange-800 border-orange-200",
  Contacted: "bg-forest-50 text-forest-700 border-forest-200",
  "Appointment booked": "bg-violet-50 text-violet-800 border-violet-200",
  Applied: "bg-indigo-50 text-indigo-800 border-indigo-200",
  Funded: "bg-forest-700 text-white border-forest-700",
  "Do not contact": "bg-red-50 text-red-700 border-red-200",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${
        STYLES[status] ?? STYLES["Not contacted"]
      }`}
    >
      {status}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-charcoal-light">—</span>;
  const tone =
    score >= 80
      ? "bg-forest-700 text-white"
      : score >= 60
        ? "bg-forest-100 text-forest-800"
        : score >= 40
          ? "bg-gold-light text-gold-dark"
          : "bg-cream-200 text-charcoal-light";
  return (
    <span className={`inline-flex min-w-9 justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>
      {score}
    </span>
  );
}

const IMAGE_STYLES: Record<string, string> = {
  approved: "bg-forest-50 text-forest-700 border-forest-200",
  needs_review: "bg-gold-light text-gold-dark border-gold/40",
  fetched: "bg-gold-light text-gold-dark border-gold/40",
  manual: "bg-gold-light text-gold-dark border-gold/40",
  missing: "bg-cream-100 text-charcoal-light border-cream-300",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

const IMAGE_LABELS: Record<string, string> = {
  approved: "Approved",
  needs_review: "Needs review",
  fetched: "Fetched",
  manual: "Manual",
  missing: "Missing",
  rejected: "Rejected",
};

/** Compact property-image status chip (no image rendered). */
export function ImageStatusBadge({ status }: { status: string | null | undefined }) {
  const s = status || "missing";
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        IMAGE_STYLES[s] ?? IMAGE_STYLES.missing
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s === "approved" ? "bg-forest-500" : s === "rejected" ? "bg-rose-400" : s === "missing" ? "bg-cream-300" : "bg-gold"}`} />
      {IMAGE_LABELS[s] ?? s}
    </span>
  );
}

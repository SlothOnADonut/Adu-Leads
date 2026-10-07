const STYLES: Record<string, string> = {
  approved: "bg-forest-700 text-white border-forest-700",
  ready: "bg-gold-light text-gold-dark border-gold/40",
  not_ready: "bg-cream-100 text-charcoal-light border-cream-300",
};
const LABELS: Record<string, string> = { approved: "Postcard approved", ready: "Ready for review", not_ready: "Not ready" };

export default function PostcardStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${STYLES[status] ?? STYLES.not_ready}`}>
      {LABELS[status] ?? status}
    </span>
  );
}

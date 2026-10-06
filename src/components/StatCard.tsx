export default function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card px-4 py-3.5 ${accent ? "border-gold/40 bg-gold-light/40" : ""}`}>
      <div className="text-xs font-medium tracking-wide text-charcoal-light uppercase">{label}</div>
      <div className="mt-1 font-serif text-2xl font-semibold tabular-nums text-forest-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-charcoal-light">{hint}</div>}
    </div>
  );
}

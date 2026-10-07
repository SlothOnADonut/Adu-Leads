"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchLeadImage,
  listMissingImageLeads,
  refreshAfterBulkFetch,
  type FetchLeadResult,
  type FetchOutcome,
} from "@/lib/actions/property-image-fetch";

const CONCURRENCY = 2;

type Counts = Record<FetchOutcome, number>;
const EMPTY: Counts = { success: 0, no_imagery: 0, failed: 0, skipped_approved: 0, skipped_has_image: 0 };

export default function FetchImagesPanel({
  provider,
  campaignId,
  campaignName,
  missingCount,
}: {
  provider: { id: string; name: string } | null;
  /** A single campaign id, or "all"/"" when none is selected. */
  campaignId: string;
  campaignName: string | null;
  missingCount: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "confirm" | "running" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const [problems, setProblems] = useState<{ code: string; outcome: FetchOutcome; message: string }[]>([]);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const stopRef = useRef(false);

  const singleCampaign = /^[0-9a-f-]{36}$/i.test(campaignId);

  if (!provider) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button type="button" disabled className="btn-secondary" title="Image provider not connected">
          Fetch property images
        </button>
        <span className="text-xs text-charcoal-light">Image provider not connected</span>
      </div>
    );
  }

  const start = async () => {
    setError(null);
    stopRef.current = false;
    setStopReason(null);
    const list = await listMissingImageLeads(campaignId);
    if (list.error || !list.leads) {
      setError(list.error ?? "Couldn't load leads");
      setPhase("idle");
      return;
    }
    const queue = [...list.leads];
    setTotal(queue.length);
    setProcessed(0);
    setCounts({ ...EMPTY });
    setProblems([]);
    setPhase("running");

    const record = (code: string, r: FetchLeadResult) => {
      setProcessed((p) => p + 1);
      setCounts((c) => ({ ...c, [r.outcome]: c[r.outcome] + 1 }));
      if (r.outcome !== "success") setProblems((p) => [...p, { code, outcome: r.outcome, message: r.message }]);
      if (r.fatal) {
        stopRef.current = true;
        setStopReason(r.message);
      }
    };

    const worker = async () => {
      while (!stopRef.current) {
        const next = queue.shift();
        if (!next) return;
        let r: FetchLeadResult;
        try {
          r = await fetchLeadImage(next.id, { mode: "bulk", campaignId });
        } catch (e) {
          r = { outcome: "failed", message: e instanceof Error ? e.message : "Request failed" };
        }
        record(next.lead_code, r);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    await refreshAfterBulkFetch();
    router.refresh();
    setPhase("done");
  };

  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const LABELS: Record<FetchOutcome, string> = {
    success: "Successful",
    no_imagery: "No imagery found",
    failed: "Failed",
    skipped_approved: "Skipped — already approved",
    skipped_has_image: "Skipped — already has image",
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={!singleCampaign || missingCount === 0 || phase === "running"}
        onClick={() => setPhase("confirm")}
        className="btn-gold"
      >
        Fetch property images
      </button>
      <span className="text-xs text-charcoal-light">
        {!singleCampaign
          ? "Pick one campaign to fetch"
          : missingCount === 0
            ? `${provider.name} connected · no missing images`
            : `${provider.name} · ${missingCount} missing in this campaign`}
      </span>
      {error && <span className="text-xs text-rose-700">{error}</span>}

      {phase === "confirm" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-900/50 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white text-left shadow-2xl">
            <div className="border-b border-cream-200 px-5 py-4">
              <h2 className="font-serif text-lg font-semibold text-forest-900">Fetch {missingCount} property images?</h2>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <p>
                Campaign: <b>{campaignName}</b>
              </p>
              <ul className="list-disc space-y-1 pl-5 text-charcoal">
                <li>Only leads with <b>Missing</b> images in this one campaign{missingCount > 250 ? " (first 250 per run)" : ""}.</li>
                <li>Approved images are never touched.</li>
                <li>New images arrive as <b>Needs review</b> — nothing is auto-approved.</li>
                <li>If an address has no imagery, a note is added to that lead.</li>
              </ul>
              <p className="rounded-lg border border-gold/40 bg-gold-light/50 px-3 py-2 text-xs">
                Each address found uses {provider.name} transaction credits from your account. You can stop the run at any time.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-cream-200 bg-cream-100/50 px-5 py-3">
              <button type="button" onClick={() => setPhase("idle")} className="btn-secondary">Cancel</button>
              <button type="button" onClick={start} className="btn-primary">Start fetching</button>
            </div>
          </div>
        </div>
      )}

      {(phase === "running" || phase === "done") && (
        <div className="fixed right-4 bottom-4 z-40 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-cream-200 bg-white text-left shadow-xl">
          <div className="flex items-center justify-between border-b border-cream-200 px-4 py-2.5">
            <span className="text-sm font-semibold">
              {phase === "running" ? `Fetching… ${processed} / ${total}` : `Finished · ${processed} / ${total}`}
            </span>
            {phase === "running" ? (
              <button type="button" onClick={() => { stopRef.current = true; setStopReason("Stopped by you"); }} className="btn-secondary btn-sm">
                Stop
              </button>
            ) : (
              <button type="button" onClick={() => setPhase("idle")} className="btn-ghost btn-sm">Close</button>
            )}
          </div>
          <div className="space-y-3 px-4 py-3 text-sm">
            <div className="h-2 overflow-hidden rounded-full bg-cream-200">
              <div className="h-full rounded-full bg-forest-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {(Object.keys(LABELS) as FetchOutcome[])
                .filter((k) => k !== "skipped_has_image" || counts[k] > 0)
                .map((k) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-charcoal-light">{LABELS[k]}</dt>
                    <dd className={`font-semibold tabular-nums ${k === "success" ? "text-forest-700" : k === "failed" && counts[k] > 0 ? "text-rose-700" : ""}`}>
                      {counts[k]}
                    </dd>
                  </div>
                ))}
            </dl>
            {stopReason && <p className="text-xs text-rose-700">Stopped: {stopReason}</p>}
            {problems.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-charcoal-light">Details ({problems.length})</summary>
                <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                  {problems.map((p, i) => (
                    <li key={i}>
                      <span className="font-mono font-semibold">{p.code}</span> — {p.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {phase === "done" && counts.success > 0 && (
              <p className="text-xs text-charcoal-light">New images are marked <b>Needs review</b>. Filter by that status to approve them.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

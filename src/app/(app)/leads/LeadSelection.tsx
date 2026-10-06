"use client";

import { createContext, useContext, useMemo, useState } from "react";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { deleteFilteredLeads, deleteLeads } from "@/lib/actions/leads";

type Ctx = {
  selected: Set<string>;
  visibleIds: string[];
  toggle: (id: string) => void;
  setAll: (on: boolean) => void;
  clear: () => void;
};

const SelectionContext = createContext<Ctx | null>(null);

function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("Selection components must be inside <SelectionProvider>");
  return ctx;
}

/** Holds which rows are ticked. Re-mounted (and so cleared) whenever the filters change. */
export function SelectionProvider({ visibleIds, children }: { visibleIds: string[]; children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const value = useMemo<Ctx>(
    () => ({
      selected,
      visibleIds,
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      setAll: (on) => setSelected(on ? new Set(visibleIds) : new Set()),
      clear: () => setSelected(new Set()),
    }),
    [selected, visibleIds]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      aria-label={`Select ${label}`}
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      className="h-4 w-4 cursor-pointer accent-forest-700"
    />
  );
}

export function SelectAllCheckbox() {
  const { selected, visibleIds, setAll } = useSelection();
  const all = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const some = !all && visibleIds.some((id) => selected.has(id));
  return (
    <input
      type="checkbox"
      aria-label="Select all visible leads"
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = some;
      }}
      onChange={() => setAll(!all)}
      disabled={visibleIds.length === 0}
      className="h-4 w-4 cursor-pointer accent-forest-700"
    />
  );
}

/**
 * Bar shown above the table: appears with bulk actions when rows are ticked,
 * and offers a low-key "Delete all filtered leads" link when filters are active.
 */
export function BulkBar({
  filters,
  filterDescriptions,
  filteredCount,
  canDeleteFiltered,
  truncated,
}: {
  filters: Record<string, string>;
  filterDescriptions: string[];
  filteredCount: number;
  canDeleteFiltered: boolean;
  truncated: boolean;
}) {
  const { selected, clear } = useSelection();
  const [mode, setMode] = useState<"selected" | "filtered" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const count = selected.size;

  return (
    <>
      {count > 0 ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-forest-200 bg-forest-50 px-4 py-2.5 shadow-sm">
          <span className="text-sm font-medium text-forest-800">
            {count} lead{count === 1 ? "" : "s"} selected
          </span>
          <button type="button" onClick={clear} className="btn-ghost btn-sm">Clear selection</button>
          <button type="button" onClick={() => setMode("selected")} className="btn-secondary btn-sm ml-auto">
            Delete selected…
          </button>
        </div>
      ) : (
        (canDeleteFiltered || done) && (
          <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
            {done && <span className="text-forest-700">{done}</span>}
            {canDeleteFiltered && filteredCount > 0 && (
              <button
                type="button"
                onClick={() => setMode("filtered")}
                className="text-charcoal-light underline-offset-2 hover:text-charcoal hover:underline"
              >
                Delete all {filteredCount} filtered leads…
              </button>
            )}
          </div>
        )
      )}

      {mode === "selected" && (
        <ConfirmDeleteModal
          title={`Delete ${count} selected lead${count === 1 ? "" : "s"}?`}
          confirmLabel={`Delete ${count} lead${count === 1 ? "" : "s"}`}
          onClose={() => setMode(null)}
          onConfirm={async (typed) => {
            const res = await deleteLeads(Array.from(selected), typed);
            if (res.error) return { error: res.error };
            clear();
            setMode(null);
            setDone(`Deleted ${res.leadsDeleted} lead${res.leadsDeleted === 1 ? "" : "s"} and ${res.eventsDeleted} activity events.`);
            return {};
          }}
        >
          <p>
            You are about to permanently delete <b>{count}</b> lead{count === 1 ? "" : "s"} you ticked on this page.
          </p>
          <p>
            Their <b>scan history, activity events, notes, statuses and follow-up dates</b> will be deleted too.
            No other leads or campaigns are affected.
          </p>
        </ConfirmDeleteModal>
      )}

      {mode === "filtered" && (
        <ConfirmDeleteModal
          title={`Delete all ${filteredCount} filtered leads?`}
          confirmLabel={`Delete ${filteredCount} leads`}
          onClose={() => setMode(null)}
          onConfirm={async (typed) => {
            const res = await deleteFilteredLeads(filters, filteredCount, typed);
            if (res.error) return { error: res.error };
            setMode(null);
            setDone(`Deleted ${res.leadsDeleted} leads and ${res.eventsDeleted} activity events.`);
            return {};
          }}
        >
          <p>
            This deletes <b>exactly {filteredCount}</b> lead{filteredCount === 1 ? "" : "s"} — every lead matching
            your current filters{truncated ? " (including ones beyond the first 2,000 shown in the table)" : ""}:
          </p>
          <ul className="list-disc space-y-0.5 rounded-lg bg-cream-100/70 py-2 pr-3 pl-7">
            {filterDescriptions.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p>
            Their <b>scan history, activity events, notes and statuses</b> are deleted too. Leads that don&apos;t match
            these filters are not touched. If the number of matches changes before you confirm, nothing is deleted.
          </p>
        </ConfirmDeleteModal>
      )}
    </>
  );
}

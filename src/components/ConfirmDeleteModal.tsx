"use client";

import { useEffect, useState, useTransition } from "react";

/**
 * Destructive-action dialog. The confirm button stays disabled until the
 * user types DELETE exactly. Warning colors are used only here.
 */
export default function ConfirmDeleteModal({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  disabled = false,
  footerExtra,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  /** Receives the typed text; return an error message to keep the dialog open. */
  onConfirm: (typed: string) => Promise<{ error?: string } | void>;
  onClose: () => void;
  disabled?: boolean;
  footerExtra?: React.ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = typed === "DELETE" && !disabled && !pending;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-forest-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-red-100 bg-red-50 px-5 py-4">
          <h2 id="confirm-delete-title" className="font-serif text-lg font-semibold text-red-800">
            {title}
          </h2>
          <p className="mt-0.5 text-sm font-medium text-red-700">This cannot be undone.</p>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm text-charcoal">
          {children}

          <div>
            <label htmlFor="confirm-delete-input" className="mb-1 block text-sm">
              Type <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono font-semibold text-red-700">DELETE</span> to confirm
            </label>
            <input
              id="confirm-delete-input"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded-lg border border-red-200 px-3 py-2 font-mono text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              placeholder="DELETE"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-cream-200 bg-cream-100/50 px-5 py-3">
          {footerExtra}
          <button type="button" onClick={onClose} disabled={pending} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await onConfirm(typed);
                if (res && res.error) setError(res.error);
              });
            }}
            className="btn bg-red-700 text-white hover:bg-red-800"
          >
            {pending ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

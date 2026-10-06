"use client";

import { useRef, useState, useTransition } from "react";
import { addNote, saveNotes } from "@/lib/actions/leads";

export default function NotesPanel({ leadId, notes }: { leadId: string; notes: string | null }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-3">
      {!editing ? (
        <>
          <form
            ref={formRef}
            action={(fd) => {
              setError(null);
              startTransition(async () => {
                const res = await addNote(leadId, fd);
                if (res.error) setError(res.error);
                else formRef.current?.reset();
              });
            }}
            className="space-y-2"
          >
            <textarea name="note" rows={2} placeholder="Add a note (call outcome, what they said…)" className="input" />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={pending} className="btn-primary btn-sm">
                {pending ? "Saving…" : "Add note"}
              </button>
              {notes && (
                <button type="button" onClick={() => setEditing(true)} className="btn-ghost btn-sm">
                  Edit all notes
                </button>
              )}
            </div>
          </form>
          {notes ? (
            <div className="whitespace-pre-wrap rounded-lg bg-cream-100/70 p-3 text-sm leading-relaxed">{notes}</div>
          ) : (
            <p className="text-sm text-charcoal-light">No notes yet.</p>
          )}
        </>
      ) : (
        <form
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              const res = await saveNotes(leadId, fd);
              if (res.error) setError(res.error);
              else setEditing(false);
            });
          }}
          className="space-y-2"
        >
          <textarea name="notes" rows={8} defaultValue={notes ?? ""} className="input font-mono text-xs" />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary btn-sm">
              {pending ? "Saving…" : "Save notes"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

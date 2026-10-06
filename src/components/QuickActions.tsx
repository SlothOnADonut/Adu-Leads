"use client";

import { useState, useTransition } from "react";
import { quickAction, type QuickAction } from "@/lib/actions/leads";

const ALL: { action: QuickAction; label: string; tone?: "primary" | "danger" | "gold" }[] = [
  { action: "postcard_sent", label: "Postcard sent" },
  { action: "called", label: "Called" },
  { action: "texted", label: "Texted" },
  { action: "appointment_booked", label: "Appt booked", tone: "primary" },
  { action: "applied", label: "Applied", tone: "primary" },
  { action: "funded", label: "Funded", tone: "gold" },
  { action: "follow_up_done", label: "Follow-up done" },
  { action: "snooze_1", label: "+1 day" },
  { action: "snooze_3", label: "+3 days" },
  { action: "snooze_7", label: "+1 week" },
  { action: "do_not_contact", label: "Do not contact", tone: "danger" },
];

export default function QuickActions({
  leadId,
  actions,
  size = "md",
}: {
  leadId: string;
  actions: QuickAction[];
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<QuickAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (action: QuickAction) => {
    if (action === "do_not_contact" && !confirm("Mark this lead as Do not contact?")) return;
    setActive(action);
    setError(null);
    startTransition(async () => {
      const res = await quickAction(leadId, action);
      if (res.error) setError(res.error);
      setActive(null);
    });
  };

  const items = ALL.filter((a) => actions.includes(a.action));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const cls =
            item.tone === "primary"
              ? "btn-primary"
              : item.tone === "gold"
                ? "btn-gold"
                : item.tone === "danger"
                  ? "btn-secondary text-red-700 hover:border-red-200 hover:bg-red-50"
                  : "btn-secondary";
          return (
            <button
              key={item.action}
              type="button"
              disabled={pending}
              onClick={() => run(item.action)}
              className={`${cls} ${size === "sm" ? "btn-sm" : ""}`}
            >
              {pending && active === item.action ? "Saving…" : item.label}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

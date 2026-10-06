"use client";

import { useState, useTransition } from "react";
import { updateLeadStatus } from "@/lib/actions/leads";
import {
  APPLICATION_STATUSES,
  APPOINTMENT_STATUSES,
  CALL_STATUSES,
  FOLLOW_UP_STATUSES,
  FUNDED_STATUSES,
  TEXT_STATUSES,
} from "@/lib/constants";
import type { Campaign, Lead } from "@/lib/types";

function Select({
  name,
  label,
  value,
  options,
  allowEmpty = true,
}: {
  name: string;
  label: string;
  value: string | null;
  options: readonly string[];
  allowEmpty?: boolean;
}) {
  // Keep unknown existing values selectable so saving never wipes them.
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value ?? ""} className="input">
        {allowEmpty && <option value="">—</option>}
        {opts.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export default function StatusForm({ lead, campaigns }: { lead: Lead; campaigns: Campaign[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      key={lead.updated_at}
      action={(formData) => {
        setMessage(null);
        startTransition(async () => {
          const res = await updateLeadStatus(lead.id, formData);
          setMessage(res.error ? { ok: false, text: res.error } : { ok: true, text: "Saved" });
        });
      }}
      className="space-y-3"
    >
      <Select name="follow_up_status" label="Follow-up status" value={lead.follow_up_status} options={FOLLOW_UP_STATUSES} allowEmpty={false} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="next_follow_up_date">Next follow-up</label>
          <input id="next_follow_up_date" name="next_follow_up_date" type="date" defaultValue={lead.next_follow_up_date ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="postcard_sent_date">Postcard sent</label>
          <input id="postcard_sent_date" name="postcard_sent_date" type="date" defaultValue={lead.postcard_sent_date ?? ""} className="input" />
        </div>
        <Select name="call_status" label="Call" value={lead.call_status} options={CALL_STATUSES} />
        <Select name="text_status" label="Text" value={lead.text_status} options={TEXT_STATUSES} />
        <Select name="appointment_status" label="Appointment" value={lead.appointment_status} options={APPOINTMENT_STATUSES} />
        <Select name="application_status" label="Application" value={lead.application_status} options={APPLICATION_STATUSES} />
        <Select name="funded_status" label="Funded" value={lead.funded_status} options={FUNDED_STATUSES} />
        <div>
          <label className="label" htmlFor="campaign_id">Campaign</label>
          <select id="campaign_id" name="campaign_id" defaultValue={lead.campaign_id ?? ""} className="input">
            <option value="">No campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save changes"}
        </button>
        {message && (
          <span className={`text-sm ${message.ok ? "text-forest-600" : "text-red-700"}`}>{message.text}</span>
        )}
      </div>
    </form>
  );
}

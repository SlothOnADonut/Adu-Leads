"use client";

import { useState, useTransition } from "react";
import { updateMailingInfo } from "@/lib/actions/mailing";

export interface MailingValues {
  mailing_name: string | null;
  mailing_street: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
  mailing_address: string | null;
  mailing_complete: boolean;
  /** Name that will print if "Recipient name" is left blank. */
  fallbackName: string | null;
  postcardStatus: string;
}

export default function MailingInfoForm({ leadId, values }: { leadId: string; values: MailingValues }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      key={[values.mailing_name, values.mailing_street, values.mailing_city, values.mailing_state, values.mailing_zip].join("|")}
      action={(fd) => {
        if (values.postcardStatus === "approved" && !confirm("This postcard is approved. Changing mailing details will require approving it again. Continue?")) return;
        setMsg(null);
        startTransition(async () => {
          const r = await updateMailingInfo(leadId, fd);
          setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Saved" });
        });
      }}
      className="space-y-3"
    >
      <div
        className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
          values.mailing_complete ? "bg-forest-50 text-forest-800" : "bg-amber-50 text-amber-900"
        }`}
      >
        <span aria-hidden>{values.mailing_complete ? "✓" : "!"}</span>
        <span>
          {values.mailing_complete
            ? "Mailing information complete."
            : "Missing mailing information — the postcard can't be approved, exported or printed until name, street, city, state and ZIP are filled in."}
          {!values.mailing_complete && values.mailing_address && (
            <span className="mt-1 block text-xs">
              Imported text: “{values.mailing_address}” couldn't be split automatically. Enter the parts below.
            </span>
          )}
        </span>
      </div>

      <div>
        <label className="label" htmlFor="mailing_name">Recipient name</label>
        <input id="mailing_name" name="mailing_name" defaultValue={values.mailing_name ?? ""} placeholder={values.fallbackName ?? "e.g. Maria Gonzalez"} className="input" />
        <p className="mt-1 text-[11px] text-charcoal-light">
          {values.fallbackName ? `Leave blank to print “${values.fallbackName}” (from the owner name).` : "No owner name on file — enter who the card is addressed to."}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="mailing_street">Street</label>
        <input id="mailing_street" name="mailing_street" defaultValue={values.mailing_street ?? ""} placeholder="1201 W Demo Ave" className="input" />
      </div>
      <div className="grid grid-cols-[1fr_4.5rem_6.5rem] gap-2">
        <div>
          <label className="label" htmlFor="mailing_city">City</label>
          <input id="mailing_city" name="mailing_city" defaultValue={values.mailing_city ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="mailing_state">State</label>
          <input id="mailing_state" name="mailing_state" defaultValue={values.mailing_state ?? ""} maxLength={2} className="input uppercase" />
        </div>
        <div>
          <label className="label" htmlFor="mailing_zip">ZIP</label>
          <input id="mailing_zip" name="mailing_zip" defaultValue={values.mailing_zip ?? ""} inputMode="numeric" className="input" />
        </div>
      </div>
      <p className="text-[11px] text-charcoal-light">The property address is never used as the mailing address unless you enter it here.</p>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary btn-sm">{pending ? "Saving…" : "Save mailing info"}</button>
        {msg && <span className={`text-sm ${msg.ok ? "text-forest-700" : "text-rose-700"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}

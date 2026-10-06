import type { QuickAction } from "@/lib/actions/leads";

/** Buttons shown on the lead detail page. */
export const DETAIL_ACTIONS: QuickAction[] = [
  "postcard_sent",
  "called",
  "texted",
  "appointment_booked",
  "applied",
  "funded",
  "do_not_contact",
];

/** Compact buttons shown on the follow-ups page and dashboard. */
export const FOLLOW_UP_ACTIONS: QuickAction[] = ["called", "texted", "appointment_booked", "follow_up_done", "snooze_3"];

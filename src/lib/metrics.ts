import { STATUS_RANK, type FollowUpStatus } from "./constants";
import type { Lead } from "./types";

type Stage = "sent" | "scanned" | "contacted" | "appointment" | "applied" | "funded";

type StageLead = Pick<
  Lead,
  | "follow_up_status"
  | "postcard_sent_date"
  | "qr_scan_count"
  | "call_status"
  | "text_status"
  | "appointment_status"
  | "application_status"
  | "funded_status"
>;

function rank(status: FollowUpStatus): number {
  return STATUS_RANK[status] ?? 0;
}

/** Has this lead reached a pipeline stage? Uses both the status and the detail fields. */
export function reached(lead: StageLead, stage: Stage): boolean {
  const r = rank(lead.follow_up_status);
  switch (stage) {
    case "sent":
      return !!lead.postcard_sent_date || r >= STATUS_RANK["Postcard sent"];
    case "scanned":
      return (lead.qr_scan_count ?? 0) > 0;
    case "contacted":
      return !!lead.call_status || !!lead.text_status || r >= STATUS_RANK["Contacted"];
    case "appointment":
      return !!lead.appointment_status || r >= STATUS_RANK["Appointment booked"];
    case "applied":
      return !!lead.application_status || r >= STATUS_RANK["Applied"];
    case "funded":
      return lead.funded_status === "Funded" || lead.follow_up_status === "Funded";
  }
}

export interface Summary {
  total: number;
  sent: number;
  scans: number;
  uniqueScanners: number;
  appointments: number;
  applications: number;
  funded: number;
  scanRate: number | null;
  appointmentRate: number | null;
  applicationRate: number | null;
}

/** All rates use postcards sent as the denominator. */
export function summarize(leads: StageLead[]): Summary {
  const sent = leads.filter((l) => reached(l, "sent")).length;
  const uniqueScanners = leads.filter((l) => reached(l, "scanned")).length;
  const appointments = leads.filter((l) => reached(l, "appointment")).length;
  const applications = leads.filter((l) => reached(l, "applied")).length;
  const funded = leads.filter((l) => reached(l, "funded")).length;
  const rate = (n: number) => (sent > 0 ? n / sent : null);
  return {
    total: leads.length,
    sent,
    scans: leads.reduce((sum, l) => sum + (l.qr_scan_count ?? 0), 0),
    uniqueScanners,
    appointments,
    applications,
    funded,
    scanRate: rate(uniqueScanners),
    appointmentRate: rate(appointments),
    applicationRate: rate(applications),
  };
}

/** Moves a status forward only; never moves backward, never leaves "Do not contact". */
export function advanceStatus(current: FollowUpStatus, target: FollowUpStatus): FollowUpStatus {
  if (current === "Do not contact") return current;
  return rank(target) > rank(current) ? target : current;
}

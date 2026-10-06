export const APP_TIMEZONE = "America/Los_Angeles";

export const BRAND = {
  name: "Armando Fernandez",
  title: "Mortgage Loan Officer",
  company: "The Mortgage Professionals",
  nmls: "2161748",
  phone: "714-746-1584",
  phoneHref: "tel:+17147461584",
} as const;

export const FOLLOW_UP_STATUSES = [
  "Not contacted",
  "Postcard queued",
  "Postcard sent",
  "Scanned QR",
  "Needs follow-up",
  "Contacted",
  "Appointment booked",
  "Applied",
  "Funded",
  "Do not contact",
] as const;

export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

/** Pipeline order. Automatic changes only ever move a lead forward. */
export const STATUS_RANK: Record<FollowUpStatus, number> = {
  "Not contacted": 0,
  "Postcard queued": 1,
  "Postcard sent": 2,
  "Scanned QR": 3,
  "Needs follow-up": 4,
  Contacted: 5,
  "Appointment booked": 6,
  Applied: 7,
  Funded: 8,
  "Do not contact": -1,
};

export const CALL_STATUSES = ["Called", "No answer", "Left voicemail", "Spoke", "Wrong number"];
export const TEXT_STATUSES = ["Texted", "Replied", "No reply", "Opted out"];
export const APPOINTMENT_STATUSES = ["Booked", "Completed", "No-show", "Canceled"];
export const APPLICATION_STATUSES = ["Started", "Submitted", "Approved", "Declined"];
export const FUNDED_STATUSES = ["Funded"];

export const LEAD_CODE_RE = /^[A-Z]{2,5}-[0-9]{4,6}$/;

export const EVENT_LABELS: Record<string, string> = {
  postcard_queued: "Postcard queued",
  postcard_sent: "Postcard sent",
  qr_scan: "Scanned QR code",
  landing_page_visit: "Visited landing page",
  cta_click: "Clicked a button",
  call: "Called",
  text: "Texted",
  appointment_booked: "Appointment booked",
  application_started: "Application started",
  funded: "Funded",
  follow_up_completed: "Follow-up completed",
  do_not_contact: "Marked do not contact",
  status_changed: "Status changed",
  note_added: "Note added",
};

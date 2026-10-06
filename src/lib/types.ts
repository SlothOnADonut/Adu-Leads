import type { FollowUpStatus } from "./constants";

export interface Campaign {
  id: string;
  name: string;
  city: string | null;
  vertical: string | null;
  postcard_version: string | null;
  landing_page_version: string | null;
  sent_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  lead_code: string;
  first_name: string | null;
  last_name: string | null;
  owner_name_raw: string | null;
  mailing_address: string | null;
  property_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  apn: string | null;
  permit_number: string | null;
  permit_issue_date: string | null;
  permit_status: string | null;
  permit_description: string | null;
  job_valuation: number | null;
  project_type: string | null;
  owner_builder: string | null;
  plan_check: string | null;
  last_sale_date: string | null;
  last_sale_price: number | null;
  permit_score: number | null;
  equity_signal_score: number | null;
  final_priority_score: number | null;
  campaign_id: string | null;
  postcard_sent_date: string | null;
  qr_scan_count: number;
  first_qr_scan_at: string | null;
  last_qr_scan_at: string | null;
  landing_page_visit_count: number;
  call_status: string | null;
  text_status: string | null;
  appointment_status: string | null;
  application_status: string | null;
  funded_status: string | null;
  follow_up_status: FollowUpStatus;
  next_follow_up_date: string | null;
  notes: string | null;
  last_activity_at: string | null;
  mailing_differs: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TrackingEvent {
  id: string;
  lead_id: string | null;
  campaign_id: string | null;
  event_type: string;
  event_source: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

/** Shape sent from the import screen to the import_leads() database function. */
export interface ImportLeadRow {
  first_name: string | null;
  last_name: string | null;
  owner_name_raw: string | null;
  mailing_address: string | null;
  property_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  apn: string | null;
  permit_number: string | null;
  permit_issue_date: string | null;
  permit_status: string | null;
  permit_description: string | null;
  job_valuation: number | null;
  project_type: string | null;
  owner_builder: string | null;
  plan_check: string | null;
  last_sale_date: string | null;
  last_sale_price: number | null;
  permit_score: number | null;
  equity_signal_score: number | null;
  final_priority_score: number | null;
}

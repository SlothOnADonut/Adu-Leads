-- =====================================================================
-- Seed data (optional). Run AFTER schema.sql.
--
-- Creates:
--   1. Your real first campaign: "Anaheim ADU – Wave 1"  (keep this)
--   2. A "DEMO" campaign with 8 fake leads (DEMO-0001 … DEMO-0008) so
--      you can click around before importing real data.
--
-- Demo leads use the DEMO- prefix, so your real Anaheim leads will
-- still start at ANA-0001.
--
-- To remove the demo data later, run:
--   delete from public.leads where lead_code like 'DEMO-%';
--   delete from public.campaigns where name = 'DEMO – sample data';
-- =====================================================================

insert into public.campaigns (id, name, city, vertical, postcard_version, landing_page_version, notes)
values
  ('00000000-0000-4000-8000-000000000001', 'Anaheim ADU – Wave 1', 'Anaheim', 'ADU → HELOC', 'PC-v1', 'LP-v1',
   'First 100 Anaheim ADU permit owners.'),
  ('00000000-0000-4000-8000-0000000000de', 'DEMO – sample data', 'Anaheim', 'ADU → HELOC', 'PC-v1', 'LP-v1',
   'Fake leads for testing. Safe to delete.')
on conflict (id) do nothing;

insert into public.leads (
  lead_code, first_name, last_name, owner_name_raw, mailing_address, property_address, city, state, zip, apn,
  permit_number, permit_issue_date, permit_status, permit_description, job_valuation, project_type,
  owner_builder, plan_check, last_sale_date, last_sale_price,
  permit_score, equity_signal_score, final_priority_score,
  campaign_id, postcard_sent_date, follow_up_status, next_follow_up_date, call_status, appointment_status, notes
) values
  ('DEMO-0001', 'Maria', 'Gonzalez', 'MARIA GONZALEZ', '1201 W Demo Ave, Anaheim, CA 92801', '1201 W Demo Ave', 'Anaheim', 'CA', '92801', '000-000-01',
   'DEMO-BLD-0001', current_date - 40, 'Issued', 'New detached ADU 750 sq ft', 185000, 'Detached ADU',
   'No', 'PC-0001', '2009-05-14', 410000, 88, 100, 93,
   '00000000-0000-4000-8000-0000000000de', current_date - 10, 'Scanned QR', current_date, null, null, null),
  ('DEMO-0002', 'James', 'Nguyen', 'NGUYEN JAMES', 'PO Box 1234, Irvine, CA 92618', '845 S Sample St', 'Anaheim', 'CA', '92805', '000-000-02',
   'DEMO-BLD-0002', current_date - 95, 'Finaled', 'Garage conversion to ADU', 92000, 'Garage conversion',
   'Yes', 'PC-0002', '2015-08-02', 560000, 72, 85, 77,
   '00000000-0000-4000-8000-0000000000de', current_date - 10, 'Contacted', current_date - 2, 'Spoke', null, 'Interested, wants rates after Q4.'),
  ('DEMO-0003', 'Linda', 'Park', 'PARK LINDA', '2290 E Example Way, Anaheim, CA 92806', '2290 E Example Way', 'Anaheim', 'CA', '92806', '000-000-03',
   'DEMO-BLD-0003', current_date - 20, 'Issued', 'Attached ADU addition 600 sq ft', 140000, 'Attached ADU',
   'No', 'PC-0003', '2004-03-19', 380000, 90, 100, 94,
   '00000000-0000-4000-8000-0000000000de', current_date - 10, 'Appointment booked', current_date + 2, 'Spoke', 'Booked', null),
  ('DEMO-0004', 'Robert', 'Silva', 'SILVA ROBERT & ANNA', '510 N Test Pl, Anaheim, CA 92801', '510 N Test Pl', 'Anaheim', 'CA', '92801', '000-000-04',
   'DEMO-BLD-0004', current_date - 200, 'Issued', 'JADU conversion', 45000, 'JADU',
   'No', 'PC-0004', '2020-11-30', 815000, 45, 40, 43,
   '00000000-0000-4000-8000-0000000000de', current_date - 10, 'Postcard sent', null, null, null, null),
  ('DEMO-0005', 'Grace', 'Kim', 'KIM GRACE', '77 Placeholder Ct, Anaheim, CA 92807', '77 Placeholder Ct', 'Anaheim', 'CA', '92807', '000-000-05',
   'DEMO-BLD-0005', current_date - 60, 'Finaled', 'New detached ADU 1,000 sq ft', 240000, 'Detached ADU',
   'No', 'PC-0005', '2001-06-01', 295000, 82, 100, 89,
   '00000000-0000-4000-8000-0000000000de', current_date - 10, 'Applied', null, 'Spoke', 'Completed', null),
  ('DEMO-0006', 'Daniel', 'Lopez', 'LOPEZ DANIEL', '3300 W Mock Rd, Anaheim, CA 92804', '3300 W Mock Rd', 'Anaheim', 'CA', '92804', '000-000-06',
   'DEMO-BLD-0006', current_date - 15, 'Issued', 'New detached ADU', 175000, 'Detached ADU',
   'No', 'PC-0006', '2012-01-20', 450000, 90, 85, 88,
   '00000000-0000-4000-8000-0000000000de', null, 'Postcard queued', null, null, null, null),
  ('DEMO-0007', 'Patricia', 'Chen', 'CHEN FAMILY TRUST', '9 Sample Ln, Fullerton, CA 92835', '1450 S Demo Blvd', 'Anaheim', 'CA', '92802', '000-000-07',
   'DEMO-BLD-0007', current_date - 120, 'Issued', 'Garage conversion ADU', 70000, 'Garage conversion',
   'Yes', 'PC-0007', '1998-09-09', 210000, 60, 100, 76,
   '00000000-0000-4000-8000-0000000000de', null, 'Not contacted', null, null, null, null),
  ('DEMO-0008', 'Kevin', 'Tran', 'TRAN KEVIN', '620 E Example Ave, Anaheim, CA 92805', '620 E Example Ave', 'Anaheim', 'CA', '92805', '000-000-08',
   'DEMO-BLD-0008', current_date - 30, 'Issued', 'Detached ADU 800 sq ft', 160000, 'Detached ADU',
   'No', 'PC-0008', '2018-04-11', 690000, 88, 65, 79,
   '00000000-0000-4000-8000-0000000000de', current_date - 10, 'Do not contact', null, null, null, 'Asked not to be contacted.')
on conflict on constraint leads_apn_permit_unique do nothing;

-- Scan / activity history for the demo leads
update public.leads set qr_scan_count = 2, landing_page_visit_count = 3,
  first_qr_scan_at = now() - interval '3 days', last_qr_scan_at = now() - interval '5 hours'
where lead_code = 'DEMO-0001';

update public.leads set qr_scan_count = 1, landing_page_visit_count = 1,
  first_qr_scan_at = now() - interval '6 days', last_qr_scan_at = now() - interval '6 days'
where lead_code in ('DEMO-0002', 'DEMO-0003', 'DEMO-0005');

insert into public.tracking_events (lead_id, campaign_id, event_type, event_source, created_at, metadata)
select l.id, l.campaign_id, e.event_type, e.event_source, e.created_at, '{}'::jsonb
from public.leads l
join (values
  ('DEMO-0001', 'postcard_sent',      'dashboard', now() - interval '10 days'),
  ('DEMO-0001', 'qr_scan',            'qr',        now() - interval '3 days'),
  ('DEMO-0001', 'landing_page_visit', 'qr',        now() - interval '3 days'),
  ('DEMO-0001', 'qr_scan',            'qr',        now() - interval '5 hours'),
  ('DEMO-0001', 'landing_page_visit', 'qr',        now() - interval '5 hours'),
  ('DEMO-0002', 'postcard_sent',      'dashboard', now() - interval '10 days'),
  ('DEMO-0002', 'qr_scan',            'qr',        now() - interval '6 days'),
  ('DEMO-0002', 'call',               'dashboard', now() - interval '4 days'),
  ('DEMO-0003', 'postcard_sent',      'dashboard', now() - interval '10 days'),
  ('DEMO-0003', 'qr_scan',            'qr',        now() - interval '6 days'),
  ('DEMO-0003', 'call',               'dashboard', now() - interval '5 days'),
  ('DEMO-0003', 'appointment_booked', 'dashboard', now() - interval '5 days'),
  ('DEMO-0004', 'postcard_sent',      'dashboard', now() - interval '10 days'),
  ('DEMO-0005', 'postcard_sent',      'dashboard', now() - interval '10 days'),
  ('DEMO-0005', 'qr_scan',            'qr',        now() - interval '6 days'),
  ('DEMO-0005', 'appointment_booked', 'dashboard', now() - interval '4 days'),
  ('DEMO-0005', 'application_started','dashboard', now() - interval '1 day')
) as e(lead_code, event_type, event_source, created_at) on e.lead_code = l.lead_code;

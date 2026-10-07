-- =====================================================================
-- V1.6 landing-page tracking SELF-TEST (throwaway — changes NOTHING permanently)
-- V1.6 has NO migration. This confirms the existing QR tracking still behaves:
--   • first visit = 1 scan + 1 page visit, status Postcard sent → Scanned QR
--   • refresh within 30 minutes = page visit only (dedupe)
--   • a visit after 30 minutes = new scan
--   • CTA clicks store the lead + the V1.6 button / placement details
--   • unknown / malformed codes are ignored
-- Paste into Supabase → SQL Editor → Run.  Success = "ALL V1.6 TRACKING CHECKS PASSED".
-- =====================================================================

begin;

do $$
declare
  v_camp uuid; v_id uuid; v_code text; v_ok boolean; v_meta jsonb;
begin
  insert into public.campaigns (name, city) values ('ZZ V1.6 TEST', 'Anaheim') returning id into v_camp;
  perform public.import_leads('[{"owner_name_raw":"LP ONE","property_address":"1 Land St","city":"Anaheim","apn":"V16-1","permit_number":"V16-P1"}]'::jsonb, v_camp);
  select id, lead_code into v_id, v_code from public.leads where apn = 'V16-1';
  update public.leads set follow_up_status = 'Postcard sent' where id = v_id;

  -- 1. first visit
  if not public.record_lead_visit(v_code, 'qr', '{}') then raise exception 'CHECK 1 FAILED: visit not recorded'; end if;
  select (qr_scan_count = 1 and landing_page_visit_count = 1 and follow_up_status = 'Scanned QR' and first_qr_scan_at is not null)
    into v_ok from public.leads where id = v_id;
  if not v_ok then raise exception 'CHECK 1 FAILED: first visit counters/status'; end if;

  -- 2. refresh within 30 minutes → visit only (dedupe)
  perform public.record_lead_visit(v_code, 'qr', '{}');
  perform public.record_lead_visit(lower(v_code), 'qr', '{}');   -- lowercase code from a typed URL
  select (qr_scan_count = 1 and landing_page_visit_count = 3) into v_ok from public.leads where id = v_id;
  if not v_ok then raise exception 'CHECK 2 FAILED: 30-minute dedupe changed'; end if;
  if (select count(*) from public.tracking_events where lead_id = v_id and event_type = 'qr_scan') <> 1 then
    raise exception 'CHECK 2 FAILED: duplicate qr_scan events';
  end if;

  -- 3. after 30 minutes → a new scan
  update public.leads set last_qr_scan_at = now() - interval '31 minutes' where id = v_id;
  perform public.record_lead_visit(v_code, 'qr', '{}');
  if (select qr_scan_count from public.leads where id = v_id) <> 2 then raise exception 'CHECK 3 FAILED: scan after 30 min not counted'; end if;

  -- 4. CTA click with V1.6 metadata (what /api/track now sends)
  if not public.record_lead_cta(v_code, 'heloc', '{"button":"start_application","placement":"trust"}'::jsonb) then
    raise exception 'CHECK 4 FAILED: CTA not recorded';
  end if;
  select metadata into v_meta from public.tracking_events where lead_id = v_id and event_type = 'cta_click' order by created_at desc limit 1;
  if v_meta->>'cta' <> 'heloc' or v_meta->>'button' <> 'start_application' or v_meta->>'placement' <> 'trust' then
    raise exception 'CHECK 4 FAILED: CTA metadata %', v_meta;
  end if;
  if (select campaign_id from public.tracking_events where lead_id = v_id and event_type = 'cta_click' limit 1) <> v_camp then
    raise exception 'CHECK 4 FAILED: CTA not attributed to campaign';
  end if;

  -- 5. bad input ignored, never errors
  if public.record_lead_visit('ANA-99999', 'qr', '{}') then raise exception 'CHECK 5 FAILED: unknown code recorded'; end if;
  if public.record_lead_visit('<script>', 'qr', '{}') then raise exception 'CHECK 5 FAILED: malformed code recorded'; end if;
  if public.record_lead_cta(v_code, 'apply', '{}') then raise exception 'CHECK 5 FAILED: unknown CTA category accepted'; end if;
end;
$$;

select 'ALL V1.6 TRACKING CHECKS PASSED (test data rolled back)' as result;

rollback;

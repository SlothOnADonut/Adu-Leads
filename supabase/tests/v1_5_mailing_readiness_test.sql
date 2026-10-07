-- =====================================================================
-- V1.5 mailing-readiness SELF-TEST (throwaway — changes NOTHING permanently)
-- Paste into Supabase → SQL Editor → Run, AFTER the V1.5 migration.
-- Success = "ALL V1.5 CHECKS PASSED". Everything is rolled back.
-- =====================================================================

begin;

create temp table _v15_before on commit drop as
select
  (select count(*) from public.leads) as leads,
  (select count(*) from public.campaigns) as campaigns,
  (select md5(coalesce(string_agg(
      l.id::text || l.lead_code || l.follow_up_status || coalesce(l.notes, '') || l.qr_scan_count
      || l.property_image_status || coalesce(l.property_image_url, '') || l.postcard_status
      || coalesce(l.mailing_address, ''), '|' order by l.id), ''))
     from public.leads l join public.campaigns c on c.id = l.campaign_id
    where c.name = 'Anaheim ADU – Wave 1') as wave1;

do $$
declare
  v_camp uuid; v1 uuid; v2 uuid; v3 uuid; v4 uuid;
  c1 text; c2 text; c3 text; c4 text;
  v_ok boolean; v_b record; v_res jsonb;
begin
  select * into v_b from _v15_before;

  insert into public.campaigns (name, city) values ('ZZ V1.5 TEST', 'Anaheim') returning id into v_camp;
  perform public.import_leads('[
    {"owner_name_raw":"MAIL ONE",  "mailing_address":"10 Mail Rd, Anaheim, CA 92801",  "property_address":"1 Prop St", "city":"Anaheim", "apn":"V15-1", "permit_number":"V15-P1"},
    {"owner_name_raw":"MAIL TWO",                                                         "property_address":"2 Prop St", "city":"Anaheim", "apn":"V15-2", "permit_number":"V15-P2"},
    {"owner_name_raw":"MAIL THREE","mailing_address":"30 Mail Rd, Anaheim CA 92805",     "property_address":"3 Prop St", "city":"Anaheim", "apn":"V15-3", "permit_number":"V15-P3"},
    {"owner_name_raw":"MAIL FOUR", "mailing_address":"PO Box 4, Irvine, CA 92618-1234", "property_address":"4 Prop St", "city":"Anaheim", "apn":"V15-4", "permit_number":"V15-P4"}
  ]'::jsonb, v_camp);
  select id, lead_code into v1, c1 from public.leads where apn = 'V15-1';
  select id, lead_code into v2, c2 from public.leads where apn = 'V15-2';
  select id, lead_code into v3, c3 from public.leads where apn = 'V15-3';
  select id, lead_code into v4, c4 from public.leads where apn = 'V15-4';

  -- parsing sanity
  select (mailing_street = '10 Mail Rd' and mailing_city = 'Anaheim' and mailing_state = 'CA' and mailing_zip = '92801' and mailing_complete)
    into v_ok from public.leads where id = v1;
  if not v_ok then raise exception 'SETUP FAILED: mailing address not parsed for lead 1'; end if;
  select (mailing_city = 'Anaheim' and mailing_zip = '92805') into v_ok from public.leads where id = v3;
  if not v_ok then raise exception 'SETUP FAILED: "City ST ZIP" format not parsed'; end if;
  select (mailing_street = 'PO Box 4' and mailing_zip = '92618-1234') into v_ok from public.leads where id = v4;
  if not v_ok then raise exception 'SETUP FAILED: PO Box / ZIP+4 not parsed'; end if;

  -- images: 1, 2, 4 approved; 3 left missing
  perform public.set_property_image(v1, 'set_url', 'https://example.com/1.jpg', 'manual'); perform public.set_property_image(v1, 'approve');
  perform public.set_property_image(v2, 'set_url', 'https://example.com/2.jpg', 'manual'); perform public.set_property_image(v2, 'approve');
  perform public.set_property_image(v4, 'set_url', 'https://example.com/4.jpg', 'manual'); perform public.set_property_image(v4, 'approve');

  -- CHECK 1: approved image + full mailing = ready
  if (select postcard_status from public.leads where id = v1) <> 'ready' then raise exception 'CHECK 1 FAILED: lead 1 should be ready'; end if;

  -- CHECK 2: approved image + missing mailing = NOT ready (property address is NOT used as mailing)
  select (postcard_status = 'not_ready' and not mailing_complete and mailing_street is null and mailing_address is null)
    into v_ok from public.leads where id = v2;
  if not v_ok then raise exception 'CHECK 2 FAILED: lead without mailing info must be not_ready'; end if;
  -- partial mailing (no ZIP) is still not ready
  update public.leads set mailing_street = '2 Mail Rd', mailing_city = 'Anaheim', mailing_state = 'CA' where id = v2;
  if (select postcard_status from public.leads where id = v2) <> 'not_ready' then raise exception 'CHECK 2b FAILED: partial mailing info counted as ready'; end if;

  -- CHECK 3: full mailing + missing / unreviewed image = NOT ready
  if (select postcard_status from public.leads where id = v3) <> 'not_ready' then raise exception 'CHECK 3 FAILED: missing image lead is ready'; end if;
  perform public.set_property_image(v3, 'set_url', 'https://example.com/3.jpg', 'manual');
  if (select postcard_status from public.leads where id = v3) <> 'not_ready' then raise exception 'CHECK 3b FAILED: needs_review image lead is ready'; end if;

  -- CHECK 4: cannot approve with incomplete mailing info
  begin
    perform public.approve_postcard(v2);
    raise exception 'CHECK 4 FAILED: approved with incomplete mailing info';
  exception when others then
    if sqlerrm like 'CHECK 4%' then raise; end if;
    if sqlerrm not like '%Missing mailing information%' then raise exception 'CHECK 4 FAILED: wrong error: %', sqlerrm; end if;
  end;
  -- …and a plain UPDATE can't sneak an approval in
  update public.leads set postcard_status = 'approved', postcard_approved_at = now(), postcard_approved_image_url = 'x' where id = v2;
  if (select postcard_status from public.leads where id = v2) <> 'not_ready' then raise exception 'CHECK 4b FAILED'; end if;
  -- completing the mailing info makes it ready (not approved)
  update public.leads set mailing_zip = '92801' where id = v2;
  if (select postcard_status from public.leads where id = v2) <> 'ready' then raise exception 'CHECK 4c FAILED: completed mailing should be ready'; end if;
  if (select mailing_address from public.leads where id = v2) <> '2 Mail Rd, Anaheim, CA 92801' then raise exception 'CHECK 4d FAILED: mailing_address text not rebuilt'; end if;

  -- CHECK 5: each mailing field change invalidates approval
  perform public.approve_postcard(v1);
  update public.leads set mailing_zip = '92802' where id = v1;
  if (select postcard_status from public.leads where id = v1) <> 'ready' then raise exception 'CHECK 5a FAILED: ZIP change kept approval'; end if;
  perform public.approve_postcard(v1);
  update public.leads set mailing_name = 'Mr. & Mrs. One' where id = v1;
  if (select postcard_status from public.leads where id = v1) <> 'ready' then raise exception 'CHECK 5b FAILED: recipient name change kept approval'; end if;
  perform public.approve_postcard(v1);
  update public.leads set mailing_city = 'Fullerton' where id = v1;
  if (select postcard_status from public.leads where id = v1) <> 'ready' then raise exception 'CHECK 5c FAILED: city change kept approval'; end if;
  perform public.approve_postcard(v1);
  update public.leads set mailing_state = 'NV' where id = v1;
  if (select postcard_status from public.leads where id = v1) <> 'ready' then raise exception 'CHECK 5d FAILED: state change kept approval'; end if;
  perform public.approve_postcard(v1);
  perform public.import_leads('[{"apn":"V15-1","permit_number":"V15-P1","mailing_address":"11 New Mail Rd, Anaheim, CA 92801"}]'::jsonb, null);
  select (postcard_status = 'ready' and mailing_street = '11 New Mail Rd') into v_ok from public.leads where id = v1;
  if not v_ok then raise exception 'CHECK 5e FAILED: street change via re-import kept approval'; end if;
  perform public.approve_postcard(v1);
  update public.leads set first_name = 'Changed' where id = v1;  -- mailing_name overrides, so printed name is unchanged
  if (select postcard_status from public.leads where id = v1) <> 'approved' then raise exception 'CHECK 5f FAILED: non-printed name change invalidated approval'; end if;
  -- unrelated changes do NOT invalidate
  update public.leads set notes = 'called', call_status = 'Spoke', follow_up_status = 'Postcard sent',
                          next_follow_up_date = current_date, property_address = '1 Prop Street', job_valuation = 1 where id = v1;
  insert into public.tracking_events (lead_id, campaign_id, event_type, event_source) values (v1, v_camp, 'call', 'test');
  perform public.record_lead_visit(c1, 'qr', '{}');
  select (postcard_status = 'approved' and qr_scan_count = 1 and follow_up_status = 'Scanned QR') into v_ok from public.leads where id = v1;
  if not v_ok then raise exception 'CHECK 5g FAILED: unrelated edits/scan changed approval'; end if;

  -- CHECK 6: replacing the approved image invalidates approval
  perform public.set_property_image(v1, 'set_url', 'https://example.com/1-new.jpg', 'manual', null, true);
  select (postcard_status = 'not_ready' and postcard_approved_at is null) into v_ok from public.leads where id = v1;
  if not v_ok then raise exception 'CHECK 6 FAILED: image replacement kept approval'; end if;
  perform public.set_property_image(v1, 'approve');
  if (select postcard_status from public.leads where id = v1) <> 'ready' then raise exception 'CHECK 6b FAILED: re-approved image should be ready, not approved'; end if;

  -- CHECK 7: QR / lead codes unchanged and lead-specific
  if (select lead_code from public.leads where id = v1) <> c1 or (select lead_code from public.leads where id = v2) <> c2
     or (select lead_code from public.leads where id = v3) <> c3 or (select lead_code from public.leads where id = v4) <> c4 then
    raise exception 'CHECK 7 FAILED: a lead code changed';
  end if;
  if (select count(distinct lead_code) from public.leads where campaign_id = v_camp) <> 4 then raise exception 'CHECK 7 FAILED: codes not unique'; end if;
  perform public.record_lead_visit(c4, 'qr', '{}');
  if (select qr_scan_count from public.leads where id = v4) <> 1 or (select qr_scan_count from public.leads where id = v2) <> 0 then
    raise exception 'CHECK 7 FAILED: scan landed on the wrong lead';
  end if;

  -- CHECK 8: Do Not Contact excluded from export/print candidates
  perform public.approve_postcard(v1);
  perform public.approve_postcard(v4);
  update public.leads set follow_up_status = 'Do not contact' where id = v4;
  if not exists (select 1 from public.postcard_export_candidates where id = v1) then raise exception 'CHECK 8 FAILED: approved lead missing from export'; end if;
  if exists (select 1 from public.postcard_export_candidates where id = v4) then raise exception 'CHECK 8 FAILED: Do-not-contact lead exported'; end if;
  if exists (select 1 from public.postcard_export_candidates where id in (v2, v3)) then raise exception 'CHECK 8 FAILED: non-approved lead exported'; end if;

  -- CHECK 9: archive / delete behavior unaffected
  update public.campaigns set archived_at = now() where id = v_camp;
  select (postcard_status = 'approved') into v_ok from public.leads where id = v1;
  if not v_ok or (select count(*) from public.leads where campaign_id = v_camp) <> 4 then raise exception 'CHECK 9 FAILED: archive changed leads'; end if;
  update public.campaigns set archived_at = null where id = v_camp;
  v_res := public.delete_leads(array[v3], 'DELETE');
  if (v_res->>'leads_deleted')::int <> 1 or exists (select 1 from public.leads where id = v3) then raise exception 'CHECK 9 FAILED: delete_leads'; end if;
  v_res := public.delete_campaign_permanently(v_camp, 'DELETE');
  if (v_res->>'leads_deleted')::int <> 3 or exists (select 1 from public.leads where campaign_id = v_camp)
     or exists (select 1 from public.tracking_events where campaign_id = v_camp) then
    raise exception 'CHECK 9 FAILED: campaign delete: %', v_res;
  end if;

  -- Wave 1 untouched
  if (select count(*) from public.leads) <> v_b.leads or (select count(*) from public.campaigns) <> v_b.campaigns then
    raise exception 'CHECK 9 FAILED: counts changed outside the test campaign';
  end if;
  if (select md5(coalesce(string_agg(
        l.id::text || l.lead_code || l.follow_up_status || coalesce(l.notes, '') || l.qr_scan_count
        || l.property_image_status || coalesce(l.property_image_url, '') || l.postcard_status
        || coalesce(l.mailing_address, ''), '|' order by l.id), ''))
      from public.leads l join public.campaigns c on c.id = l.campaign_id
     where c.name = 'Anaheim ADU – Wave 1') is distinct from v_b.wave1 then
    raise exception 'CHECK 9 FAILED: Wave 1 changed';
  end if;
end;
$$;

select 'ALL V1.5 CHECKS PASSED (test data rolled back)' as result;

rollback;

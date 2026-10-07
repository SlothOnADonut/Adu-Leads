-- =====================================================================
-- V1.2 property-image SELF-TEST (throwaway — changes NOTHING permanently)
--
-- Paste into Supabase → SQL Editor → Run, AFTER running the V1.2 migration.
-- Runs inside a transaction that is rolled back at the end.
--
-- Success = "ALL V1.2 PROPERTY-IMAGE CHECKS PASSED".
-- A failure stops with an error naming the check.
-- =====================================================================

begin;

create temp table _v12_before on commit drop as
select
  (select count(*) from public.leads) as leads,
  (select md5(coalesce(string_agg(
      l.id::text || l.lead_code || l.follow_up_status || coalesce(l.notes, '') || l.qr_scan_count
      || coalesce(l.next_follow_up_date::text, '') || l.property_image_status, '|' order by l.id), ''))
     from public.leads l join public.campaigns c on c.id = l.campaign_id
    where c.name = 'Anaheim ADU – Wave 1') as wave1_fingerprint,
  (select count(*) from public.tracking_events) as events;

do $$
declare
  v_camp uuid;
  v1 uuid; v2 uuid; v3 uuid;
  v_code1 text;
  v_res jsonb;
  v_b record;
  v_ok boolean;
begin
  select * into v_b from _v12_before;

  insert into public.campaigns (name, city) values ('ZZ IMAGE TEST', 'Testville') returning id into v_camp;
  perform public.import_leads('[
    {"owner_name_raw":"IMG ONE",   "property_address":"1 Img St", "city":"Testville", "apn":"IMG-APN-1", "permit_number":"IMG-P-1"},
    {"owner_name_raw":"IMG TWO",   "property_address":"2 Img St", "city":"Testville", "apn":"IMG-APN-2", "permit_number":"IMG-P-2"},
    {"owner_name_raw":"IMG THREE", "property_address":"3 Img St", "city":"Testville", "apn":"IMG-APN-3", "permit_number":"IMG-P-3"}
  ]'::jsonb, v_camp);
  select id, lead_code into v1, v_code1 from public.leads where apn = 'IMG-APN-1';
  select id into v2 from public.leads where apn = 'IMG-APN-2';
  select id into v3 from public.leads where apn = 'IMG-APN-3';

  -- CHECK 1: new leads start as missing, not ready
  if (select count(*) from public.leads where campaign_id = v_camp and property_image_status = 'missing' and not postcard_image_ready) <> 3 then
    raise exception 'CHECK 1 FAILED: new leads should be missing / not ready';
  end if;

  -- CHECK 2: cannot approve without an image
  begin
    perform public.set_property_image(v3, 'approve');
    raise exception 'CHECK 2 FAILED: approved a lead with no image';
  exception when others then
    if sqlerrm like 'CHECK 2%' then raise; end if;
  end;

  -- CHECK 3: manual URL → source manual, status needs_review
  v_res := public.set_property_image(v1, 'set_url', 'https://example.com/house1.jpg', 'manual');
  if v_res->>'status' <> 'needs_review' or v_res->>'source' <> 'manual' then raise exception 'CHECK 3 FAILED: %', v_res; end if;

  -- CHECK 4: approve → ready
  v_res := public.set_property_image(v1, 'approve');
  if v_res->>'status' <> 'approved' or (v_res->>'postcard_image_ready')::boolean is not true then raise exception 'CHECK 4 FAILED: %', v_res; end if;

  -- CHECK 5: approved image is locked against set_url without Replace …
  begin
    perform public.set_property_image(v1, 'set_url', 'https://example.com/OTHER.jpg', 'provider_x');
    raise exception 'CHECK 5 FAILED: approved image was replaced without Replace';
  exception when others then
    if sqlerrm like 'CHECK 5%' then raise; end if;
  end;
  -- … and against a raw UPDATE (e.g. a future script or import)
  begin
    update public.leads set property_image_url = 'https://example.com/SNEAKY.jpg' where id = v1;
    raise exception 'CHECK 5b FAILED: raw update changed an approved image';
  exception when others then
    if sqlerrm like 'CHECK 5b%' then raise; end if;
  end;
  if (select property_image_url from public.leads where id = v1) <> 'https://example.com/house1.jpg' then
    raise exception 'CHECK 5c FAILED: approved URL changed';
  end if;

  -- CHECK 6: reject lead 2's image
  perform public.set_property_image(v2, 'set_url', 'https://example.com/wrong-house.jpg', 'manual');
  v_res := public.set_property_image(v2, 'reject', null, null, 'Wrong house');
  if v_res->>'status' <> 'rejected' or (v_res->>'postcard_image_ready')::boolean then raise exception 'CHECK 6 FAILED: %', v_res; end if;

  -- CHECK 7: campaign counts (1 approved, 1 rejected, 1 missing; 1/3 ready)
  if (select count(*) filter (where property_image_status = 'approved') from public.leads where campaign_id = v_camp) <> 1
  or (select count(*) filter (where property_image_status = 'rejected') from public.leads where campaign_id = v_camp) <> 1
  or (select count(*) filter (where property_image_status = 'missing')  from public.leads where campaign_id = v_camp) <> 1
  or (select count(*) filter (where postcard_image_ready)               from public.leads where campaign_id = v_camp) <> 1 then
    raise exception 'CHECK 7 FAILED: campaign image counts wrong';
  end if;

  -- CHECK 8: re-import does not touch images, notes or status
  update public.leads set notes = 'keep me', follow_up_status = 'Contacted' where id = v1;
  perform public.import_leads('[{"apn":"IMG-APN-1","permit_number":"IMG-P-1","job_valuation":123456}]'::jsonb, null);
  select (property_image_status = 'approved' and property_image_url = 'https://example.com/house1.jpg'
          and notes = 'keep me' and follow_up_status = 'Contacted' and job_valuation = 123456)
    into v_ok from public.leads where id = v1;
  if not v_ok then raise exception 'CHECK 8 FAILED: re-import changed protected fields'; end if;

  -- CHECK 9: explicit Replace works and returns to needs_review
  v_res := public.set_property_image(v1, 'set_url', 'https://example.com/house1-better.jpg', 'manual', null, true);
  if v_res->>'status' <> 'needs_review' then raise exception 'CHECK 9 FAILED: %', v_res; end if;
  perform public.set_property_image(v1, 'approve');

  -- CHECK 10: QR tracking still works and leaves images alone
  update public.leads set follow_up_status = 'Postcard sent' where id = v3;
  if not public.record_lead_visit((select lead_code from public.leads where id = v1), 'qr', '{}') then
    raise exception 'CHECK 10 FAILED: visit not recorded';
  end if;
  perform public.record_lead_visit((select lead_code from public.leads where id = v3), 'qr', '{}');
  select (qr_scan_count = 1 and property_image_status = 'approved') into v_ok from public.leads where id = v1;
  if not v_ok then raise exception 'CHECK 10 FAILED: lead 1 after scan'; end if;
  select (qr_scan_count = 1 and follow_up_status = 'Scanned QR' and property_image_status = 'missing') into v_ok from public.leads where id = v3;
  if not v_ok then raise exception 'CHECK 10 FAILED: lead 3 after scan'; end if;

  -- CHECK 11: Wave 1 untouched
  if (select md5(coalesce(string_agg(
        l.id::text || l.lead_code || l.follow_up_status || coalesce(l.notes, '') || l.qr_scan_count
        || coalesce(l.next_follow_up_date::text, '') || l.property_image_status, '|' order by l.id), ''))
      from public.leads l join public.campaigns c on c.id = l.campaign_id
     where c.name = 'Anaheim ADU – Wave 1') is distinct from v_b.wave1_fingerprint then
    raise exception 'CHECK 11 FAILED: Wave 1 data changed';
  end if;
  if (select count(*) from public.leads) <> v_b.leads + 3 then raise exception 'CHECK 11 FAILED: unexpected lead count'; end if;
end;
$$;

select 'ALL V1.2 PROPERTY-IMAGE CHECKS PASSED (test data rolled back)' as result;

rollback;

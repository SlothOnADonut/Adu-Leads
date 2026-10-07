-- =====================================================================
-- V1.4 postcard SELF-TEST (throwaway — changes NOTHING permanently)
-- Paste into Supabase → SQL Editor → Run, AFTER the V1.4 migration.
-- Success = "ALL V1.4 POSTCARD CHECKS PASSED". Everything is rolled back.
-- =====================================================================

begin;

create temp table _v14_before on commit drop as
select
  (select count(*) from public.leads) as leads,
  (select md5(coalesce(string_agg(
      l.id::text || l.lead_code || l.follow_up_status || coalesce(l.notes, '') || l.qr_scan_count
      || l.property_image_status || coalesce(l.property_image_url, '') || l.postcard_status, '|' order by l.id), ''))
     from public.leads l join public.campaigns c on c.id = l.campaign_id
    where c.name = 'Anaheim ADU – Wave 1') as wave1;

do $$
declare
  v_camp uuid; v1 uuid; v2 uuid; v3 uuid;
  v_res jsonb; v_ok boolean; v_b record;
begin
  select * into v_b from _v14_before;

  insert into public.campaigns (name, city) values ('ZZ POSTCARD TEST', 'Anaheim') returning id into v_camp;
  perform public.import_leads('[
    {"owner_name_raw":"PC ONE",   "property_address":"1 Card St", "city":"Anaheim", "apn":"PC-APN-1", "permit_number":"PC-P-1"},
    {"owner_name_raw":"PC TWO",   "property_address":"2 Card St", "city":"Anaheim", "apn":"PC-APN-2", "permit_number":"PC-P-2"},
    {"owner_name_raw":"PC THREE", "property_address":"3 Card St", "city":"Anaheim", "apn":"PC-APN-3", "permit_number":"PC-P-3"}
  ]'::jsonb, v_camp);
  select id into v1 from public.leads where apn = 'PC-APN-1';
  select id into v2 from public.leads where apn = 'PC-APN-2';
  select id into v3 from public.leads where apn = 'PC-APN-3';

  -- CHECK 1: new leads are not_ready
  if (select count(*) from public.leads where campaign_id = v_camp and postcard_status = 'not_ready') <> 3 then
    raise exception 'CHECK 1 FAILED: new leads should be not_ready';
  end if;

  -- lead 1 approved image, lead 2 missing, lead 3 rejected
  perform public.set_property_image(v1, 'set_url', 'https://example.com/one.jpg', 'manual');
  if (select postcard_status from public.leads where id = v1) <> 'not_ready' then raise exception 'CHECK 2 FAILED: needs_review image must be not_ready'; end if;
  perform public.set_property_image(v1, 'approve');
  perform public.set_property_image(v3, 'set_url', 'https://example.com/three.jpg', 'manual');
  perform public.set_property_image(v3, 'reject');

  -- CHECK 3: only the approved-image lead is ready
  if (select postcard_status from public.leads where id = v1) <> 'ready' then raise exception 'CHECK 3 FAILED: lead 1 should be ready'; end if;
  if (select postcard_status from public.leads where id = v2) <> 'not_ready' then raise exception 'CHECK 3 FAILED: missing lead should be not_ready'; end if;
  if (select postcard_status from public.leads where id = v3) <> 'not_ready' then raise exception 'CHECK 3 FAILED: rejected lead should be not_ready'; end if;

  -- CHECK 4: missing / rejected cannot be approved
  begin
    perform public.approve_postcard(v2);
    raise exception 'CHECK 4 FAILED: approved postcard for missing image';
  exception when others then if sqlerrm like 'CHECK 4%' then raise; end if; end;
  begin
    perform public.approve_postcard(v3);
    raise exception 'CHECK 4b FAILED: approved postcard for rejected image';
  exception when others then if sqlerrm like 'CHECK 4b%' then raise; end if; end;

  -- CHECK 5: no automatic / sneaky approval via plain UPDATE
  update public.leads set postcard_status = 'approved', postcard_approved_at = now(), postcard_approved_image_url = 'x' where id = v1;
  if (select postcard_status from public.leads where id = v1) <> 'ready' then raise exception 'CHECK 5 FAILED: plain update approved a postcard'; end if;

  -- CHECK 6: stale preview refused
  begin
    perform public.approve_postcard(v1, 'approve', 'https://example.com/OLD.jpg');
    raise exception 'CHECK 6 FAILED: approved with a stale image';
  exception when others then if sqlerrm like 'CHECK 6%' then raise; end if; end;

  -- CHECK 7: real approval
  v_res := public.approve_postcard(v1, 'approve', 'https://example.com/one.jpg');
  if v_res->>'postcard_status' <> 'approved' then raise exception 'CHECK 7 FAILED: %', v_res; end if;
  if (select postcard_approved_image_url from public.leads where id = v1) <> 'https://example.com/one.jpg' then raise exception 'CHECK 7 FAILED: snapshot'; end if;

  -- CHECK 8: unrelated edits keep approval (notes, status, follow-up, scans)
  update public.leads set notes = 'called', follow_up_status = 'Postcard sent', next_follow_up_date = current_date where id = v1;
  perform public.record_lead_visit((select lead_code from public.leads where id = v1), 'qr', '{}');
  select (postcard_status = 'approved' and qr_scan_count = 1 and follow_up_status = 'Scanned QR') into v_ok from public.leads where id = v1;
  if not v_ok then raise exception 'CHECK 8 FAILED: unrelated edit/scan changed approval or QR tracking broke'; end if;

  -- CHECK 9: replacing the image invalidates the approval
  perform public.set_property_image(v1, 'set_url', 'https://example.com/one-NEW.jpg', 'manual', null, true);
  select (postcard_status = 'not_ready' and postcard_approved_at is null) into v_ok from public.leads where id = v1;
  if not v_ok then raise exception 'CHECK 9 FAILED: replaced image kept postcard approval'; end if;
  perform public.set_property_image(v1, 'approve');
  if (select postcard_status from public.leads where id = v1) <> 'ready' then raise exception 'CHECK 9b FAILED: re-approved image should be ready, not approved'; end if;

  -- CHECK 10: address change after approval → back to ready
  perform public.approve_postcard(v1);
  update public.leads set mailing_address = '99 Changed Ave' where id = v1;
  if (select postcard_status from public.leads where id = v1) <> 'ready' then raise exception 'CHECK 10 FAILED: address change kept approval'; end if;

  -- CHECK 11: un-approving image → not_ready
  perform public.approve_postcard(v1);
  perform public.set_property_image(v1, 'needs_review');
  if (select postcard_status from public.leads where id = v1) <> 'not_ready' then raise exception 'CHECK 11 FAILED'; end if;

  -- CHECK 12: Wave 1 untouched
  if (select md5(coalesce(string_agg(
        l.id::text || l.lead_code || l.follow_up_status || coalesce(l.notes, '') || l.qr_scan_count
        || l.property_image_status || coalesce(l.property_image_url, '') || l.postcard_status, '|' order by l.id), ''))
      from public.leads l join public.campaigns c on c.id = l.campaign_id
     where c.name = 'Anaheim ADU – Wave 1') is distinct from v_b.wave1 then
    raise exception 'CHECK 12 FAILED: Wave 1 changed';
  end if;
  if (select count(*) from public.leads) <> v_b.leads + 3 then raise exception 'CHECK 12 FAILED: lead count'; end if;
end;
$$;

select 'ALL V1.4 POSTCARD CHECKS PASSED (test data rolled back)' as result;

rollback;

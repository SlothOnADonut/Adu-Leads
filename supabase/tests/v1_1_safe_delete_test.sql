-- =====================================================================
-- V1.1 safe-delete SELF-TEST (throwaway — changes NOTHING permanently)
--
-- Paste into Supabase → SQL Editor → Run, AFTER running the V1.1 migration.
-- Everything runs inside a transaction that is rolled back at the end,
-- so the test campaign, leads and events never actually stay in your data.
--
-- Success = the final result shows  "ALL V1.1 SAFE-DELETE CHECKS PASSED".
-- Any failure stops with an error that says which check failed.
-- =====================================================================

begin;

create temp table _before on commit drop as
select
  (select count(*) from public.campaigns)        as campaigns,
  (select count(*) from public.leads)            as leads,
  (select count(*) from public.tracking_events)  as events,
  (select count(*) from public.leads l join public.campaigns c on c.id = l.campaign_id
     where c.name = 'Anaheim ADU – Wave 1')       as wave1_leads,
  (select count(*) from public.tracking_events e join public.leads l on l.id = e.lead_id
     join public.campaigns c on c.id = l.campaign_id
     where c.name = 'Anaheim ADU – Wave 1')       as wave1_events;

do $$
declare
  v_camp   uuid;
  v_ids    uuid[];
  v_res    jsonb;
  v_prev   jsonb;
  v_b      record;
begin
  select * into v_b from _before;

  -- 1. temporary campaign + 3 leads through the real import function
  insert into public.campaigns (name, city, notes)
  values ('ZZ TEST – delete me', 'Testville', 'V1.1 self-test')
  returning id into v_camp;

  v_res := public.import_leads('[
    {"owner_name_raw":"TEST ONE",   "property_address":"1 Test St", "city":"Testville", "apn":"TEST-APN-1", "permit_number":"TEST-P-1"},
    {"owner_name_raw":"TEST TWO",   "property_address":"2 Test St", "city":"Testville", "apn":"TEST-APN-2", "permit_number":"TEST-P-2"},
    {"owner_name_raw":"TEST THREE", "property_address":"3 Test St", "city":"Testville", "apn":"TEST-APN-3", "permit_number":"TEST-P-3"}
  ]'::jsonb, v_camp);
  if (v_res->>'inserted')::int <> 3 then raise exception 'CHECK 1 FAILED: expected 3 imported, got %', v_res; end if;

  select array_agg(id order by apn) into v_ids from public.leads where campaign_id = v_camp;

  -- give each test lead some history
  insert into public.tracking_events (lead_id, campaign_id, event_type, event_source)
  select id, v_camp, 'qr_scan', 'test' from public.leads where campaign_id = v_camp;
  update public.leads set qr_scan_count = 1, notes = 'test note' where campaign_id = v_camp;

  -- 2. delete ONE selected lead
  v_res := public.delete_leads(array[v_ids[1]], 'DELETE');
  if (v_res->>'leads_deleted')::int <> 1 then raise exception 'CHECK 2 FAILED: %', v_res; end if;
  if exists (select 1 from public.leads where id = v_ids[1]) then raise exception 'CHECK 2 FAILED: lead still exists'; end if;
  if exists (select 1 from public.tracking_events where lead_id = v_ids[1]) then raise exception 'CHECK 2 FAILED: its events remain'; end if;
  if (select count(*) from public.leads where campaign_id = v_camp) <> 2 then raise exception 'CHECK 2 FAILED: other test leads were affected'; end if;

  -- wrong confirmation text must be refused
  begin
    perform public.delete_leads(array[v_ids[2]], 'delete');
    raise exception 'CHECK 3 FAILED: lowercase confirmation was accepted';
  exception when others then
    if sqlerrm like 'CHECK 3%' then raise; end if;
  end;
  if not exists (select 1 from public.leads where id = v_ids[2]) then raise exception 'CHECK 3 FAILED: lead deleted without DELETE'; end if;

  -- 3. archive → nothing deleted
  update public.campaigns set archived_at = now() where id = v_camp;
  if (select count(*) from public.leads where campaign_id = v_camp) <> 2 then raise exception 'CHECK 4 FAILED: archive removed leads'; end if;
  if (select count(*) from public.tracking_events where lead_id = any(v_ids)) <> 2 then raise exception 'CHECK 4 FAILED: archive removed events'; end if;

  -- 4. restore
  update public.campaigns set archived_at = null where id = v_camp;
  if (select archived_at from public.campaigns where id = v_camp) is not null then raise exception 'CHECK 5 FAILED: restore'; end if;

  -- 5. preview counts
  v_prev := public.campaign_deletion_preview(v_camp);
  if (v_prev->>'lead_count')::int <> 2 or (v_prev->>'event_count')::int <> 2 or (v_prev->>'scan_count')::int <> 2 then
    raise exception 'CHECK 6 FAILED: preview %', v_prev;
  end if;

  -- 6. permanent delete
  v_res := public.delete_campaign_permanently(v_camp, 'DELETE');
  if (v_res->>'leads_deleted')::int <> 2 or (v_res->>'events_deleted')::int <> 2 then raise exception 'CHECK 7 FAILED: %', v_res; end if;
  if exists (select 1 from public.campaigns where id = v_camp) then raise exception 'CHECK 7 FAILED: campaign remains'; end if;
  if exists (select 1 from public.leads where id = any(v_ids)) then raise exception 'CHECK 7 FAILED: leads remain'; end if;
  if exists (select 1 from public.tracking_events where lead_id = any(v_ids) or campaign_id = v_camp) then raise exception 'CHECK 7 FAILED: events remain'; end if;

  -- 7. everything else untouched
  if (select count(*) from public.campaigns) <> v_b.campaigns then raise exception 'CHECK 8 FAILED: campaign count changed'; end if;
  if (select count(*) from public.leads) <> v_b.leads then raise exception 'CHECK 8 FAILED: lead count changed'; end if;
  if (select count(*) from public.tracking_events) <> v_b.events then raise exception 'CHECK 8 FAILED: event count changed'; end if;
  if (select count(*) from public.leads l join public.campaigns c on c.id = l.campaign_id where c.name = 'Anaheim ADU – Wave 1') <> v_b.wave1_leads
    then raise exception 'CHECK 8 FAILED: Wave 1 leads changed'; end if;
  if (select count(*) from public.tracking_events e join public.leads l on l.id = e.lead_id join public.campaigns c on c.id = l.campaign_id where c.name = 'Anaheim ADU – Wave 1') <> v_b.wave1_events
    then raise exception 'CHECK 8 FAILED: Wave 1 events changed'; end if;
end;
$$;

select 'ALL V1.1 SAFE-DELETE CHECKS PASSED (test data rolled back)' as result;

rollback;

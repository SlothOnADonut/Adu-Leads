-- =====================================================================
-- V1.6.2 public-token SELF-TEST (throwaway — changes NOTHING permanently)
-- Paste into Supabase → SQL Editor → Run, AFTER the V1.6.2 migration.
-- Success = "ALL V1.6.2 PUBLIC-TOKEN CHECKS PASSED". Everything is rolled back.
-- =====================================================================

begin;

do $$
declare
  v_camp uuid; v1 uuid; v2 uuid; t1 text; t2 text; c1 text; c2 text;
  v_ok boolean; v_n int; v_meta jsonb; v_mut text; v_ch text;
  v_tokens text[];
begin
  -- CHECK 1: every existing lead has a unique, well-formed token
  if exists (select 1 from public.leads where public_token is null) then raise exception 'CHECK 1 FAILED: null token'; end if;
  if (select count(*) from public.leads) <> (select count(distinct public_token) from public.leads) then raise exception 'CHECK 1 FAILED: duplicate tokens'; end if;
  if exists (select 1 from public.leads where public_token !~ '^[A-Za-z0-9_-]{16}$') then raise exception 'CHECK 1 FAILED: bad format'; end if;
  if (select attnotnull from pg_attribute where attrelid = 'public.leads'::regclass and attname = 'public_token') is not true then
    raise exception 'CHECK 1 FAILED: column allows NULL';
  end if;

  -- CHECK 2: duplicate tokens are rejected (unique index) and tokens can't be changed
  if not exists (select 1 from pg_index where indexrelid = 'public.leads_public_token_key'::regclass and indisunique) then
    raise exception 'CHECK 2 FAILED: no unique index on public_token';
  end if;

  -- set up a test campaign through the real import path (signed-in user path)
  insert into public.campaigns (name, city) values ('ZZ V1.6.2 TEST', 'Anaheim') returning id into v_camp;
  perform public.import_leads('[
    {"owner_name_raw":"TOKEN OWNER ONE","mailing_address":"10 Secret Mail Rd, Anaheim, CA 92801","property_address":"1 Secret Prop St","city":"Anaheim","apn":"TK-1","permit_number":"TK-P1"},
    {"owner_name_raw":"TOKEN OWNER TWO","mailing_address":"20 Secret Mail Rd, Anaheim, CA 92801","property_address":"2 Secret Prop St","city":"Anaheim","apn":"TK-2","permit_number":"TK-P2"}
  ]'::jsonb, v_camp);
  select id, public_token, lead_code into v1, t1, c1 from public.leads where apn = 'TK-1';
  select id, public_token, lead_code into v2, t2, c2 from public.leads where apn = 'TK-2';

  -- CHECK 3: new leads get tokens automatically
  if t1 is null or t2 is null or t1 = t2 then raise exception 'CHECK 3 FAILED: new leads missing/duplicate tokens'; end if;

  begin
    update public.leads set public_token = t2 where id = v1;
    raise exception 'CHECK 2b FAILED: token changed to another lead''s token';
  exception when others then if sqlerrm like 'CHECK 2b%' then raise; end if; end;
  begin
    update public.leads set public_token = 'AAAAAAAAAAAAAAAA' where id = v1;
    raise exception 'CHECK 2c FAILED: token could be changed';
  exception when others then if sqlerrm like 'CHECK 2c%' then raise; end if; end;
  -- a caller can't choose a token on insert either (database always issues it)
  insert into public.leads (apn, permit_number, city, public_token) values ('TK-3', 'TK-P3', 'Anaheim', t1);
  if (select public_token from public.leads where apn = 'TK-3') = t1 then raise exception 'CHECK 2d FAILED: caller-supplied duplicate token accepted'; end if;

  -- CHECK 4: tokens are random / non-sequential
  select array_agg(public.new_public_token()) into v_tokens from generate_series(1, 300);
  if (select count(distinct t) from unnest(v_tokens) t) <> 300 then raise exception 'CHECK 4 FAILED: repeats in 300 tokens'; end if;
  if (select count(distinct left(t, 1)) from unnest(v_tokens) t) < 40 then raise exception 'CHECK 4 FAILED: first characters not well spread'; end if;
  -- consecutive tokens share no common prefix pattern (sequential IDs would)
  if (select count(*) from generate_series(1, 299) i where left(v_tokens[i], 4) = left(v_tokens[i + 1], 4)) > 1 then
    raise exception 'CHECK 4 FAILED: consecutive tokens look sequential';
  end if;
  -- tokens are not derived from the lead code / id / APN
  if position(replace(c1, '-', '') in t1) > 0 or position(left(v1::text, 8) in t1) > 0 then
    raise exception 'CHECK 4 FAILED: token appears derived from lead data';
  end if;

  -- CHECK 5: valid token resolves; QR tracking increments; 30-minute dedupe
  update public.leads set follow_up_status = 'Postcard sent' where id = v1;
  if not public.record_lead_visit_by_token(t1, 'qr', '{}') then raise exception 'CHECK 5 FAILED: valid token not recorded'; end if;
  select (qr_scan_count = 1 and landing_page_visit_count = 1 and follow_up_status = 'Scanned QR') into v_ok from public.leads where id = v1;
  if not v_ok then raise exception 'CHECK 5 FAILED: counters/status after first visit'; end if;
  perform public.record_lead_visit_by_token(t1, 'qr', '{}');   -- refresh (URL keeps ?ref=)
  select (qr_scan_count = 1 and landing_page_visit_count = 2) into v_ok from public.leads where id = v1;
  if not v_ok then raise exception 'CHECK 5 FAILED: 30-minute dedupe'; end if;
  update public.leads set last_qr_scan_at = now() - interval '31 minutes' where id = v1;
  perform public.record_lead_visit_by_token(t1, 'qr', '{}');
  if (select qr_scan_count from public.leads where id = v1) <> 2 then raise exception 'CHECK 5 FAILED: scan after 30 min'; end if;
  if (select qr_scan_count from public.leads where id = v2) <> 0 then raise exception 'CHECK 5 FAILED: another lead was affected'; end if;

  -- CHECK 6: CTA tracking by token
  if not public.record_lead_cta_by_token(t1, 'book', '{"button":"book_call","placement":"hero"}'::jsonb) then raise exception 'CHECK 6 FAILED'; end if;
  select metadata into v_meta from public.tracking_events where lead_id = v1 and event_type = 'cta_click' order by created_at desc limit 1;
  if v_meta->>'cta' <> 'book' or v_meta->>'button' <> 'book_call' then raise exception 'CHECK 6 FAILED: %', v_meta; end if;

  -- CHECK 7: invalid / unknown / one-character-changed tokens never resolve
  if public.record_lead_visit_by_token('not-a-token', 'qr', '{}') then raise exception 'CHECK 7 FAILED: invalid accepted'; end if;
  if public.record_lead_visit_by_token(public.new_public_token(), 'qr', '{}') then raise exception 'CHECK 7 FAILED: unknown accepted'; end if;
  for v_n in 1..16 loop
    v_ch := substr(t1, v_n, 1);
    v_mut := overlay(t1 placing (case when v_ch = 'A' then 'B' else 'A' end) from v_n for 1);
    if exists (select 1 from public.leads where public_token = v_mut) then raise exception 'CHECK 7 FAILED: neighbour token exists'; end if;
    if public.record_lead_visit_by_token(v_mut, 'qr', '{}') then raise exception 'CHECK 7 FAILED: 1-char change resolved'; end if;
  end loop;
  if public.record_lead_visit_by_token(lower(t1), 'qr', '{}') and lower(t1) <> t1 then raise exception 'CHECK 7 FAILED: case-insensitive match'; end if;

  -- CHECK 8: sequential lead codes no longer work through the public (token) path
  if public.record_lead_visit_by_token(c1, 'qr', '{}') then raise exception 'CHECK 8 FAILED: lead_code accepted as token'; end if;
  if public.record_lead_cta_by_token(c1, 'heloc', '{}') then raise exception 'CHECK 8 FAILED: lead_code accepted for CTA'; end if;

  -- CHECK 9: deleted leads' tokens are retired and never reissued
  perform public.delete_leads(array[v2], 'DELETE');
  if not exists (select 1 from public.retired_public_tokens where public_token = t2) then raise exception 'CHECK 9 FAILED: token not retired'; end if;
  if public.record_lead_visit_by_token(t2, 'qr', '{}') then raise exception 'CHECK 9 FAILED: deleted lead token still resolves'; end if;

  -- CHECK 10: public functions are not callable by anonymous visitors
  if has_function_privilege('anon', 'public.record_lead_visit_by_token(text, text, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.record_lead_cta_by_token(text, text, jsonb)', 'execute')
     or has_table_privilege('anon', 'public.leads', 'select') then
    raise exception 'CHECK 10 FAILED: anon has direct access';
  end if;

  -- CHECK 11: no approved postcards survived the QR change without re-review
  if exists (select 1 from public.app_migrations_applied where name = 'v1_6_2_reset_postcard_approvals') is not true then
    raise exception 'CHECK 11 FAILED: postcard approval reset not recorded';
  end if;
end;
$$;

select 'ALL V1.6.2 PUBLIC-TOKEN CHECKS PASSED (test data rolled back)' as result;

rollback;

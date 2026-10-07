-- =====================================================================
-- V1.5 — Mailing information is part of postcard readiness
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run
-- (after V1.1, V1.2 and V1.4 migrations). Safe to run more than once.
-- Does not change IDs, lead codes, images, QR/tracking, notes or scans.
--
-- Adds to leads:
--   mailing_name, mailing_street, mailing_city, mailing_state, mailing_zip
--   mailing_complete (automatic)
-- Filled from the existing mailing_address ONLY when it clearly reads as
-- "street, city, ST 12345". The property address is never copied in.
--
-- Postcard rules after V1.5:
--   ready    = approved property image + image link + recipient name
--              + mailing street + city + 2-letter state + ZIP
--   approved = only via approve_postcard(), and only when ready
--   Changing the image, recipient name, or any mailing field after approval
--   → back to ready (or not_ready). Scans, notes, outreach don't affect it.
-- =====================================================================

-- 1. Columns ------------------------------------------------------------
alter table public.leads add column if not exists mailing_name   text;
alter table public.leads add column if not exists mailing_street text;
alter table public.leads add column if not exists mailing_city   text;
alter table public.leads add column if not exists mailing_state  text;
alter table public.leads add column if not exists mailing_zip    text;

-- 2. Helpers ------------------------------------------------------------

-- Parses "123 Main St, Anaheim, CA 92801" / "123 Main St, Anaheim CA 92801" /
-- "PO Box 5, Irvine, CA, 92618-1234". Returns NULLs when it can't be sure.
create or replace function public.parse_mailing_address(addr text)
returns table (street text, city text, state text, zip text)
language plpgsql
immutable
as $$
declare
  a text := btrim(regexp_replace(coalesce(addr, ''), '\s+', ' ', 'g'));
  m text[];
begin
  a := regexp_replace(a, ',?\s*(USA|United States)\.?$', '', 'i');
  m := regexp_match(a, '^(.+?),\s*([^,]+?),\s*([A-Za-z]{2})\.?,?\s+(\d{5}(?:-?\d{4})?)$');
  if m is null then
    m := regexp_match(a, '^(.+?),\s*([^,]+?)\s+([A-Za-z]{2})\.?,?\s+(\d{5}(?:-?\d{4})?)$');
  end if;
  if m is null or btrim(m[1]) = '' or btrim(m[2]) = '' then
    return query select null::text, null::text, null::text, null::text;
    return;
  end if;
  return query select btrim(m[1]), btrim(m[2]), upper(m[3]), m[4];
end;
$$;

-- Recipient name shown on the postcard: mailing_name if set, else owner first/last, else owner as recorded.
create or replace function public.postcard_recipient_name(p_mailing_name text, p_first text, p_last text, p_owner_raw text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(p_mailing_name), ''),
    nullif(btrim(coalesce(p_first, '') || ' ' || coalesce(p_last, '')), ''),
    nullif(btrim(p_owner_raw), '')
  );
$$;

create or replace function public.mailing_is_complete(
  p_mailing_name text, p_first text, p_last text, p_owner_raw text,
  p_street text, p_city text, p_state text, p_zip text
)
returns boolean
language sql
immutable
as $$
  select public.postcard_recipient_name(p_mailing_name, p_first, p_last, p_owner_raw) is not null
     and nullif(btrim(p_street), '') is not null
     and nullif(btrim(p_city), '') is not null
     and coalesce(btrim(p_state), '') ~ '^[A-Za-z]{2}$'
     and coalesce(btrim(p_zip), '') ~ '^\d{5}(-?\d{4})?$';
$$;

-- 3. One-time backfill from the existing mailing_address ------------------
-- (Runs before the new sync trigger so mailing_address text is never rewritten.)
update public.leads l
   set mailing_street = p.street,
       mailing_city   = p.city,
       mailing_state  = p.state,
       mailing_zip    = p.zip
  from (select id, (public.parse_mailing_address(mailing_address)).* from public.leads) p
 where p.id = l.id
   and l.mailing_street is null and l.mailing_city is null and l.mailing_state is null and l.mailing_zip is null
   and p.street is not null;

-- 4. Automatic readiness flag ------------------------------------------
alter table public.leads add column if not exists mailing_complete boolean
  generated always as (
    public.mailing_is_complete(mailing_name, first_name, last_name, owner_name_raw,
                               mailing_street, mailing_city, mailing_state, mailing_zip)
  ) stored;

-- 5. Keep mailing_address and the structured fields in step --------------
--   • structured fields edited (lead page form)  → rebuild mailing_address text
--   • mailing_address changed (e.g. CSV re-import) → re-parse into fields
--     (fields become empty if it can't be parsed — the card then shows
--      "Missing mailing information" until someone fixes it)
create or replace function public.leads_mailing_sync()
returns trigger
language plpgsql
as $$
declare
  v_struct_changed boolean;
  v_addr_changed   boolean;
  p record;
begin
  new.mailing_name   := nullif(btrim(new.mailing_name), '');
  new.mailing_street := nullif(btrim(new.mailing_street), '');
  new.mailing_city   := nullif(btrim(new.mailing_city), '');
  new.mailing_state  := upper(nullif(btrim(new.mailing_state), ''));
  new.mailing_zip    := nullif(btrim(new.mailing_zip), '');

  if tg_op = 'INSERT' then
    v_struct_changed := coalesce(new.mailing_street, new.mailing_city, new.mailing_state, new.mailing_zip) is not null;
    v_addr_changed   := new.mailing_address is not null;
  else
    v_struct_changed :=
         new.mailing_street is distinct from old.mailing_street
      or new.mailing_city   is distinct from old.mailing_city
      or new.mailing_state  is distinct from old.mailing_state
      or new.mailing_zip    is distinct from old.mailing_zip;
    v_addr_changed := new.mailing_address is distinct from old.mailing_address;
  end if;

  if v_struct_changed then
    if coalesce(new.mailing_street, new.mailing_city, new.mailing_state, new.mailing_zip) is null then
      new.mailing_address := null;   -- someone deliberately cleared all mailing fields
    elsif new.mailing_street is not null then
      new.mailing_address := new.mailing_street
        || coalesce(', ' || new.mailing_city, '')
        || coalesce(', ' || btrim(coalesce(new.mailing_state, '') || ' ' || coalesce(new.mailing_zip, '')), '');
    end if;
  elsif v_addr_changed then
    select * into p from public.parse_mailing_address(new.mailing_address);
    new.mailing_street := p.street;
    new.mailing_city   := p.city;
    new.mailing_state  := p.state;
    new.mailing_zip    := p.zip;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leads_mailing_sync on public.leads;
create trigger trg_leads_mailing_sync
  before insert or update on public.leads
  for each row execute function public.leads_mailing_sync();
-- (Trigger names run alphabetically: mailing_sync runs before postcard_status_sync.)

-- 6. Postcard status: image AND mailing --------------------------------
create or replace function public.leads_postcard_status_sync()
returns trigger
language plpgsql
as $$
declare
  v_complete boolean := public.mailing_is_complete(new.mailing_name, new.first_name, new.last_name, new.owner_name_raw,
                                                   new.mailing_street, new.mailing_city, new.mailing_state, new.mailing_zip);
  v_content_changed boolean := false;
  v_approving boolean := coalesce(current_setting('app.postcard_approve', true), '') = 'on';
begin
  if new.property_image_status is distinct from 'approved' or new.property_image_url is null or not v_complete then
    new.postcard_status := 'not_ready';
    new.postcard_approved_at := null;
    new.postcard_approved_image_url := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Only things printed on the card. Scans, notes, outreach, follow-ups etc. are NOT here.
    v_content_changed :=
         new.property_image_url    is distinct from old.property_image_url
      or new.property_image_status is distinct from old.property_image_status
      or new.lead_code             is distinct from old.lead_code
      or new.city                  is distinct from old.city          -- "YOUR <CITY> PROPERTY"
      or public.postcard_recipient_name(new.mailing_name, new.first_name, new.last_name, new.owner_name_raw)
         is distinct from public.postcard_recipient_name(old.mailing_name, old.first_name, old.last_name, old.owner_name_raw)
      or new.mailing_street        is distinct from old.mailing_street
      or new.mailing_city          is distinct from old.mailing_city
      or new.mailing_state         is distinct from old.mailing_state
      or new.mailing_zip           is distinct from old.mailing_zip;
  end if;

  if new.postcard_status = 'approved'
     and (tg_op = 'INSERT' or old.postcard_status is distinct from 'approved')
     and not v_approving then
    new.postcard_status := 'ready';
    new.postcard_approved_at := null;
    new.postcard_approved_image_url := null;
  end if;

  if new.postcard_status = 'approved' and v_content_changed and not v_approving then
    new.postcard_status := 'ready';
    new.postcard_approved_at := null;
    new.postcard_approved_image_url := null;
  end if;

  if new.postcard_status = 'not_ready' then
    new.postcard_status := 'ready';
  end if;
  return new;
end;
$$;

-- 7. Approval requires complete mailing info ----------------------------
create or replace function public.approve_postcard(
  p_lead_id            uuid,
  p_action             text default 'approve',
  p_expected_image_url text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead not found';
  end if;

  if p_action = 'approve' then
    if v_lead.property_image_status <> 'approved' or v_lead.property_image_url is null then
      raise exception 'Property image is not approved — this postcard cannot be approved.';
    end if;
    if not v_lead.mailing_complete then
      raise exception 'Missing mailing information — this postcard cannot be approved.';
    end if;
    if p_expected_image_url is not null and p_expected_image_url is distinct from v_lead.property_image_url then
      raise exception 'The property image changed since this preview loaded. Reload and check it again.';
    end if;
    perform set_config('app.postcard_approve', 'on', true);
    update public.leads
       set postcard_status = 'approved',
           postcard_approved_at = now(),
           postcard_approved_image_url = v_lead.property_image_url
     where id = p_lead_id;
    perform set_config('app.postcard_approve', '', true);

  elsif p_action = 'unapprove' then
    update public.leads
       set postcard_status = 'ready',          -- trigger turns this into not_ready if needed
           postcard_approved_at = null,
           postcard_approved_image_url = null
     where id = p_lead_id;

  else
    raise exception 'Unknown action %', p_action;
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  return jsonb_build_object('postcard_status', v_lead.postcard_status, 'postcard_approved_at', v_lead.postcard_approved_at);
end;
$$;

-- 8. Re-check every lead under the new rules (no data is rewritten) -----
--    Approved postcards with complete mailing info stay approved.
update public.leads set postcard_status = postcard_status;

-- 9. The single source for exports + print batches ----------------------
--    (security_invoker = the signed-in user's permissions/RLS apply)
create or replace view public.postcard_export_candidates
with (security_invoker = true) as
select l.*
  from public.leads l
 where l.postcard_status = 'approved'
   and l.property_image_status = 'approved'
   and l.property_image_url is not null
   and l.mailing_complete
   and l.follow_up_status <> 'Do not contact';

revoke all on public.postcard_export_candidates from anon;
grant select on public.postcard_export_candidates to authenticated, service_role;

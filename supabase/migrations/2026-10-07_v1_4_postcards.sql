-- =====================================================================
-- V1.4 — Postcard status
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run
-- (after the V1.1 and V1.2 migrations). Safe to run more than once.
-- Does not change IDs, lead codes, images, notes, statuses or scans.
--
-- Adds to leads:
--   postcard_status       not_ready | ready | approved
--   postcard_approved_at  when a person clicked "Mark postcard approved"
--   postcard_approved_image_url  the exact image that was approved
--
-- Rules (enforced by the database on every insert/update):
--   • Property image not Approved            → postcard_status = not_ready
--   • Property image Approved, not yet OK'd   → ready
--   • approved only via approve_postcard() — never automatic
--   • If the image (or the name/address printed on the card) changes after
--     approval → back to ready, approval cleared.
-- =====================================================================

alter table public.leads add column if not exists postcard_status text;
alter table public.leads add column if not exists postcard_approved_at timestamptz;
alter table public.leads add column if not exists postcard_approved_image_url text;

-- Backfill once (status follows the property image).
update public.leads
   set postcard_status = case when property_image_status = 'approved' then 'ready' else 'not_ready' end
 where postcard_status is null;

alter table public.leads alter column postcard_status set default 'not_ready';
alter table public.leads alter column postcard_status set not null;

alter table public.leads drop constraint if exists leads_postcard_status_check;
alter table public.leads add constraint leads_postcard_status_check
  check (postcard_status in ('not_ready', 'ready', 'approved'));

-- An approved postcard must have an approved image and an approval time.
alter table public.leads drop constraint if exists leads_postcard_approved_consistent;
alter table public.leads add constraint leads_postcard_approved_consistent
  check (
    postcard_status <> 'approved'
    or (property_image_status = 'approved' and postcard_approved_at is not null and postcard_approved_image_url is not null)
  );

create index if not exists leads_postcard_status_idx on public.leads (postcard_status);

-- ---------------------------------------------------------------------
-- Keep postcard_status in sync automatically
-- ---------------------------------------------------------------------
create or replace function public.leads_postcard_status_sync()
returns trigger
language plpgsql
as $$
declare
  v_content_changed boolean := false;
begin
  if new.property_image_status is distinct from 'approved' then
    new.postcard_status := 'not_ready';
    new.postcard_approved_at := null;
    new.postcard_approved_image_url := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_content_changed :=
         new.property_image_url is distinct from old.property_image_url
      or new.property_image_status is distinct from old.property_image_status
      or new.lead_code         is distinct from old.lead_code
      or new.city              is distinct from old.city
      or new.property_address  is distinct from old.property_address
      or new.mailing_address   is distinct from old.mailing_address
      or new.first_name        is distinct from old.first_name
      or new.last_name         is distinct from old.last_name
      or new.owner_name_raw    is distinct from old.owner_name_raw;
  end if;

  -- An approval can only be created through approve_postcard().
  if new.postcard_status = 'approved'
     and (tg_op = 'INSERT' or old.postcard_status is distinct from 'approved')
     and coalesce(current_setting('app.postcard_approve', true), '') <> 'on' then
    new.postcard_status := 'ready';
    new.postcard_approved_at := null;
    new.postcard_approved_image_url := null;
  end if;

  -- Card content changed after approval → needs a fresh look.
  if new.postcard_status = 'approved' and v_content_changed
     and coalesce(current_setting('app.postcard_approve', true), '') <> 'on' then
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

drop trigger if exists trg_leads_postcard_status_sync on public.leads;
create trigger trg_leads_postcard_status_sync
  before insert or update on public.leads
  for each row execute function public.leads_postcard_status_sync();

-- ---------------------------------------------------------------------
-- The ONLY way to approve / un-approve a postcard
--   p_expected_image_url: the image the reviewer was looking at. If the
--   image changed since the preview loaded, approval is refused.
-- ---------------------------------------------------------------------
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
       set postcard_status = case when property_image_status = 'approved' then 'ready' else 'not_ready' end,
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

revoke all on function public.approve_postcard(uuid, text, text) from public, anon;
grant execute on function public.approve_postcard(uuid, text, text) to authenticated, service_role;

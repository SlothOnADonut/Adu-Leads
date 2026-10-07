-- =====================================================================
-- V1.2 — Property images
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run.
-- Safe to run more than once. Does not change any IDs, lead codes or
-- existing lead data. Every existing lead starts as status "missing".
--
-- Adds to leads:
--   property_image_url, property_image_source, property_image_status,
--   property_image_notes, property_image_updated_at,
--   postcard_image_ready  (automatic: true only when status = approved)
--
-- Safety:
--   • An APPROVED image can't be replaced or un-approved by any code path
--     (imports, future provider fetches, scripts) unless the change is made
--     through set_property_image(..., p_replace_approved => true), which is
--     what the app's explicit "Replace" action uses.
--   • An image can't be approved/reviewed without a URL.
--   • CSV import (import_leads) never touches image fields.
-- =====================================================================

-- 1. Columns ------------------------------------------------------------
alter table public.leads add column if not exists property_image_url        text;
alter table public.leads add column if not exists property_image_source     text;
alter table public.leads add column if not exists property_image_status     text;
alter table public.leads add column if not exists property_image_notes      text;
alter table public.leads add column if not exists property_image_updated_at timestamptz;

update public.leads set property_image_status = 'missing' where property_image_status is null;
alter table public.leads alter column property_image_status set default 'missing';
alter table public.leads alter column property_image_status set not null;

alter table public.leads drop constraint if exists leads_property_image_status_check;
alter table public.leads add constraint leads_property_image_status_check
  check (property_image_status in ('missing', 'fetched', 'needs_review', 'approved', 'rejected', 'manual'));

-- Only "missing" and "rejected" may exist without an image URL.
alter table public.leads drop constraint if exists leads_property_image_url_required;
alter table public.leads add constraint leads_property_image_url_required
  check (property_image_status in ('missing', 'rejected') or property_image_url is not null);

-- Postcard image readiness — computed by the database, never set by hand.
alter table public.leads add column if not exists postcard_image_ready boolean
  generated always as (property_image_status = 'approved') stored;

create index if not exists leads_property_image_status_idx on public.leads (property_image_status);

-- 2. Approval lock + timestamp (runs on every update of a lead) ---------
create or replace function public.leads_property_image_guard()
returns trigger
language plpgsql
as $$
declare
  v_changed boolean :=
       new.property_image_url    is distinct from old.property_image_url
    or new.property_image_source is distinct from old.property_image_source
    or new.property_image_status is distinct from old.property_image_status;
begin
  if not v_changed and new.property_image_notes is not distinct from old.property_image_notes then
    return new;
  end if;

  if old.property_image_status = 'approved'
     and v_changed
     and coalesce(current_setting('app.allow_approved_image_change', true), '') <> 'on' then
    raise exception 'Lead % has an APPROVED property image. It can only be changed with an explicit Replace / status action.', old.lead_code
      using errcode = 'P0001';
  end if;

  new.property_image_updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_leads_property_image_guard on public.leads;
create trigger trg_leads_property_image_guard
  before update on public.leads
  for each row execute function public.leads_property_image_guard();

-- 3. The ONE function the app uses to change a property image ----------
--   p_action:
--     'set_url'      new URL (pasted / uploaded / fetched) → status needs_review
--                    (refused if current image is approved, unless p_replace_approved)
--     'approve' | 'reject' | 'needs_review'   change status only
--     'clear'        remove image → status missing
--     'notes'        update notes only
create or replace function public.set_property_image(
  p_lead_id          uuid,
  p_action           text,
  p_url              text    default null,
  p_source           text    default null,
  p_notes            text    default null,
  p_replace_approved boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_url  text := nullif(btrim(coalesce(p_url, '')), '');
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead not found';
  end if;

  if p_action = 'notes' then
    update public.leads set property_image_notes = nullif(btrim(coalesce(p_notes, '')), '') where id = p_lead_id;

  elsif p_action = 'set_url' then
    if v_url is null or v_url !~* '^https?://' then
      raise exception 'Image URL must start with http:// or https://';
    end if;
    if length(v_url) > 2000 then
      raise exception 'Image URL is too long';
    end if;
    if v_lead.property_image_status = 'approved' and not coalesce(p_replace_approved, false) then
      raise exception 'This lead already has an approved image. Choose Replace to change it.';
    end if;
    perform set_config('app.allow_approved_image_change', 'on', true);
    update public.leads set
      property_image_url    = v_url,
      property_image_source = coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'manual'),
      property_image_status = 'needs_review',
      property_image_notes  = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), property_image_notes)
    where id = p_lead_id;

  elsif p_action in ('approve', 'reject', 'needs_review') then
    if p_action <> 'reject' and v_lead.property_image_url is null then
      raise exception 'There is no image to review yet. Add an image URL first.';
    end if;
    perform set_config('app.allow_approved_image_change', 'on', true);
    update public.leads set
      property_image_status = case p_action when 'approve' then 'approved'
                                            when 'reject' then 'rejected'
                                            else 'needs_review' end,
      property_image_notes  = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), property_image_notes)
    where id = p_lead_id;

  elsif p_action = 'clear' then
    if v_lead.property_image_status = 'approved' and not coalesce(p_replace_approved, false) then
      raise exception 'This lead has an approved image. Choose Replace to remove it.';
    end if;
    perform set_config('app.allow_approved_image_change', 'on', true);
    update public.leads set
      property_image_url = null, property_image_source = null, property_image_status = 'missing'
    where id = p_lead_id;

  else
    raise exception 'Unknown action %', p_action;
  end if;

  perform set_config('app.allow_approved_image_change', '', true);

  select * into v_lead from public.leads where id = p_lead_id;
  return jsonb_build_object(
    'status', v_lead.property_image_status,
    'url', v_lead.property_image_url,
    'source', v_lead.property_image_source,
    'postcard_image_ready', v_lead.postcard_image_ready
  );
end;
$$;

revoke all on function public.set_property_image(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.set_property_image(uuid, text, text, text, text, boolean) to authenticated, service_role;

-- 4. Storage bucket for uploaded photos (optional feature) --------------
-- Creates a bucket "property-images". Photos are readable by anyone who has
-- the exact (random) link, which printers/mail-merge tools need. Nobody can
-- list the bucket, and only the app's server can upload.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('property-images', 'property-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
  end if;
exception when others then
  raise notice 'Could not create the property-images storage bucket automatically (%). The app will create it on first upload.', sqlerrm;
end;
$$;

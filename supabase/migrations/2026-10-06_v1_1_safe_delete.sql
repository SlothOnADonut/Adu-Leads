-- =====================================================================
-- V1.1 — Safe archive / delete
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run.
-- Safe to run more than once. Does not change any existing IDs or data.
--
-- Adds:
--   • campaigns.archived_at  (archive / restore — nothing is deleted)
--   • campaign_deletion_preview()      counts shown in the delete dialog
--   • delete_campaign_permanently()    one transaction: campaign + its leads + their events
--   • delete_leads()                   one transaction: chosen leads + their events
-- Re-asserts foreign keys so deleting a lead always removes its events.
-- =====================================================================

-- 1. Archive column ----------------------------------------------------
alter table public.campaigns add column if not exists archived_at timestamptz;
create index if not exists campaigns_archived_idx on public.campaigns (archived_at);

-- 2. Foreign keys (same behavior as V1, stated explicitly) ------------
-- Deleting a lead deletes its tracking events (no orphans).
alter table public.tracking_events drop constraint if exists tracking_events_lead_id_fkey;
alter table public.tracking_events
  add constraint tracking_events_lead_id_fkey
  foreign key (lead_id) references public.leads(id) on delete cascade;

-- Deleting a campaign row DIRECTLY (e.g. in the Supabase table editor) does
-- NOT wipe its leads — they just become "No campaign". Wiping leads only
-- happens through delete_campaign_permanently(), which requires "DELETE".
alter table public.leads drop constraint if exists leads_campaign_id_fkey;
alter table public.leads
  add constraint leads_campaign_id_fkey
  foreign key (campaign_id) references public.campaigns(id) on delete set null;

alter table public.tracking_events drop constraint if exists tracking_events_campaign_id_fkey;
alter table public.tracking_events
  add constraint tracking_events_campaign_id_fkey
  foreign key (campaign_id) references public.campaigns(id) on delete set null;

-- 3. Preview counts for the delete dialog ------------------------------
create or replace function public.campaign_deletion_preview(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_leads    integer;
  v_scans    integer;
  v_mailed   integer;
  v_events   integer;
begin
  select * into v_campaign from public.campaigns where id = p_campaign_id;
  if not found then
    raise exception 'Campaign not found';
  end if;

  select count(*), coalesce(sum(qr_scan_count), 0), count(*) filter (where postcard_sent_date is not null)
    into v_leads, v_scans, v_mailed
    from public.leads where campaign_id = p_campaign_id;

  select count(*) into v_events
    from public.tracking_events e
   where e.lead_id in (select id from public.leads where campaign_id = p_campaign_id)
      or (e.lead_id is null and e.campaign_id = p_campaign_id);

  return jsonb_build_object(
    'id', v_campaign.id,
    'name', v_campaign.name,
    'archived_at', v_campaign.archived_at,
    'sent_date', v_campaign.sent_date,
    'lead_count', v_leads,
    'scan_count', v_scans,
    'mailed_lead_count', v_mailed,
    'event_count', v_events
  );
end;
$$;

-- 4. Permanent campaign delete (single transaction) --------------------
-- Deletes: the campaign, every lead whose campaign_id is this campaign, and
-- every tracking event belonging to those leads.
-- Does NOT delete: leads in other campaigns (even if an old event of theirs
-- mentions this campaign — that event just loses its campaign link), users,
-- or any other table.
create or replace function public.delete_campaign_permanently(p_campaign_id uuid, p_confirm text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name   text;
  v_leads  integer;
  v_events integer;
  v_orphan integer;
begin
  if p_confirm is distinct from 'DELETE' then
    raise exception 'Confirmation text must be exactly DELETE';
  end if;
  if p_campaign_id is null then
    raise exception 'No campaign given';
  end if;

  select name into v_name from public.campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'Campaign not found (it may already be deleted)';
  end if;

  -- events of this campaign's leads
  with d as (
    delete from public.tracking_events
     where lead_id in (select id from public.leads where campaign_id = p_campaign_id)
    returning 1
  ) select count(*) into v_events from d;

  -- campaign-level events with no lead
  with d as (
    delete from public.tracking_events
     where lead_id is null and campaign_id = p_campaign_id
    returning 1
  ) select count(*) into v_orphan from d;

  with d as (
    delete from public.leads where campaign_id = p_campaign_id returning 1
  ) select count(*) into v_leads from d;

  delete from public.campaigns where id = p_campaign_id;

  return jsonb_build_object(
    'campaign', v_name,
    'leads_deleted', v_leads,
    'events_deleted', v_events + v_orphan
  );
end;
$$;

-- 5. Delete specific leads (single transaction) ------------------------
create or replace function public.delete_leads(p_lead_ids uuid[], p_confirm text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_leads  integer;
  v_events integer;
begin
  if p_confirm is distinct from 'DELETE' then
    raise exception 'Confirmation text must be exactly DELETE';
  end if;
  if p_lead_ids is null or cardinality(p_lead_ids) = 0 then
    return jsonb_build_object('leads_deleted', 0, 'events_deleted', 0);
  end if;
  if cardinality(p_lead_ids) > 10000 then
    raise exception 'Too many leads in one delete (max 10,000)';
  end if;

  select count(*) into v_events from public.tracking_events where lead_id = any(p_lead_ids);

  with d as (
    delete from public.leads where id = any(p_lead_ids) returning 1
  ) select count(*) into v_leads from d;

  return jsonb_build_object('leads_deleted', v_leads, 'events_deleted', v_events);
end;
$$;

-- 6. Permissions: signed-in team only ----------------------------------
revoke all on function public.campaign_deletion_preview(uuid) from public, anon;
grant execute on function public.campaign_deletion_preview(uuid) to authenticated, service_role;

revoke all on function public.delete_campaign_permanently(uuid, text) from public, anon;
grant execute on function public.delete_campaign_permanently(uuid, text) to authenticated, service_role;

revoke all on function public.delete_leads(uuid[], text) from public, anon;
grant execute on function public.delete_leads(uuid[], text) to authenticated, service_role;

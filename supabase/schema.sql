-- =====================================================================
-- ADU → HELOC Lead Tracker — Supabase schema (V1)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run on a fresh project. Then run every file in supabase/migrations/
-- (in date order), then seed.sql (optional).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Helper functions (must exist before the tables that use them)
-- ---------------------------------------------------------------------

-- Normalizes the street part of an address so "123 Main Street, Anaheim"
-- and "123 MAIN ST" compare equal. Used to detect absentee owners.
create or replace function public.normalize_street(addr text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      regexp_replace(regexp_replace(regexp_replace(regexp_replace(
        lower(split_part(coalesce(addr, ''), ',', 1)),
        '\mstreet\M', 'st', 'g'),
        '\mavenue\M', 'ave', 'g'),
        '\mdrive\M', 'dr', 'g'),
        '\mroad\M', 'rd', 'g'),
        '\mboulevard\M', 'blvd', 'g'),
        '\mlane\M', 'ln', 'g'),
        '\mcourt\M', 'ct', 'g'),
        '\mplace\M', 'pl', 'g'),
      '[^a-z0-9]', '', 'g'),
    '');
$$;

-- City → lead code prefix. Anaheim = ANA. Others = first 3 letters.
create or replace function public.city_prefix(p_city text)
returns text
language sql
immutable
as $$
  select case
    when lower(btrim(coalesce(p_city, ''))) = 'anaheim' then 'ANA'
    else coalesce(
      nullif(upper(left(regexp_replace(coalesce(p_city, ''), '[^A-Za-z]', '', 'g'), 3)), ''),
      'LEAD')
  end;
$$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.campaigns (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  city                 text,
  vertical             text default 'ADU → HELOC',
  postcard_version     text,
  landing_page_version text,
  sent_date            date,
  notes                text,
  created_at           timestamptz not null default now()
);

create table if not exists public.lead_code_counters (
  prefix     text primary key,
  last_value integer not null default 0
);

create table if not exists public.leads (
  id                       uuid primary key default gen_random_uuid(),
  lead_code                text not null unique,

  -- homeowner
  first_name               text,
  last_name                text,
  owner_name_raw           text,
  mailing_address          text,

  -- property
  property_address         text,
  city                     text,
  state                    text default 'CA',
  zip                      text,
  apn                      text,

  -- permit
  permit_number            text,
  permit_issue_date        date,
  permit_status            text,
  permit_description       text,
  job_valuation            numeric(14,2),
  project_type             text,
  owner_builder            text,
  plan_check               text,

  -- enrichment
  last_sale_date           date,
  last_sale_price          numeric(14,2),

  -- scoring (0–100)
  permit_score             integer,
  equity_signal_score      integer,
  final_priority_score     integer,

  -- campaign + mail
  campaign_id              uuid references public.campaigns(id) on delete set null,
  postcard_sent_date       date,

  -- tracking counters (only changed by record_lead_visit / the app)
  qr_scan_count            integer not null default 0,
  first_qr_scan_at         timestamptz,
  last_qr_scan_at          timestamptz,
  landing_page_visit_count integer not null default 0,

  -- manual pipeline fields (NEVER touched by CSV re-import)
  call_status              text,
  text_status              text,
  appointment_status       text,
  application_status       text,
  funded_status            text,
  follow_up_status         text not null default 'Not contacted',
  next_follow_up_date      date,
  notes                    text,

  last_activity_at         timestamptz,

  -- true when the mailing street differs from the property street
  -- (likely NOT owner-occupied). null when either address is missing.
  mailing_differs boolean generated always as (
    case
      when public.normalize_street(mailing_address) is null
        or public.normalize_street(property_address) is null then null
      else public.normalize_street(mailing_address) <> public.normalize_street(property_address)
    end
  ) stored,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint leads_follow_up_status_check check (follow_up_status in (
    'Not contacted','Postcard queued','Postcard sent','Scanned QR','Needs follow-up',
    'Contacted','Appointment booked','Applied','Funded','Do not contact')),
  constraint leads_needs_identifier check (apn is not null or permit_number is not null),
  -- re-import matching key: APN + permit number
  constraint leads_apn_permit_unique unique nulls not distinct (apn, permit_number)
);

create index if not exists leads_campaign_idx      on public.leads (campaign_id);
create index if not exists leads_status_idx        on public.leads (follow_up_status);
create index if not exists leads_followup_date_idx on public.leads (next_follow_up_date);
create index if not exists leads_priority_idx      on public.leads (final_priority_score desc);

create table if not exists public.tracking_events (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid references public.leads(id) on delete cascade,
  campaign_id  uuid references public.campaigns(id) on delete set null,
  event_type   text not null,
  event_source text,
  created_at   timestamptz not null default now(),
  metadata     jsonb not null default '{}'::jsonb
);

create index if not exists tracking_events_lead_idx on public.tracking_events (lead_id, created_at desc);
create index if not exists tracking_events_type_idx on public.tracking_events (event_type, created_at desc);

-- ---------------------------------------------------------------------
-- Lead code generation (ANA-0001, ANA-0002, …)
-- ---------------------------------------------------------------------

create or replace function public.next_lead_code(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
begin
  insert into public.lead_code_counters (prefix, last_value)
  values (p_prefix, 1)
  on conflict (prefix) do update
    set last_value = public.lead_code_counters.last_value + 1
  returning last_value into v;

  return p_prefix || '-' || lpad(v::text, greatest(4, length(v::text)), '0');
end;
$$;

create or replace function public.leads_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.lead_code is null or btrim(new.lead_code) = '' then
    new.lead_code := public.next_lead_code(public.city_prefix(new.city));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_before_insert on public.leads;
create trigger trg_leads_before_insert
  before insert on public.leads
  for each row execute function public.leads_before_insert();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at();

-- Every tracking event bumps the lead's "last activity" time.
create or replace function public.tracking_events_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lead_id is not null then
    update public.leads
       set last_activity_at = greatest(coalesce(last_activity_at, new.created_at), new.created_at)
     where id = new.lead_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tracking_events_after_insert on public.tracking_events;
create trigger trg_tracking_events_after_insert
  after insert on public.tracking_events
  for each row execute function public.tracking_events_after_insert();

-- ---------------------------------------------------------------------
-- PUBLIC QR TRACKING (called ONLY by the server route with the
-- service-role key; anon/authenticated cannot execute it)
-- ---------------------------------------------------------------------

create or replace function public.record_lead_visit(
  p_lead_code text,
  p_source    text  default 'qr',
  p_metadata  jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code        text := upper(btrim(coalesce(p_lead_code, '')));
  v_lead        public.leads%rowtype;
  v_now         timestamptz := now();
  v_new_scan    boolean;
  v_today       date := (now() at time zone 'America/Los_Angeles')::date;
begin
  if v_code !~ '^[A-Z]{2,5}-[0-9]{4,6}$' then
    return false;
  end if;

  select * into v_lead from public.leads where lead_code = v_code for update;
  if not found then
    return false;
  end if;

  -- Refreshes within 30 minutes count as page visits, not new scans.
  v_new_scan := v_lead.last_qr_scan_at is null
             or v_lead.last_qr_scan_at < v_now - interval '30 minutes';

  update public.leads set
    landing_page_visit_count = landing_page_visit_count + 1,
    qr_scan_count     = qr_scan_count + case when v_new_scan then 1 else 0 end,
    first_qr_scan_at  = coalesce(first_qr_scan_at, v_now),
    last_qr_scan_at   = v_now,
    follow_up_status  = case when follow_up_status = 'Postcard sent' then 'Scanned QR' else follow_up_status end,
    next_follow_up_date = case
      when follow_up_status = 'Postcard sent' then coalesce(next_follow_up_date, v_today)
      else next_follow_up_date end
  where id = v_lead.id;

  if v_new_scan then
    insert into public.tracking_events (lead_id, campaign_id, event_type, event_source, metadata)
    values (v_lead.id, v_lead.campaign_id, 'qr_scan', coalesce(p_source, 'qr'), coalesce(p_metadata, '{}'::jsonb));
  end if;

  insert into public.tracking_events (lead_id, campaign_id, event_type, event_source, metadata)
  values (v_lead.id, v_lead.campaign_id, 'landing_page_visit', coalesce(p_source, 'qr'), coalesce(p_metadata, '{}'::jsonb));

  return true;
end;
$$;

-- CTA clicks on the public landing page (Check HELOC / Book / Call).
create or replace function public.record_lead_cta(
  p_lead_code text,
  p_cta       text,
  p_metadata  jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(btrim(coalesce(p_lead_code, '')));
  v_lead public.leads%rowtype;
begin
  if v_code !~ '^[A-Z]{2,5}-[0-9]{4,6}$' or p_cta not in ('heloc', 'book', 'call') then
    return false;
  end if;

  select * into v_lead from public.leads where lead_code = v_code;
  if not found then
    return false;
  end if;

  insert into public.tracking_events (lead_id, campaign_id, event_type, event_source, metadata)
  values (v_lead.id, v_lead.campaign_id, 'cta_click', 'landing_page',
          coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('cta', p_cta));
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- CSV IMPORT (called by logged-in users through the app)
-- Matching key: APN + permit number.
-- On re-import ONLY permit/enrichment fields are updated; notes,
-- statuses, follow-up dates, tracking counters and postcard data are
-- never touched. Blank cells never wipe existing data.
-- ---------------------------------------------------------------------

create or replace function public.import_leads(p_rows jsonb, p_campaign_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r            jsonb;
  v_inserted   integer := 0;
  v_updated    integer := 0;
  v_skipped    integer := 0;
  v_was_insert boolean;
begin
  for r in select value from jsonb_array_elements(p_rows) loop
    if nullif(btrim(coalesce(r->>'apn', '')), '') is null
       and nullif(btrim(coalesce(r->>'permit_number', '')), '') is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.leads (
      first_name, last_name, owner_name_raw, mailing_address,
      property_address, city, state, zip, apn,
      permit_number, permit_issue_date, permit_status, permit_description,
      job_valuation, project_type, owner_builder, plan_check,
      last_sale_date, last_sale_price,
      permit_score, equity_signal_score, final_priority_score,
      campaign_id
    ) values (
      nullif(btrim(r->>'first_name'), ''),
      nullif(btrim(r->>'last_name'), ''),
      nullif(btrim(r->>'owner_name_raw'), ''),
      nullif(btrim(r->>'mailing_address'), ''),
      nullif(btrim(r->>'property_address'), ''),
      nullif(btrim(r->>'city'), ''),
      coalesce(nullif(btrim(r->>'state'), ''), 'CA'),
      nullif(btrim(r->>'zip'), ''),
      nullif(btrim(r->>'apn'), ''),
      nullif(btrim(r->>'permit_number'), ''),
      nullif(r->>'permit_issue_date', '')::date,
      nullif(btrim(r->>'permit_status'), ''),
      nullif(btrim(r->>'permit_description'), ''),
      nullif(r->>'job_valuation', '')::numeric,
      nullif(btrim(r->>'project_type'), ''),
      nullif(btrim(r->>'owner_builder'), ''),
      nullif(btrim(r->>'plan_check'), ''),
      nullif(r->>'last_sale_date', '')::date,
      nullif(r->>'last_sale_price', '')::numeric,
      nullif(r->>'permit_score', '')::integer,
      nullif(r->>'equity_signal_score', '')::integer,
      nullif(r->>'final_priority_score', '')::integer,
      p_campaign_id
    )
    on conflict on constraint leads_apn_permit_unique do update set
      first_name           = coalesce(excluded.first_name, leads.first_name),
      last_name            = coalesce(excluded.last_name, leads.last_name),
      owner_name_raw       = coalesce(excluded.owner_name_raw, leads.owner_name_raw),
      mailing_address      = coalesce(excluded.mailing_address, leads.mailing_address),
      property_address     = coalesce(excluded.property_address, leads.property_address),
      city                 = coalesce(excluded.city, leads.city),
      state                = coalesce(excluded.state, leads.state),
      zip                  = coalesce(excluded.zip, leads.zip),
      permit_issue_date    = coalesce(excluded.permit_issue_date, leads.permit_issue_date),
      permit_status        = coalesce(excluded.permit_status, leads.permit_status),
      permit_description   = coalesce(excluded.permit_description, leads.permit_description),
      job_valuation        = coalesce(excluded.job_valuation, leads.job_valuation),
      project_type         = coalesce(excluded.project_type, leads.project_type),
      owner_builder        = coalesce(excluded.owner_builder, leads.owner_builder),
      plan_check           = coalesce(excluded.plan_check, leads.plan_check),
      last_sale_date       = coalesce(excluded.last_sale_date, leads.last_sale_date),
      last_sale_price      = coalesce(excluded.last_sale_price, leads.last_sale_price),
      permit_score         = coalesce(excluded.permit_score, leads.permit_score),
      equity_signal_score  = coalesce(excluded.equity_signal_score, leads.equity_signal_score),
      final_priority_score = coalesce(excluded.final_priority_score, leads.final_priority_score),
      campaign_id          = coalesce(leads.campaign_id, excluded.campaign_id)
    returning (xmax = 0) into v_was_insert;

    if v_was_insert then
      v_inserted := v_inserted + 1;
    else
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'skipped', v_skipped);
end;
$$;

-- ---------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------

revoke all on function public.record_lead_visit(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_lead_visit(text, text, jsonb) to service_role;

revoke all on function public.record_lead_cta(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_lead_cta(text, text, jsonb) to service_role;

revoke all on function public.next_lead_code(text) from public, anon;
grant execute on function public.next_lead_code(text) to authenticated, service_role;

revoke all on function public.import_leads(jsonb, uuid) from public, anon;
grant execute on function public.import_leads(jsonb, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Row Level Security
-- Internal tool: any signed-in team member has full access.
-- Anonymous visitors have NO access to any table.
-- ---------------------------------------------------------------------

alter table public.campaigns          enable row level security;
alter table public.leads              enable row level security;
alter table public.tracking_events    enable row level security;
alter table public.lead_code_counters enable row level security; -- no policies: only security-definer functions touch it

drop policy if exists "team_all_campaigns" on public.campaigns;
create policy "team_all_campaigns" on public.campaigns
  for all to authenticated using (true) with check (true);

drop policy if exists "team_all_leads" on public.leads;
create policy "team_all_leads" on public.leads
  for all to authenticated using (true) with check (true);

drop policy if exists "team_all_tracking_events" on public.tracking_events;
create policy "team_all_tracking_events" on public.tracking_events
  for all to authenticated using (true) with check (true);

revoke all on public.campaigns, public.leads, public.tracking_events, public.lead_code_counters from anon;

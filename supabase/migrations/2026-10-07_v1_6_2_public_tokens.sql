-- =====================================================================
-- V1.6.2 — Non-enumerable public lead tokens
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run
-- (after all earlier migrations). Safe to run more than once.
--
-- Public postcard URLs change from  /adu?lead=ANA-0001  (guessable)
--                                 to  /adu?ref=<public_token> (random)
-- lead_code stays exactly as it is for internal use.
--
-- public_token:
--   • 16 URL-safe characters = 96 random bits (base64url of 12 bytes taken
--     from PostgreSQL's cryptographically secure generator via gen_random_uuid())
--   • NOT derived from id, lead_code, APN, address, campaign or time
--   • unique (index), never null, never changed, never reused (tokens of
--     deleted leads are retired and can't be issued again)
--
-- Also: every APPROVED postcard goes back to "ready" because its QR code now
-- points to a different URL — cards must be re-checked before printing.
-- =====================================================================

-- 1. Token generator ------------------------------------------------------
-- gen_random_uuid() is a built-in CSPRNG (pg_strong_random). Bytes 0–5 of a v4
-- UUID are fully random; two UUIDs give 12 random bytes → 16 base64url chars.
create or replace function public.new_public_token()
returns text
language sql
volatile
as $$
  select translate(
           encode(
             decode(
               substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
               || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
               'hex'),
             'base64'),
           '+/', '-_');
$$;

-- Tokens of deleted leads, so a token is never issued twice.
create table if not exists public.retired_public_tokens (
  public_token text primary key,
  retired_at   timestamptz not null default now()
);
alter table public.retired_public_tokens enable row level security;  -- no policies: only definer functions touch it
revoke all on public.retired_public_tokens from anon, authenticated;

-- Fresh token guaranteed unused (live or retired). Retries on the astronomically
-- unlikely collision; gives up loudly rather than looping forever.
create or replace function public.issue_public_token()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v text;
  i int;
begin
  for i in 1..10 loop
    v := public.new_public_token();
    if not exists (select 1 from public.leads where public_token = v)
       and not exists (select 1 from public.retired_public_tokens where public_token = v) then
      return v;
    end if;
  end loop;
  raise exception 'Could not issue a unique public token';
end;
$$;

-- 2. Column + backfill -------------------------------------------------------
alter table public.leads add column if not exists public_token text;

-- Backfill without disturbing anything else (postcard triggers see no printed-content change).
do $$
declare r record;
begin
  for r in select id from public.leads where public_token is null loop
    update public.leads set public_token = public.issue_public_token() where id = r.id;
  end loop;
end;
$$;

create unique index if not exists leads_public_token_key on public.leads (public_token);
alter table public.leads alter column public_token set not null;

alter table public.leads drop constraint if exists leads_public_token_format;
alter table public.leads add constraint leads_public_token_format
  check (public_token ~ '^[A-Za-z0-9_-]{16}$');

-- 3. New leads get a token; tokens never change -----------------------------
create or replace function public.leads_public_token_guard()
returns trigger
language plpgsql
security definer          -- importers (signed-in users) can't call issue_public_token() directly
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Always issued by the database, never supplied by a caller.
    new.public_token := public.issue_public_token();
  elsif new.public_token is distinct from old.public_token then
    raise exception 'public_token cannot be changed (lead %)', old.lead_code;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_public_token_guard on public.leads;
create trigger trg_leads_public_token_guard
  before insert or update on public.leads
  for each row execute function public.leads_public_token_guard();

-- Retire a deleted lead's token so it is never reused.
create or replace function public.leads_retire_public_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.public_token is not null then
    insert into public.retired_public_tokens (public_token) values (old.public_token)
    on conflict (public_token) do nothing;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_leads_retire_public_token on public.leads;
create trigger trg_leads_retire_public_token
  after delete on public.leads
  for each row execute function public.leads_retire_public_token();

-- 4. Public tracking by token (wraps the existing functions, so the
--    30-minute dedupe and all counters behave exactly as before) ------------
create or replace function public.record_lead_visit_by_token(
  p_token    text,
  p_source   text  default 'qr',
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if coalesce(p_token, '') !~ '^[A-Za-z0-9_-]{16}$' then
    return false;
  end if;
  select lead_code into v_code from public.leads where public_token = p_token;  -- exact, case-sensitive
  if v_code is null then
    return false;
  end if;
  return public.record_lead_visit(v_code, p_source, p_metadata);
end;
$$;

create or replace function public.record_lead_cta_by_token(
  p_token    text,
  p_cta      text,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if coalesce(p_token, '') !~ '^[A-Za-z0-9_-]{16}$' then
    return false;
  end if;
  select lead_code into v_code from public.leads where public_token = p_token;
  if v_code is null then
    return false;
  end if;
  return public.record_lead_cta(v_code, p_cta, p_metadata);
end;
$$;

revoke all on function public.record_lead_visit_by_token(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_lead_visit_by_token(text, text, jsonb) to service_role;
revoke all on function public.record_lead_cta_by_token(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_lead_cta_by_token(text, text, jsonb) to service_role;
revoke all on function public.new_public_token() from public, anon;
revoke all on function public.issue_public_token() from public, anon, authenticated;

-- 5. QR destinations changed → approved postcards need a fresh review ------
--    Runs once: only while a marker row is absent.
create table if not exists public.app_migrations_applied (name text primary key, applied_at timestamptz not null default now());
alter table public.app_migrations_applied enable row level security;
revoke all on public.app_migrations_applied from anon, authenticated;

do $$
begin
  if not exists (select 1 from public.app_migrations_applied where name = 'v1_6_2_reset_postcard_approvals') then
    update public.leads
       set postcard_status = 'ready',
           postcard_approved_at = null,
           postcard_approved_image_url = null
     where postcard_status = 'approved';
    insert into public.app_migrations_applied (name) values ('v1_6_2_reset_postcard_approvals');
  end if;
end;
$$;

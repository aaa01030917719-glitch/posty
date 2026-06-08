-- Posty reference collection and Manus analysis schema
-- Assumes docs/supabase/schema.sql has already been executed.
-- Run this file manually in the Supabase SQL Editor.
-- This file does not execute migrations automatically.
--
-- Product notes:
-- - Posty only imports Linkko folders explicitly selected by the user.
-- - Linkko folder disconnection must not delete existing references or analyses.
-- - Linkko account disconnection is recorded with status and disconnected_at
--   instead of deleting connection rows.
-- - Linkko folder disconnection is recorded with is_enabled and disconnected_at
--   instead of deleting integration rows.
-- - URL canonicalization and fingerprinting are owned by Posty application code.
-- - Service-role processors write queue, webhook, and analysis records; trigger
--   checks below keep cross-owner references from being written accidentally.

create table if not exists public.linkko_account_connections (
  id uuid primary key default gen_random_uuid(),
  posty_user_id uuid not null references auth.users (id) on delete cascade,
  linkko_user_id text not null check (btrim(linkko_user_id) <> ''),
  status text not null default 'connected'
    check (status in ('connected', 'disconnected')),
  connected_at timestamptz not null default timezone('utc', now()),
  disconnected_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint linkko_account_connections_user_linkko_key
    unique (posty_user_id, linkko_user_id),
  constraint linkko_account_connections_disconnect_state_check
    check (
      (status = 'connected' and disconnected_at is null)
      or status = 'disconnected'
    )
);

create table if not exists public.linkko_folder_integrations (
  id uuid primary key default gen_random_uuid(),
  posty_user_id uuid not null references auth.users (id) on delete cascade,
  linkko_account_connection_id uuid
    references public.linkko_account_connections (id) on delete set null,
  linkko_folder_id text not null check (btrim(linkko_folder_id) <> ''),
  folder_name text not null check (btrim(folder_name) <> ''),
  is_enabled boolean not null default true,
  connected_at timestamptz not null default timezone('utc', now()),
  disconnected_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint linkko_folder_integrations_user_folder_key
    unique (posty_user_id, linkko_folder_id),
  constraint linkko_folder_integrations_disconnect_state_check
    check (
      (is_enabled = true and disconnected_at is null)
      or is_enabled = false
    )
);

create table if not exists public.references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canonical_url text not null check (btrim(canonical_url) <> ''),
  url_fingerprint text not null check (btrim(url_fingerprint) <> ''),
  canonicalizer_version text not null check (btrim(canonicalizer_version) <> ''),
  platform text not null default 'unknown'
    check (
      platform in (
        'instagram_reel',
        'instagram_post',
        'threads',
        'youtube_short',
        'youtube',
        'web',
        'unknown'
      )
    ),
  title text,
  thumbnail_url text,
  analysis_status text not null default 'pending'
    check (
      analysis_status in (
        'pending',
        'queued',
        'processing',
        'completed',
        'partial',
        'unavailable',
        'failed'
      )
    ),
  latest_analysis_id uuid,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint references_user_fingerprint_key
    unique (user_id, url_fingerprint),
  constraint references_seen_order_check
    check (last_seen_at >= first_seen_at)
);

create table if not exists public.reference_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reference_id uuid not null
    references public.references (id) on delete cascade,
  source_system text not null default 'linkko'
    check (source_system in ('linkko')),
  source_item_id text not null check (btrim(source_item_id) <> ''),
  source_folder_id text,
  source_folder_name text,
  raw_url text not null check (btrim(raw_url) <> ''),
  custom_title text,
  preview_title text,
  preview_description text,
  preview_image text,
  preview_site_name text,
  memo text,
  source_created_at timestamptz,
  source_deleted_at timestamptz,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reference_sources_user_source_item_key
    unique (user_id, source_system, source_item_id)
);

create table if not exists public.reference_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  linkko_folder_integration_id uuid
    references public.linkko_folder_integrations (id) on delete set null,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'queued',
        'running',
        'pausing',
        'paused',
        'resuming',
        'canceling',
        'canceled',
        'completed',
        'failed'
      )
    ),
  cursor_created_at timestamptz,
  cursor_id text,
  total_estimated integer check (total_estimated is null or total_estimated >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  queued_count integer not null default 0 check (queued_count >= 0),
  analyzed_count integer not null default 0 check (analyzed_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reference_import_batches_finish_state_check
    check (
      finished_at is null
      or status in ('canceled', 'completed', 'failed')
    )
);

comment on table public.reference_import_batches is
  'Backfill pause, resume, and cancel operations are handled by authenticated API routes that verify the user and write with the service role.';

create table if not exists public.reference_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reference_id uuid not null
    references public.references (id) on delete cascade,
  job_type text not null
    check (job_type in ('realtime', 'manual_reanalyze', 'backfill', 'retry')),
  status text not null default 'queued'
    check (
      status in (
        'queued',
        'processing',
        'submitted',
        'completed',
        'completed_with_extraction_error',
        'retry_scheduled',
        'failed',
        'canceled'
      )
    ),
  priority integer not null
    check (
      (job_type = 'realtime' and priority = 100)
      or (job_type = 'manual_reanalyze' and priority = 90)
      or (job_type = 'backfill' and priority = 50)
      or (job_type = 'retry' and priority = 20)
    ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  available_at timestamptz not null default timezone('utc', now()),
  locked_at timestamptz,
  locked_by text,
  manus_task_id text,
  manus_task_url text,
  manus_request_id text,
  credit_usage numeric(12, 4) check (credit_usage is null or credit_usage >= 0),
  failure_code text,
  failure_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reference_analysis_jobs_attempts_check
    check (attempt_count <= max_attempts)
);

create table if not exists public.reference_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reference_id uuid not null
    references public.references (id) on delete cascade,
  analysis_job_id uuid
    references public.reference_analysis_jobs (id) on delete set null,
  provider text not null default 'manus'
    check (provider in ('manus')),
  agent_profile text,
  schema_version text not null check (btrim(schema_version) <> ''),
  transcript text,
  captions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(captions) = 'array'),
  viral_factors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(viral_factors) = 'array'),
  business_use_points jsonb not null default '[]'::jsonb
    check (jsonb_typeof(business_use_points) = 'array'),
  content_angles jsonb not null default '[]'::jsonb
    check (jsonb_typeof(content_angles) = 'array'),
  risk_notes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(risk_notes) = 'array'),
  raw_result jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_result) = 'object'),
  completed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reference_sync_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_system text not null default 'linkko'
    check (source_system in ('linkko')),
  source_event_id text not null check (btrim(source_event_id) <> ''),
  source_item_id text check (source_item_id is null or btrim(source_item_id) <> ''),
  event_type text not null
    check (
      event_type in (
        'folder_connected',
        'folder_disconnected',
        'backfill_started',
        'backfill_page_imported',
        'backfill_completed',
        'reference_created',
        'reference_updated',
        'reference_deleted'
      )
    ),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint reference_sync_events_source_event_key
    unique (source_system, source_event_id)
);

create table if not exists public.manus_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null check (btrim(event_id) <> ''),
  manus_task_id text,
  signature_valid boolean not null default false,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint manus_webhook_events_event_id_key unique (event_id)
);

alter table public.references
  drop constraint if exists references_latest_analysis_id_fkey;

alter table public.references
  add constraint references_latest_analysis_id_fkey
  foreign key (latest_analysis_id)
  references public.reference_analyses (id)
  on delete set null;

create or replace function public.validate_linkko_folder_integration_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.linkko_account_connection_id is not null and not exists (
    select 1
    from public.linkko_account_connections c
    where c.id = new.linkko_account_connection_id
      and c.posty_user_id = new.posty_user_id
  ) then
    raise exception 'Linkko account connection must belong to the integration owner';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_linkko_folder_integration_ownership
  on public.linkko_folder_integrations;
create trigger validate_linkko_folder_integration_ownership
before insert or update of posty_user_id, linkko_account_connection_id
on public.linkko_folder_integrations
for each row
execute function public.validate_linkko_folder_integration_ownership();

create or replace function public.validate_reference_latest_analysis_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.latest_analysis_id is not null and not exists (
    select 1
    from public.reference_analyses a
    where a.id = new.latest_analysis_id
      and a.user_id = new.user_id
      and a.reference_id = new.id
  ) then
    raise exception 'Latest analysis must belong to the same reference owner and reference';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_reference_latest_analysis_ownership
  on public.references;
create trigger validate_reference_latest_analysis_ownership
before insert or update of user_id, latest_analysis_id
on public.references
for each row
execute function public.validate_reference_latest_analysis_ownership();

create or replace function public.validate_reference_source_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.references r
    where r.id = new.reference_id
      and r.user_id = new.user_id
  ) then
    raise exception 'Reference source must belong to the reference owner';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_reference_source_ownership
  on public.reference_sources;
create trigger validate_reference_source_ownership
before insert or update of user_id, reference_id
on public.reference_sources
for each row
execute function public.validate_reference_source_ownership();

create or replace function public.validate_reference_import_batch_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.linkko_folder_integration_id is not null and not exists (
    select 1
    from public.linkko_folder_integrations i
    where i.id = new.linkko_folder_integration_id
      and i.posty_user_id = new.user_id
  ) then
    raise exception 'Import batch integration must belong to the batch owner';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_reference_import_batch_ownership
  on public.reference_import_batches;
create trigger validate_reference_import_batch_ownership
before insert or update of user_id, linkko_folder_integration_id
on public.reference_import_batches
for each row
execute function public.validate_reference_import_batch_ownership();

create or replace function public.validate_reference_analysis_job_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.references r
    where r.id = new.reference_id
      and r.user_id = new.user_id
  ) then
    raise exception 'Analysis job must belong to the reference owner';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_reference_analysis_job_ownership
  on public.reference_analysis_jobs;
create trigger validate_reference_analysis_job_ownership
before insert or update of user_id, reference_id
on public.reference_analysis_jobs
for each row
execute function public.validate_reference_analysis_job_ownership();

create or replace function public.validate_reference_analysis_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.references r
    where r.id = new.reference_id
      and r.user_id = new.user_id
  ) then
    raise exception 'Analysis must belong to the reference owner';
  end if;

  if new.analysis_job_id is not null and not exists (
    select 1
    from public.reference_analysis_jobs j
    where j.id = new.analysis_job_id
      and j.user_id = new.user_id
      and j.reference_id = new.reference_id
  ) then
    raise exception 'Analysis job must belong to the same reference and owner';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_reference_analysis_ownership
  on public.reference_analyses;
create trigger validate_reference_analysis_ownership
before insert or update of user_id, reference_id, analysis_job_id
on public.reference_analyses
for each row
execute function public.validate_reference_analysis_ownership();

create index if not exists idx_linkko_account_connections_user_status
  on public.linkko_account_connections (posty_user_id, status, created_at desc);

create index if not exists idx_linkko_folder_integrations_user_enabled
  on public.linkko_folder_integrations (posty_user_id, is_enabled, created_at desc);

create index if not exists idx_references_user_status_updated
  on public.references (user_id, analysis_status, updated_at desc);

create index if not exists idx_references_user_platform_seen
  on public.references (user_id, platform, last_seen_at desc);

create index if not exists idx_reference_sources_reference
  on public.reference_sources (reference_id, created_at desc);

create index if not exists idx_reference_sources_user_folder_seen
  on public.reference_sources (user_id, source_folder_id, last_seen_at desc);

create index if not exists idx_reference_import_batches_user_status
  on public.reference_import_batches (user_id, status, created_at desc);

create index if not exists idx_reference_import_batches_integration_status
  on public.reference_import_batches (linkko_folder_integration_id, status, created_at desc);

create index if not exists idx_reference_analysis_jobs_queue
  on public.reference_analysis_jobs (status, available_at, priority desc, created_at)
  where status = 'queued';

create unique index if not exists idx_reference_analysis_jobs_one_active
  on public.reference_analysis_jobs (reference_id)
  where status in ('queued', 'processing', 'submitted', 'retry_scheduled');

create index if not exists idx_reference_analysis_jobs_locked
  on public.reference_analysis_jobs (locked_at)
  where status = 'processing';

create index if not exists idx_reference_analysis_jobs_reference_created
  on public.reference_analysis_jobs (reference_id, created_at desc);

create index if not exists idx_reference_analyses_reference_completed
  on public.reference_analyses (reference_id, completed_at desc);

create index if not exists idx_reference_sync_events_user_created
  on public.reference_sync_events (user_id, created_at desc);

create index if not exists idx_reference_sync_events_source_item
  on public.reference_sync_events (source_system, source_item_id, created_at desc);

create index if not exists idx_manus_webhook_events_task_created
  on public.manus_webhook_events (manus_task_id, created_at desc);

drop trigger if exists set_linkko_account_connections_updated_at
  on public.linkko_account_connections;
create trigger set_linkko_account_connections_updated_at
before update on public.linkko_account_connections
for each row
execute function public.set_updated_at();

drop trigger if exists set_linkko_folder_integrations_updated_at
  on public.linkko_folder_integrations;
create trigger set_linkko_folder_integrations_updated_at
before update on public.linkko_folder_integrations
for each row
execute function public.set_updated_at();

drop trigger if exists set_references_updated_at
  on public.references;
create trigger set_references_updated_at
before update on public.references
for each row
execute function public.set_updated_at();

drop trigger if exists set_reference_sources_updated_at
  on public.reference_sources;
create trigger set_reference_sources_updated_at
before update on public.reference_sources
for each row
execute function public.set_updated_at();

drop trigger if exists set_reference_import_batches_updated_at
  on public.reference_import_batches;
create trigger set_reference_import_batches_updated_at
before update on public.reference_import_batches
for each row
execute function public.set_updated_at();

drop trigger if exists set_reference_analysis_jobs_updated_at
  on public.reference_analysis_jobs;
create trigger set_reference_analysis_jobs_updated_at
before update on public.reference_analysis_jobs
for each row
execute function public.set_updated_at();

alter table public.linkko_account_connections enable row level security;
alter table public.linkko_folder_integrations enable row level security;
alter table public.references enable row level security;
alter table public.reference_sources enable row level security;
alter table public.reference_import_batches enable row level security;
alter table public.reference_analysis_jobs enable row level security;
alter table public.reference_analyses enable row level security;
alter table public.reference_sync_events enable row level security;
alter table public.manus_webhook_events enable row level security;

drop policy if exists linkko_account_connections_select_own
  on public.linkko_account_connections;
create policy linkko_account_connections_select_own
on public.linkko_account_connections
for select
using (auth.uid() = posty_user_id);

drop policy if exists linkko_account_connections_insert_own
  on public.linkko_account_connections;

drop policy if exists linkko_account_connections_update_own
  on public.linkko_account_connections;

drop policy if exists linkko_account_connections_delete_own
  on public.linkko_account_connections;
-- Account connect/disconnect writes go through authenticated API routes, then
-- service-role code records status and disconnected_at.

drop policy if exists linkko_folder_integrations_select_own
  on public.linkko_folder_integrations;
create policy linkko_folder_integrations_select_own
on public.linkko_folder_integrations
for select
using (auth.uid() = posty_user_id);

drop policy if exists linkko_folder_integrations_insert_own
  on public.linkko_folder_integrations;

drop policy if exists linkko_folder_integrations_update_own
  on public.linkko_folder_integrations;

drop policy if exists linkko_folder_integrations_delete_own
  on public.linkko_folder_integrations;
-- Folder connect/disconnect writes go through authenticated API routes, then
-- service-role code records is_enabled and disconnected_at.

drop policy if exists references_select_own on public.references;
create policy references_select_own
on public.references
for select
using (auth.uid() = user_id);

drop policy if exists references_insert_own on public.references;

drop policy if exists references_update_own on public.references;

drop policy if exists references_delete_own on public.references;
-- MVP intentionally does not allow authenticated users to permanently delete
-- references. Add a hidden/archived state later if users need to remove items
-- from the default library view without deleting analyses.
-- Reference creation and analysis status changes are server-managed.

drop policy if exists reference_sources_select_own
  on public.reference_sources;
create policy reference_sources_select_own
on public.reference_sources
for select
using (auth.uid() = user_id);

drop policy if exists reference_sources_insert_own
  on public.reference_sources;

drop policy if exists reference_sources_update_own
  on public.reference_sources;

drop policy if exists reference_sources_delete_own
  on public.reference_sources;
-- Source deletion from Linkko is recorded with source_deleted_at. Authenticated
-- users should not permanently delete source rows in the MVP.
-- Source rows are created and updated by service-role API/event processors.

drop policy if exists reference_import_batches_select_own
  on public.reference_import_batches;
create policy reference_import_batches_select_own
on public.reference_import_batches
for select
using (auth.uid() = user_id);

drop policy if exists reference_import_batches_insert_own
  on public.reference_import_batches;

drop policy if exists reference_import_batches_update_own
  on public.reference_import_batches;

drop policy if exists reference_import_batches_delete_own
  on public.reference_import_batches;
-- Backfill start, pause, resume, and cancel writes go through authenticated API
-- routes, then service-role code updates batch state.

drop policy if exists reference_analysis_jobs_select_own
  on public.reference_analysis_jobs;
create policy reference_analysis_jobs_select_own
on public.reference_analysis_jobs
for select
using (auth.uid() = user_id);

drop policy if exists reference_analysis_jobs_insert_own
  on public.reference_analysis_jobs;

drop policy if exists reference_analysis_jobs_update_own
  on public.reference_analysis_jobs;

drop policy if exists reference_analysis_jobs_delete_own
  on public.reference_analysis_jobs;
-- Analysis jobs are server-managed. Authenticated users can read their own
-- queue status, but service-role processors are the only writers.

drop policy if exists reference_analyses_select_own
  on public.reference_analyses;
create policy reference_analyses_select_own
on public.reference_analyses
for select
using (auth.uid() = user_id);

drop policy if exists reference_analyses_insert_own
  on public.reference_analyses;

drop policy if exists reference_analyses_update_own
  on public.reference_analyses;

drop policy if exists reference_analyses_delete_own
  on public.reference_analyses;
-- Analysis results are server-managed. Authenticated users can read completed
-- analyses for their own references, but cannot write or delete them directly.

drop policy if exists reference_sync_events_select_own
  on public.reference_sync_events;

drop policy if exists reference_sync_events_insert_own
  on public.reference_sync_events;

drop policy if exists reference_sync_events_update_own
  on public.reference_sync_events;

drop policy if exists reference_sync_events_delete_own
  on public.reference_sync_events;
-- Sync events are server-managed idempotency records. Authenticated users can
-- inspect derived progress through API responses, but cannot read or write raw
-- event logs directly.

-- manus_webhook_events intentionally has no authenticated-user policy.
-- Webhook idempotency logs are written and read by server-side service-role code only.

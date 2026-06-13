-- Posty reference analysis policy controls patch
-- Run manually in the Supabase SQL Editor after:
-- 1. docs/supabase/add_references.sql
-- 2. docs/supabase/add_manus_reference_analysis_runtime.sql
--
-- This file is a draft patch only; it is not executed automatically.
-- Purpose:
-- - Keep automatic Manus submissions paused by default.
-- - Add per-user daily submission limits and credit estimate metadata.
-- - Preserve existing queued and completed analysis data.
-- - Allow service-role API routes to write settings and jobs while users can
--   only read their own settings through RLS.

create table if not exists public.reference_analysis_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_auto_analysis_paused boolean not null default true,
  daily_submission_limit integer not null default 5,
  timezone text not null default 'Asia/Seoul',
  estimated_credit_min integer not null default 35,
  estimated_credit_max integer not null default 157,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reference_analysis_settings_daily_limit_check
    check (daily_submission_limit >= 1 and daily_submission_limit <= 100),
  constraint reference_analysis_settings_estimated_credit_min_check
    check (estimated_credit_min >= 0),
  constraint reference_analysis_settings_estimated_credit_range_check
    check (estimated_credit_max >= estimated_credit_min)
);

comment on table public.reference_analysis_settings is
  'Per-user reference analysis cost controls. Writes go through authenticated API routes using the service role.';

comment on column public.reference_analysis_settings.is_auto_analysis_paused is
  'When true, cron-based automatic Manus submissions are blocked. Manual user-confirmed submissions can still run if the daily limit allows.';

alter table public.reference_analysis_settings enable row level security;

drop policy if exists reference_analysis_settings_select_own
  on public.reference_analysis_settings;
create policy reference_analysis_settings_select_own
on public.reference_analysis_settings
for select
using (auth.uid() = user_id);

drop policy if exists reference_analysis_settings_insert_own
  on public.reference_analysis_settings;

drop policy if exists reference_analysis_settings_update_own
  on public.reference_analysis_settings;

drop policy if exists reference_analysis_settings_delete_own
  on public.reference_analysis_settings;
-- Authenticated users do not write this table directly. Settings updates go
-- through /api/references/settings and service-role code.

drop trigger if exists set_reference_analysis_settings_updated_at
  on public.reference_analysis_settings;
create trigger set_reference_analysis_settings_updated_at
before update on public.reference_analysis_settings
for each row
execute function public.set_updated_at();

alter table public.linkko_folder_integrations
  add column if not exists auto_analyze_new_links boolean not null default false;

comment on column public.linkko_folder_integrations.auto_analyze_new_links is
  'Controls Manus analysis for new realtime Linkko links only. Link collection remains controlled by is_enabled.';

alter table public.reference_analysis_jobs
  add column if not exists is_auto_submit_allowed boolean not null default false,
  add column if not exists submission_source text not null default 'manual';

comment on column public.reference_analysis_jobs.is_auto_submit_allowed is
  'Cron workers may only submit jobs where this is true. Existing queued jobs default to false.';

comment on column public.reference_analysis_jobs.submission_source is
  'User or system source that created the submission request: manual, auto_realtime, manual_reanalyze, or backfill.';

alter table public.reference_analysis_jobs
  drop constraint if exists reference_analysis_jobs_submission_source_check;

alter table public.reference_analysis_jobs
  add constraint reference_analysis_jobs_submission_source_check
  check (submission_source in ('manual', 'auto_realtime', 'manual_reanalyze', 'backfill'));

alter table public.reference_analysis_jobs
  drop constraint if exists reference_analysis_jobs_job_type_check;

alter table public.reference_analysis_jobs
  add constraint reference_analysis_jobs_job_type_check
  check (job_type in ('realtime', 'manual', 'manual_reanalyze', 'backfill', 'retry'));

alter table public.reference_analysis_jobs
  drop constraint if exists reference_analysis_jobs_priority_check;

alter table public.reference_analysis_jobs
  add constraint reference_analysis_jobs_priority_check
  check (
    (job_type = 'manual' and priority = 120)
    or (job_type = 'manual_reanalyze' and priority = 110)
    or (job_type = 'realtime' and priority = 100)
    or (job_type = 'backfill' and priority in (10, 50))
    or (job_type = 'retry' and priority = 20)
  );

create index if not exists idx_reference_analysis_jobs_auto_due
  on public.reference_analysis_jobs (status, available_at, priority desc, created_at)
  where status in ('queued', 'retry_scheduled')
    and is_auto_submit_allowed = true
    and manus_task_id is null;

create index if not exists idx_reference_analysis_jobs_user_submitted_day
  on public.reference_analysis_jobs (user_id, submitted_at)
  where submitted_at is not null;

create index if not exists idx_linkko_folder_integrations_user_auto
  on public.linkko_folder_integrations (posty_user_id, is_enabled, auto_analyze_new_links, created_at desc);

-- Safety checks after manual execution:
--
-- select user_id, is_auto_analysis_paused, daily_submission_limit
-- from public.reference_analysis_settings;
--
-- select status, is_auto_submit_allowed, submission_source, count(*)
-- from public.reference_analysis_jobs
-- group by status, is_auto_submit_allowed, submission_source
-- order by status, submission_source;
--
-- Existing queued jobs should remain is_auto_submit_allowed = false unless a
-- later explicit API flow creates or updates a new job.

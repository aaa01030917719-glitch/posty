-- Posty Manus reference analysis runtime patch
-- Run manually in the Supabase SQL Editor after docs/supabase/add_references.sql.
-- This file is a draft patch only; it is not executed automatically.
--
-- Purpose:
-- - Add runtime metadata needed by the Manus queue processor, webhook finalizer,
--   and reconcile route.
-- - Preserve existing reference, source, queue, and analysis data.
-- - Keep writes service-role only through existing RLS policy posture.

alter table public.reference_analysis_jobs
  add column if not exists task_create_request_id text,
  add column if not exists submitted_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists last_polled_at timestamptz,
  add column if not exists credits_used numeric(12, 4),
  add column if not exists webhook_stop_reason text,
  add column if not exists task_detail_status text;

comment on column public.reference_analysis_jobs.task_create_request_id is
  'Safe Manus task.create request id. Does not contain API credentials.';

comment on column public.reference_analysis_jobs.credits_used is
  'Task-level Manus credit usage from task.detail or reconciled usage data. Positive values represent credits consumed.';

alter table public.reference_analyses
  add column if not exists access_status text,
  add column if not exists access_notes text,
  add column if not exists audio_access_status text,
  add column if not exists audio_access_notes text,
  add column if not exists transcript_source text,
  add column if not exists transcript_confidence text,
  add column if not exists structured_output_success boolean,
  add column if not exists credits_used numeric(12, 4),
  add column if not exists manus_task_id text;

alter table public.reference_analyses
  drop constraint if exists reference_analyses_access_status_check;

alter table public.reference_analyses
  add constraint reference_analyses_access_status_check
  check (
    access_status is null
    or access_status in ('accessible', 'partially_accessible', 'inaccessible')
  );

alter table public.reference_analyses
  drop constraint if exists reference_analyses_audio_access_status_check;

alter table public.reference_analyses
  add constraint reference_analyses_audio_access_status_check
  check (
    audio_access_status is null
    or audio_access_status in ('accessible', 'partially_accessible', 'inaccessible', 'unknown')
  );

alter table public.reference_analyses
  drop constraint if exists reference_analyses_transcript_source_check;

alter table public.reference_analyses
  add constraint reference_analyses_transcript_source_check
  check (
    transcript_source is null
    or transcript_source in ('audio', 'visible_captions', 'post_caption', 'mixed', 'unavailable')
  );

alter table public.reference_analyses
  drop constraint if exists reference_analyses_transcript_confidence_check;

alter table public.reference_analyses
  add constraint reference_analyses_transcript_confidence_check
  check (
    transcript_confidence is null
    or transcript_confidence in ('high', 'medium', 'low')
  );

-- The initial draft stored viral_factors and business_use_points as arrays.
-- The confirmed Manus structured output uses objects for these sections.
alter table public.reference_analyses
  drop constraint if exists reference_analyses_viral_factors_check;

alter table public.reference_analyses
  add constraint reference_analyses_viral_factors_check
  check (jsonb_typeof(viral_factors) in ('array', 'object'));

alter table public.reference_analyses
  drop constraint if exists reference_analyses_business_use_points_check;

alter table public.reference_analyses
  add constraint reference_analyses_business_use_points_check
  check (jsonb_typeof(business_use_points) in ('array', 'object'));

create index if not exists idx_reference_analysis_jobs_manus_task
  on public.reference_analysis_jobs (manus_task_id)
  where manus_task_id is not null;

create index if not exists idx_reference_analysis_jobs_reconcile
  on public.reference_analysis_jobs (status, submitted_at, last_polled_at)
  where status in ('submitted', 'processing') and manus_task_id is not null;

create unique index if not exists idx_reference_analyses_one_per_manus_task
  on public.reference_analyses (manus_task_id)
  where manus_task_id is not null;

create index if not exists idx_reference_analyses_audio_status
  on public.reference_analyses (audio_access_status, transcript_source, completed_at desc);

-- Confirmation queries:
--
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('reference_analysis_jobs', 'reference_analyses')
--   and column_name in (
--     'task_create_request_id',
--     'submitted_at',
--     'completed_at',
--     'last_polled_at',
--     'credits_used',
--     'webhook_stop_reason',
--     'task_detail_status',
--     'access_status',
--     'audio_access_status',
--     'transcript_source',
--     'transcript_confidence',
--     'structured_output_success',
--     'manus_task_id'
--   )
-- order by table_name, column_name;
--
-- select indexname
-- from pg_indexes
-- where schemaname = 'public'
--   and indexname in (
--     'idx_reference_analysis_jobs_manus_task',
--     'idx_reference_analysis_jobs_reconcile',
--     'idx_reference_analyses_one_per_manus_task',
--     'idx_reference_analyses_audio_status'
--   )
-- order by indexname;

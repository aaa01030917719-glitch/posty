-- Posty content activity logs follow-up schema
-- Assumes docs/supabase/schema.sql and docs/supabase/add_content_projects.sql
-- have already been executed.
-- Run this file manually in the Supabase SQL Editor.
-- This file does not execute migrations automatically.

create table if not exists public.content_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid references public.content_cards (id) on delete cascade,
  project_id uuid references public.content_projects (id) on delete set null,
  action text not null check (
    action = lower(action)
    and action ~ '^[a-z0-9_]+$'
  ),
  title text,
  description text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.content_activity_logs is
  'Posty activity timeline log for content and project work.';

comment on column public.content_activity_logs.action is
  'Snake_case activity event name, for example draft_saved, completed, deleted, status_changed, schedule_changed, content_created, script_updated, checklist_updated.';

comment on column public.content_activity_logs.metadata is
  'Structured activity details stored as a JSON object.';

create index if not exists idx_content_activity_logs_user_id
  on public.content_activity_logs (user_id);

create index if not exists idx_content_activity_logs_card_id
  on public.content_activity_logs (card_id);

create index if not exists idx_content_activity_logs_project_id
  on public.content_activity_logs (project_id);

create index if not exists idx_content_activity_logs_created_at_desc
  on public.content_activity_logs (created_at desc);

create index if not exists idx_content_activity_logs_action
  on public.content_activity_logs (action);

alter table public.content_activity_logs enable row level security;

drop policy if exists content_activity_logs_select_own on public.content_activity_logs;
create policy content_activity_logs_select_own
on public.content_activity_logs
for select
using (auth.uid() = user_id);

drop policy if exists content_activity_logs_insert_own on public.content_activity_logs;
create policy content_activity_logs_insert_own
on public.content_activity_logs
for insert
with check (auth.uid() = user_id);

drop policy if exists content_activity_logs_update_own on public.content_activity_logs;
create policy content_activity_logs_update_own
on public.content_activity_logs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists content_activity_logs_delete_own on public.content_activity_logs;
create policy content_activity_logs_delete_own
on public.content_activity_logs
for delete
using (auth.uid() = user_id);

-- Posty content_projects follow-up schema
-- Assumes docs/supabase/schema.sql has already been executed.
-- Run this file manually in the Supabase SQL Editor.
-- This file does not execute migrations automatically.

create table if not exists public.content_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active',
  start_date date,
  end_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.content_cards
  add column if not exists project_id uuid;

alter table public.content_cards
  drop constraint if exists content_cards_project_id_fkey;

alter table public.content_cards
  add constraint content_cards_project_id_fkey
  foreign key (project_id)
  references public.content_projects (id)
  on delete set null;

create index if not exists idx_content_projects_user_id
  on public.content_projects (user_id);

create index if not exists idx_content_cards_project_id
  on public.content_cards (project_id);

drop trigger if exists set_content_projects_updated_at on public.content_projects;
create trigger set_content_projects_updated_at
before update on public.content_projects
for each row
execute function public.set_updated_at();

alter table public.content_projects enable row level security;

drop policy if exists content_projects_select_own on public.content_projects;
create policy content_projects_select_own
on public.content_projects
for select
using (auth.uid() = user_id);

drop policy if exists content_projects_insert_own on public.content_projects;
create policy content_projects_insert_own
on public.content_projects
for insert
with check (auth.uid() = user_id);

drop policy if exists content_projects_update_own on public.content_projects;
create policy content_projects_update_own
on public.content_projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists content_projects_delete_own on public.content_projects;
create policy content_projects_delete_own
on public.content_projects
for delete
using (auth.uid() = user_id);

-- Keep the existing own-row rules for content_cards and extend insert/update
-- checks so cards can only link to projects owned by the same user.
drop policy if exists content_cards_insert_own on public.content_cards;
create policy content_cards_insert_own
on public.content_cards
for insert
with check (
  auth.uid() = user_id
  and (
    project_id is null
    or exists (
      select 1
      from public.content_projects p
      where p.id = content_cards.project_id
        and p.user_id = auth.uid()
    )
  )
);

drop policy if exists content_cards_update_own on public.content_cards;
create policy content_cards_update_own
on public.content_cards
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    project_id is null
    or exists (
      select 1
      from public.content_projects p
      where p.id = content_cards.project_id
        and p.user_id = auth.uid()
    )
  )
);

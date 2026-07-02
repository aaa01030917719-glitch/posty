-- Posty reels analytics follow-up schema
-- Assumes docs/supabase/schema.sql has already been executed.
-- Run this file manually in the Supabase SQL Editor.
-- This file does not execute migrations automatically.

create table if not exists public.reels_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  upload_date date not null,
  title text not null check (btrim(title) <> ''),
  topic text,
  category text,
  thumbnail_title text,
  video_length_seconds integer check (
    video_length_seconds is null or video_length_seconds >= 0
  ),
  upload_time time,
  upload_weekday text,
  tags text[] not null default '{}'::text[],
  script_original text,
  first_sentence_hook text,
  hook_char_count integer check (
    hook_char_count is null or hook_char_count >= 0
  ),
  twist_sentence text,
  cta text,
  comment_keyword text,
  screen_type text check (
    screen_type is null
    or screen_type in (
      'talking',
      'site_video',
      'photo',
      'image',
      'ai_image',
      'subtitles',
      'mixed'
    )
  ),
  bgm text,
  scene_change_interval_seconds numeric(8,2) check (
    scene_change_interval_seconds is null
    or scene_change_interval_seconds >= 0
  ),
  first_info_time_seconds numeric(8,2) check (
    first_info_time_seconds is null
    or first_info_time_seconds >= 0
  ),
  hook_types text[] not null default '{}'::text[],
  info_density smallint check (
    info_density is null or info_density between 1 and 5
  ),
  has_product_name boolean not null default false,
  product_name_count integer not null default 0 check (product_name_count >= 0),
  has_brand_name boolean not null default false,
  brand_name_count integer not null default 0 check (brand_name_count >= 0),
  has_model_name boolean not null default false,
  model_name_count integer not null default 0 check (model_name_count >= 0),
  has_cost boolean not null default false,
  number_count integer not null default 0 check (number_count >= 0),
  has_checklist boolean not null default false,
  has_real_case boolean not null default false,
  has_before_after boolean not null default false,
  has_site_photo boolean not null default false,
  success_reason text,
  failure_reason text,
  improvement_idea text,
  next_content_idea text,
  reusable boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reels_analytics_hook_types_check
    check (
      hook_types <@ array[
        'regret',
        'top',
        'recommendation',
        'cost',
        'comparison',
        'insider_exposure',
        'checklist',
        'founder_opinion',
        'counterintuitive',
        'before_after',
        'mistake_prevention',
        'other'
      ]::text[]
    )
);

alter table public.reels_analytics
  add column if not exists comment_keyword text;

create table if not exists public.reels_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reel_id uuid not null references public.reels_analytics (id) on delete cascade,
  snapshot_type text not null check (snapshot_type in ('24h', '7d', '30d', 'current')),
  views integer not null default 0 check (views >= 0),
  reach integer not null default 0 check (reach >= 0),
  avg_watch_time_seconds numeric(8,2) not null default 0 check (avg_watch_time_seconds >= 0),
  avg_watch_rate numeric(8,2) not null default 0 check (avg_watch_rate >= 0),
  completion_rate numeric(8,2) not null default 0 check (completion_rate >= 0),
  likes integer not null default 0 check (likes >= 0),
  comments integer not null default 0 check (comments >= 0),
  saves integer not null default 0 check (saves >= 0),
  shares integer not null default 0 check (shares >= 0),
  profile_visits integer not null default 0 check (profile_visits >= 0),
  follower_growth integer not null default 0 check (follower_growth >= 0),
  dm_count integer not null default 0 check (dm_count >= 0),
  inquiry_count integer not null default 0 check (inquiry_count >= 0),
  contract_count integer not null default 0 check (contract_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reels_analytics_snapshots_reel_type_key
    unique (reel_id, snapshot_type)
);

create index if not exists idx_reels_analytics_user_upload_date
  on public.reels_analytics (user_id, upload_date desc);

create index if not exists idx_reels_analytics_user_category
  on public.reels_analytics (user_id, category);

create index if not exists idx_reels_analytics_hook_types
  on public.reels_analytics using gin (hook_types);

create index if not exists idx_reels_analytics_tags
  on public.reels_analytics using gin (tags);

create index if not exists idx_reels_analytics_snapshots_user_type
  on public.reels_analytics_snapshots (user_id, snapshot_type);

create index if not exists idx_reels_analytics_snapshots_reel_id
  on public.reels_analytics_snapshots (reel_id);

drop trigger if exists set_reels_analytics_updated_at on public.reels_analytics;
create trigger set_reels_analytics_updated_at
before update on public.reels_analytics
for each row
execute function public.set_updated_at();

drop trigger if exists set_reels_analytics_snapshots_updated_at
  on public.reels_analytics_snapshots;
create trigger set_reels_analytics_snapshots_updated_at
before update on public.reels_analytics_snapshots
for each row
execute function public.set_updated_at();

alter table public.reels_analytics enable row level security;
alter table public.reels_analytics_snapshots enable row level security;

drop policy if exists reels_analytics_select_own on public.reels_analytics;
create policy reels_analytics_select_own
on public.reels_analytics
for select
using (auth.uid() = user_id);

drop policy if exists reels_analytics_insert_own on public.reels_analytics;
create policy reels_analytics_insert_own
on public.reels_analytics
for insert
with check (auth.uid() = user_id);

drop policy if exists reels_analytics_update_own on public.reels_analytics;
create policy reels_analytics_update_own
on public.reels_analytics
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists reels_analytics_delete_own on public.reels_analytics;
create policy reels_analytics_delete_own
on public.reels_analytics
for delete
using (auth.uid() = user_id);

drop policy if exists reels_analytics_snapshots_select_own
  on public.reels_analytics_snapshots;
create policy reels_analytics_snapshots_select_own
on public.reels_analytics_snapshots
for select
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.reels_analytics r
    where r.id = reels_analytics_snapshots.reel_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists reels_analytics_snapshots_insert_own
  on public.reels_analytics_snapshots;
create policy reels_analytics_snapshots_insert_own
on public.reels_analytics_snapshots
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.reels_analytics r
    where r.id = reels_analytics_snapshots.reel_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists reels_analytics_snapshots_update_own
  on public.reels_analytics_snapshots;
create policy reels_analytics_snapshots_update_own
on public.reels_analytics_snapshots
for update
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.reels_analytics r
    where r.id = reels_analytics_snapshots.reel_id
      and r.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.reels_analytics r
    where r.id = reels_analytics_snapshots.reel_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists reels_analytics_snapshots_delete_own
  on public.reels_analytics_snapshots;
create policy reels_analytics_snapshots_delete_own
on public.reels_analytics_snapshots
for delete
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.reels_analytics r
    where r.id = reels_analytics_snapshots.reel_id
      and r.user_id = auth.uid()
  )
);

-- Posty content card draft snapshots follow-up schema
-- Assumes docs/supabase/schema.sql has already been executed.
-- Run this file manually in the Supabase SQL Editor.
-- This file does not execute migrations automatically.
--
-- Snapshot shape recommendation:
-- {
--   "schema_version": 1,
--   "card": {
--     "title": "",
--     "project_id": null,
--     "channel_id": null,
--     "status": "writing",
--     "priority": "normal",
--     "scheduled_at": null,
--     "published_at": null,
--     "memo": null,
--     "editor_memo": null,
--     "reference_url": null,
--     "checklist": [],
--     "share_sections": []
--   },
--   "script": {
--     "title": null,
--     "body": null,
--     "caption": null,
--     "hashtags": null,
--     "cta": null,
--     "thumbnail_text": null,
--     "panel_title": null,
--     "is_final": false
--   },
--   "media": {
--     "attachment_ids": [],
--     "inline_ids": [],
--     "items": [
--       {
--         "id": "",
--         "storage_path": "",
--         "file_name": "",
--         "mime_type": "",
--         "media_type": "image",
--         "sort_order": 0,
--         "purpose": "attachment"
--       }
--     ]
--   }
-- }
--
-- Do not store signed URLs or other expiring URLs in snapshot.

create table if not exists public.content_card_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.content_cards (id) on delete cascade,
  title text not null default '제목 없음',
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  source_card_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.content_card_drafts is
  'Snapshot draft rows for content editor temporary saves.';

comment on column public.content_card_drafts.snapshot is
  'JSON object containing restorable content editor state. Store stable media ids and metadata only, never signed URLs.';

create index if not exists content_card_drafts_user_card_created_idx
  on public.content_card_drafts (user_id, card_id, created_at desc);

create index if not exists content_card_drafts_user_created_idx
  on public.content_card_drafts (user_id, created_at desc);

drop trigger if exists set_content_card_drafts_updated_at on public.content_card_drafts;
create trigger set_content_card_drafts_updated_at
before update on public.content_card_drafts
for each row
execute function public.set_updated_at();

alter table public.content_card_drafts enable row level security;

drop policy if exists content_card_drafts_select_own on public.content_card_drafts;
create policy content_card_drafts_select_own
on public.content_card_drafts
for select
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.content_cards c
    where c.id = content_card_drafts.card_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists content_card_drafts_insert_own on public.content_card_drafts;
create policy content_card_drafts_insert_own
on public.content_card_drafts
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.content_cards c
    where c.id = content_card_drafts.card_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists content_card_drafts_update_own on public.content_card_drafts;
create policy content_card_drafts_update_own
on public.content_card_drafts
for update
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.content_cards c
    where c.id = content_card_drafts.card_id
      and c.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.content_cards c
    where c.id = content_card_drafts.card_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists content_card_drafts_delete_own on public.content_card_drafts;
create policy content_card_drafts_delete_own
on public.content_card_drafts
for delete
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.content_cards c
    where c.id = content_card_drafts.card_id
      and c.user_id = auth.uid()
  )
);

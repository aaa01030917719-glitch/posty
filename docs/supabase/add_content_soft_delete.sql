-- Posty content soft delete follow-up schema
-- Assumes docs/supabase/schema.sql has already been executed.
-- Run this file manually in the Supabase SQL Editor.
-- This file does not execute migrations automatically.
--
-- Policy:
-- - Content deletion is a soft delete by default.
-- - content_cards rows are kept so activity logs can continue to reference card_id.
-- - Hard delete remains a later admin/permanent-delete flow.
-- - This file does not change existing RLS policies or FK delete behavior.

alter table public.content_cards
  add column if not exists is_deleted boolean not null default false;

alter table public.content_cards
  add column if not exists deleted_at timestamptz;

alter table public.content_cards
  add column if not exists deleted_reason text;

comment on column public.content_cards.is_deleted is
  '콘텐츠 soft delete 여부';

comment on column public.content_cards.deleted_at is
  '콘텐츠가 soft delete된 시각';

comment on column public.content_cards.deleted_reason is
  '콘텐츠 삭제 사유';

create index if not exists idx_content_cards_is_deleted
  on public.content_cards (is_deleted);

create index if not exists idx_content_cards_deleted_at
  on public.content_cards (deleted_at);

-- Posty content share sections
-- Run this file manually in the Supabase SQL Editor.
-- This file does not apply migrations automatically.
--
-- Scope:
-- - Adds public.content_cards.share_sections for user-defined public share material sections.
-- - Does not create a new table.
-- - Does not modify existing data, RLS policies, foreign keys, or share link behavior.

alter table public.content_cards
  add column if not exists share_sections jsonb not null default '[]'::jsonb;

comment on column public.content_cards.share_sections is
  '공유 자료 공개 페이지에 표시할 사용자 정의 섹션 목록';

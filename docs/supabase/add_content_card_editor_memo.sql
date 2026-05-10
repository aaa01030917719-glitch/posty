-- Posty content_cards editor memo follow-up schema
-- Assumes docs/supabase/schema.sql has already been executed.
-- Run this file manually in the Supabase SQL Editor.
-- This file does not execute migrations automatically.

alter table public.content_cards
  add column if not exists editor_memo text;

comment on column public.content_cards.editor_memo
  is 'editor_memo: 우측 패널 메모 섹션 저장용 메모';

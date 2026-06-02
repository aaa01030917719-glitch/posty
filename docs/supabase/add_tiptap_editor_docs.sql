-- Posty Tiptap editor document schema draft
-- Assumes docs/supabase/schema.sql has already been executed.
-- Run this file manually in the Supabase SQL Editor after review.
-- This file does not execute migrations automatically.
--
-- Scope:
-- - Adds nullable JSONB envelopes for Tiptap editor documents.
-- - Keeps public.content_cards.memo as legacy text fallback, preview, and search-compatible data.
-- - Keeps public.content_cards.share_sections as legacy share material fallback.
-- - Does not migrate or transform existing rows.
-- - Does not modify RLS policies, storage policies, foreign keys, or triggers.
--
-- Tiptap JSON envelope recommendation:
-- {
--   "schema_version": 1,
--   "format": "tiptap-json",
--   "doc": {
--     "type": "doc",
--     "content": []
--   }
-- }
--
-- Inline media node recommendation:
-- {
--   "type": "postyInlineMedia",
--   "attrs": {
--     "mediaId": "MEDIA_ID",
--     "size": "medium",
--     "alt": ""
--   }
-- }
--
-- Do not store signed URLs, expiring URLs, storage paths, or inline image binaries
-- in memo_doc or share_body_doc. Store stable media ids only, then create signed URLs
-- from current media rows when rendering.

alter table public.content_cards
  add column if not exists memo_doc jsonb;

alter table public.content_cards
  add column if not exists share_body_doc jsonb;

alter table public.content_cards
  drop constraint if exists content_cards_memo_doc_object_check;

alter table public.content_cards
  add constraint content_cards_memo_doc_object_check
  check (memo_doc is null or jsonb_typeof(memo_doc) = 'object');

alter table public.content_cards
  drop constraint if exists content_cards_share_body_doc_object_check;

alter table public.content_cards
  add constraint content_cards_share_body_doc_object_check
  check (share_body_doc is null or jsonb_typeof(share_body_doc) = 'object');

comment on column public.content_cards.memo_doc is
  'Tiptap JSON document envelope for content body. Legacy memo text remains as fallback. Do not store signed URLs.';

comment on column public.content_cards.share_body_doc is
  'Tiptap JSON document envelope for share material body. Legacy share_sections remains as fallback. Do not store signed URLs.';

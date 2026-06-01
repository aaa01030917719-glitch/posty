-- Extend content card media attachments to support general files.
-- This migration is intentionally idempotent and preserves existing media rows.
--
-- Existing storage policy already scopes objects by the content-card-media bucket
-- and the authenticated user's top-level folder. This migration does not change
-- RLS policies, storage policies, bucket settings, or existing storage paths.
--
-- Attachment path remains:
--   {user_id}/{card_id}/attachments/{file_name}
-- Inline media path remains:
--   {user_id}/{card_id}/inline/{file_name}

alter table public.content_card_media
  add column if not exists file_size bigint;

alter table public.content_card_media
  drop constraint if exists content_card_media_file_size_nonnegative_check;

alter table public.content_card_media
  add constraint content_card_media_file_size_nonnegative_check
  check (file_size is null or file_size >= 0);

alter table public.content_card_media
  drop constraint if exists content_card_media_media_type_check;

alter table public.content_card_media
  add constraint content_card_media_media_type_check
  check (media_type in ('image', 'video', 'file'));

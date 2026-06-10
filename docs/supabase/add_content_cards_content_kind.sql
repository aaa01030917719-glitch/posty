-- Posty content card kind separation
-- Run this file manually in the Supabase SQL Editor.
-- This file does not execute migrations automatically.
--
-- Policy:
-- - public.content_cards remains the single table for content cards and share materials.
-- - public.content_share_links remains a shared link table for all card kinds.
-- - No separate share material table is created.
-- - Existing share link structure is not changed.
-- - Only the explicitly reviewed card ids below are backfilled as share_material.
-- - Do not infer share_material from share links, share_sections, or share_body_doc.
-- - No indexes are added in this migration.

alter table public.content_cards
  add column if not exists content_kind text not null default 'content';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_cards_content_kind_check'
      and conrelid = 'public.content_cards'::regclass
  ) then
    alter table public.content_cards
      add constraint content_cards_content_kind_check
      check (content_kind in ('content', 'share_material'));
  end if;
end;
$$;

comment on column public.content_cards.content_kind is
  'Separates regular content cards from share material cards. Allowed values: content, share_material.';

update public.content_cards
set content_kind = 'share_material'
where id in (
  'fcb2270b-aeac-4b48-966c-886d08ef355c',
  'e0d38b42-aee7-4719-a284-4da3e98a0364',
  'a8ac071c-aa0e-4400-8268-b6e95a7e5a46',
  '9c07c716-1e15-48a1-aac6-6d9462f9329d',
  'e8283dce-7482-4ca5-bf98-7cddc6285483',
  '6b16cef8-d076-4ee9-b6d6-c9e8d6b695cd',
  '7144d43d-4330-4a70-941c-a3da35c31898',
  'ea495b49-28f6-4877-ba61-8c691f702a18',
  '3a780cd8-2cbd-4409-8465-25a14655fa3b',
  '18144863-5332-4f67-b66f-7d27db096d34',
  '0dee0eb6-e7ac-45c5-947c-8465968f2b16',
  'f1d730ae-49b6-4c47-b036-fc48c864cc14'
);

-- Verification queries.
-- 1) Count rows by content_kind.
select
  content_kind,
  count(*)::integer as card_count
from public.content_cards
group by content_kind
order by content_kind;

-- 2) Review rows explicitly classified as share_material.
select
  id,
  title,
  is_deleted,
  created_at
from public.content_cards
where content_kind = 'share_material'
order by
  is_deleted asc,
  created_at desc;

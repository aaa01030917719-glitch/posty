-- Posty content share links
-- Run this file manually in the Supabase SQL Editor.
-- This file does not apply migrations automatically.
--
-- Scope:
-- - Adds public.content_share_links for read-only external sharing of one content card.
-- - Does not create a public share route, UI, button, RPC, or service-role query.
-- - Does not modify existing tables, columns, or existing RLS policies.

create table if not exists public.content_share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.content_cards (id) on delete cascade,
  token text not null unique,
  is_enabled boolean not null default true,
  expires_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  disabled_at timestamptz null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_share_links_token_key'
      and conrelid = 'public.content_share_links'::regclass
  ) then
    alter table public.content_share_links
      add constraint content_share_links_token_key unique (token);
  end if;
end;
$$;

comment on table public.content_share_links is '콘텐츠 카드 외부 읽기 전용 공유 링크';
comment on column public.content_share_links.token is '공개 공유 URL 접근용 추측 불가능 토큰';
comment on column public.content_share_links.is_enabled is '공유 링크 활성화 여부';
comment on column public.content_share_links.expires_at is '공유 링크 만료 시각';

create index if not exists idx_content_share_links_user_id
on public.content_share_links (user_id);

create index if not exists idx_content_share_links_card_id
on public.content_share_links (card_id);

create index if not exists idx_content_share_links_token
on public.content_share_links (token);

create index if not exists idx_content_share_links_is_enabled
on public.content_share_links (is_enabled);

create index if not exists idx_content_share_links_expires_at
on public.content_share_links (expires_at);

create index if not exists idx_content_share_links_created_at_desc
on public.content_share_links (created_at desc);

alter table public.content_share_links enable row level security;

drop policy if exists content_share_links_select_own on public.content_share_links;
create policy content_share_links_select_own
on public.content_share_links
for select
using (auth.uid() = user_id);

drop policy if exists content_share_links_insert_own on public.content_share_links;
create policy content_share_links_insert_own
on public.content_share_links
for insert
with check (auth.uid() = user_id);

drop policy if exists content_share_links_update_own on public.content_share_links;
create policy content_share_links_update_own
on public.content_share_links
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists content_share_links_delete_own on public.content_share_links;
create policy content_share_links_delete_own
on public.content_share_links
for delete
using (auth.uid() = user_id);

-- Public share access policy note:
-- This SQL intentionally does not add an anonymous token-based RLS policy.
-- The future public share page should resolve /share/content/[token] through
-- a server-side service-role query or a narrowly scoped RPC that verifies:
-- - content_share_links.token matches the request token
-- - content_share_links.is_enabled = true
-- - content_share_links.expires_at is null or in the future
-- - the related content card is not soft-deleted
--
-- Shared responses must stay read-only and must not expose editor_memo,
-- full activity logs, delete/restore history, user account information,
-- or internal Supabase ids that are not needed by external viewers.

-- Posty Instagram comment auto DM schema
-- Assumes docs/supabase/schema.sql and docs/supabase/add_content_share_links.sql
-- have already been executed.
-- Run this file manually in the Supabase SQL Editor.
-- This file does not execute migrations automatically.
--
-- Security notes:
-- - Never store a plaintext Instagram access token.
-- - instagram_connection_secrets has RLS enabled and intentionally has no
--   authenticated-user policies. Only server-side service-role code may access it.
-- - The OAuth implementation must encrypt tokens before storage with a server-only key.
-- - The delivery processor must revalidate content_share_links.is_enabled,
--   expires_at, and the related content card deletion state before sending a link.

create table if not exists public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  instagram_professional_account_id text not null
    check (btrim(instagram_professional_account_id) <> ''),
  instagram_username text not null
    check (btrim(instagram_username) <> ''),
  token_expires_at timestamptz,
  connected_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint instagram_connections_user_account_key
    unique (user_id, instagram_professional_account_id)
);

create table if not exists public.instagram_connection_secrets (
  id uuid primary key default gen_random_uuid(),
  instagram_connection_id uuid not null unique
    references public.instagram_connections (id) on delete cascade,
  access_token_ciphertext text not null
    check (btrim(access_token_ciphertext) <> ''),
  encryption_key_version text not null
    check (btrim(encryption_key_version) <> ''),
  token_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.instagram_auto_dm_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  instagram_connection_id uuid not null
    references public.instagram_connections (id) on delete cascade,
  share_link_id uuid
    references public.content_share_links (id) on delete set null,
  title text not null check (btrim(title) <> ''),
  media_id text not null check (btrim(media_id) <> ''),
  media_type text not null check (btrim(media_type) <> ''),
  media_permalink text,
  media_preview_url text,
  keyword text not null check (btrim(keyword) <> ''),
  initial_private_reply_message text not null default
    '자료는 팔로우 확인 후 보내드려요🙂 계정을 팔로우한 뒤 DM으로 팔로우완료라고 답장해주세요'
    check (btrim(initial_private_reply_message) <> ''),
  public_comment_reply_message text not null default
    'DM 보내드렸어요🙂 메시지 요청함도 확인해주세요'
    check (btrim(public_comment_reply_message) <> ''),
  follow_required_message text not null default
    '아직 팔로우가 확인되지 않았어요🙂 팔로우 후 팔로우완료라고 다시 답장해주세요'
    check (btrim(follow_required_message) <> ''),
  material_delivery_message text not null default
    '요청하신 자료를 보내드릴게요🙂 {link}'
    check (
      btrim(material_delivery_message) <> ''
      and position('{link}' in material_delivery_message) > 0
    ),
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint instagram_auto_dm_rules_connection_media_key
    unique (instagram_connection_id, media_id)
);

comment on column public.instagram_auto_dm_rules.material_delivery_message is
  'Message template. Server delivery code replaces the required {link} placeholder with the active public share URL.';

create table if not exists public.instagram_auto_dm_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  instagram_connection_id uuid
    references public.instagram_connections (id) on delete set null,
  rule_id uuid
    references public.instagram_auto_dm_rules (id) on delete set null,
  comment_id text not null check (btrim(comment_id) <> ''),
  media_id text not null check (btrim(media_id) <> ''),
  commenter_instagram_scoped_id text not null
    check (btrim(commenter_instagram_scoped_id) <> ''),
  commenter_username text,
  comment_text text not null,
  lifecycle_status text not null default 'comment_received'
    check (
      lifecycle_status in (
        'comment_received',
        'keyword_matched',
        'waiting_for_user_reply',
        'follow_check_pending',
        'waiting_for_follow',
        'material_sent',
        'failed',
        'duplicate_skipped'
      )
    ),
  initial_reply_status text not null default 'pending'
    check (initial_reply_status in ('pending', 'sent', 'failed')),
  public_reply_status text not null default 'not_attempted'
    check (public_reply_status in ('not_attempted', 'pending', 'sent', 'failed')),
  follow_status text not null default 'unknown'
    check (follow_status in ('unknown', 'pending', 'following', 'not_following', 'check_failed')),
  delivery_status text not null default 'not_ready'
    check (delivery_status in ('not_ready', 'pending', 'sent', 'failed')),
  initial_private_reply_message_id text,
  public_comment_reply_id text,
  material_delivery_message_id text,
  initial_private_reply_sent_at timestamptz,
  public_comment_reply_sent_at timestamptz,
  user_replied_at timestamptz,
  follow_checked_at timestamptz,
  material_sent_at timestamptz,
  failure_stage text,
  failure_code text,
  failure_reason text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint instagram_auto_dm_events_connection_comment_key
    unique (instagram_connection_id, comment_id)
);

comment on table public.instagram_auto_dm_events is
  'Server-managed processing history for Instagram comment auto DM events.';

comment on column public.instagram_auto_dm_events.instagram_connection_id is
  'Nullable only to preserve event history after a connection is deleted.';

comment on column public.instagram_auto_dm_events.rule_id is
  'Nullable only to preserve event history after a rule is deleted. Disable rules instead of deleting them during normal operation.';

-- Prevent cross-owner rule references even when writes use the service role.
create or replace function public.validate_instagram_auto_dm_rule_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.instagram_connections ic
    where ic.id = new.instagram_connection_id
      and ic.user_id = new.user_id
  ) then
    raise exception 'Instagram connection must belong to the rule owner';
  end if;

  if new.share_link_id is not null and not exists (
    select 1
    from public.content_share_links csl
    where csl.id = new.share_link_id
      and csl.user_id = new.user_id
  ) then
    raise exception 'Share link must belong to the rule owner';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_instagram_auto_dm_rule_ownership
  on public.instagram_auto_dm_rules;
create trigger validate_instagram_auto_dm_rule_ownership
before insert or update of user_id, instagram_connection_id, share_link_id
on public.instagram_auto_dm_rules
for each row
execute function public.validate_instagram_auto_dm_rule_ownership();

-- Events are written by service-role processors, so validate their ownership too.
create or replace function public.validate_instagram_auto_dm_event_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.instagram_connection_id is not null and not exists (
    select 1
    from public.instagram_connections ic
    where ic.id = new.instagram_connection_id
      and ic.user_id = new.user_id
  ) then
    raise exception 'Instagram connection must belong to the event owner';
  end if;

  if new.rule_id is not null and not exists (
    select 1
    from public.instagram_auto_dm_rules r
    where r.id = new.rule_id
      and r.user_id = new.user_id
      and (
        new.instagram_connection_id is null
        or r.instagram_connection_id = new.instagram_connection_id
      )
  ) then
    raise exception 'Auto DM rule must belong to the event owner and connection';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_instagram_auto_dm_event_ownership
  on public.instagram_auto_dm_events;
create trigger validate_instagram_auto_dm_event_ownership
before insert or update of user_id, instagram_connection_id, rule_id
on public.instagram_auto_dm_events
for each row
execute function public.validate_instagram_auto_dm_event_ownership();

create index if not exists idx_instagram_connections_user_created
  on public.instagram_connections (user_id, created_at desc);

create index if not exists idx_instagram_auto_dm_rules_enabled_media
  on public.instagram_auto_dm_rules (instagram_connection_id, media_id)
  where enabled = true;

create index if not exists idx_instagram_auto_dm_rules_user_created
  on public.instagram_auto_dm_rules (user_id, created_at desc);

create index if not exists idx_instagram_auto_dm_events_recent_waiting
  on public.instagram_auto_dm_events (
    instagram_connection_id,
    commenter_instagram_scoped_id,
    lifecycle_status,
    created_at desc
  );

create index if not exists idx_instagram_auto_dm_events_user_created
  on public.instagram_auto_dm_events (user_id, created_at desc);

drop trigger if exists set_instagram_connections_updated_at
  on public.instagram_connections;
create trigger set_instagram_connections_updated_at
before update on public.instagram_connections
for each row
execute function public.set_updated_at();

drop trigger if exists set_instagram_connection_secrets_updated_at
  on public.instagram_connection_secrets;
create trigger set_instagram_connection_secrets_updated_at
before update on public.instagram_connection_secrets
for each row
execute function public.set_updated_at();

drop trigger if exists set_instagram_auto_dm_rules_updated_at
  on public.instagram_auto_dm_rules;
create trigger set_instagram_auto_dm_rules_updated_at
before update on public.instagram_auto_dm_rules
for each row
execute function public.set_updated_at();

drop trigger if exists set_instagram_auto_dm_events_updated_at
  on public.instagram_auto_dm_events;
create trigger set_instagram_auto_dm_events_updated_at
before update on public.instagram_auto_dm_events
for each row
execute function public.set_updated_at();

alter table public.instagram_connections enable row level security;
alter table public.instagram_connection_secrets enable row level security;
alter table public.instagram_auto_dm_rules enable row level security;
alter table public.instagram_auto_dm_events enable row level security;

drop policy if exists instagram_connections_select_own on public.instagram_connections;
create policy instagram_connections_select_own
on public.instagram_connections
for select
using (auth.uid() = user_id);

drop policy if exists instagram_connections_insert_own on public.instagram_connections;
create policy instagram_connections_insert_own
on public.instagram_connections
for insert
with check (auth.uid() = user_id);

drop policy if exists instagram_connections_update_own on public.instagram_connections;
create policy instagram_connections_update_own
on public.instagram_connections
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists instagram_connections_delete_own on public.instagram_connections;
create policy instagram_connections_delete_own
on public.instagram_connections
for delete
using (auth.uid() = user_id);

-- instagram_connection_secrets intentionally has no authenticated-user policies.

drop policy if exists instagram_auto_dm_rules_select_own on public.instagram_auto_dm_rules;
create policy instagram_auto_dm_rules_select_own
on public.instagram_auto_dm_rules
for select
using (auth.uid() = user_id);

drop policy if exists instagram_auto_dm_rules_insert_own on public.instagram_auto_dm_rules;
create policy instagram_auto_dm_rules_insert_own
on public.instagram_auto_dm_rules
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.instagram_connections ic
    where ic.id = instagram_auto_dm_rules.instagram_connection_id
      and ic.user_id = auth.uid()
  )
  and (
    share_link_id is null
    or exists (
      select 1
      from public.content_share_links csl
      where csl.id = instagram_auto_dm_rules.share_link_id
        and csl.user_id = auth.uid()
    )
  )
);

drop policy if exists instagram_auto_dm_rules_update_own on public.instagram_auto_dm_rules;
create policy instagram_auto_dm_rules_update_own
on public.instagram_auto_dm_rules
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.instagram_connections ic
    where ic.id = instagram_auto_dm_rules.instagram_connection_id
      and ic.user_id = auth.uid()
  )
  and (
    share_link_id is null
    or exists (
      select 1
      from public.content_share_links csl
      where csl.id = instagram_auto_dm_rules.share_link_id
        and csl.user_id = auth.uid()
    )
  )
);

drop policy if exists instagram_auto_dm_rules_delete_own on public.instagram_auto_dm_rules;
create policy instagram_auto_dm_rules_delete_own
on public.instagram_auto_dm_rules
for delete
using (auth.uid() = user_id);

drop policy if exists instagram_auto_dm_events_select_own on public.instagram_auto_dm_events;
create policy instagram_auto_dm_events_select_own
on public.instagram_auto_dm_events
for select
using (auth.uid() = user_id);

-- instagram_auto_dm_events intentionally has no authenticated-user insert,
-- update, or delete policies. Webhook processors use the server-side service role.

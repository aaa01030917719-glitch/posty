-- Posty minimum Supabase schema
-- Run this file manually in the Supabase SQL Editor.
-- This file does not apply migrations automatically.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    name,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1),
      'user'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = coalesce(excluded.name, public.profiles.name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('instagram', 'threads', 'youtube', 'blog', 'custom')),
  color text not null default '#ff385c',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#929292',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  channel_type text check (channel_type in ('instagram', 'threads', 'youtube', 'blog', 'custom')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  is_archived boolean not null default false,
  converted_card_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.content_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel_id uuid references public.channels (id) on delete set null,
  title text not null,
  format text,
  status text not null default 'idea' check (status in ('idea', 'planning', 'writing', 'review', 'scheduled', 'published', 'hold')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  scheduled_at timestamptz,
  published_at timestamptz,
  memo text,
  reference_url text,
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  idea_id uuid references public.ideas (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.ideas
  drop constraint if exists ideas_converted_card_id_fkey;

alter table public.ideas
  add constraint ideas_converted_card_id_fkey
  foreign key (converted_card_id)
  references public.content_cards (id)
  on delete set null;

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.content_cards (id) on delete cascade,
  title text,
  body text,
  caption text,
  hashtags text,
  cta text,
  thumbnail_text text,
  panel_title text,
  is_final boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.mindmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  data jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.card_tags (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.content_cards (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint card_tags_card_id_tag_id_key unique (card_id, tag_id)
);

create table if not exists public.idea_tags (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint idea_tags_idea_id_tag_id_key unique (idea_id, tag_id)
);

create index if not exists idx_channels_user_id on public.channels (user_id);
create index if not exists idx_tags_user_id on public.tags (user_id);
create index if not exists idx_ideas_user_id on public.ideas (user_id);
create index if not exists idx_ideas_converted_card_id on public.ideas (converted_card_id);
create index if not exists idx_content_cards_user_id on public.content_cards (user_id);
create index if not exists idx_content_cards_channel_id on public.content_cards (channel_id);
create index if not exists idx_content_cards_idea_id on public.content_cards (idea_id);
create index if not exists idx_content_cards_scheduled_at on public.content_cards (scheduled_at);
create index if not exists idx_scripts_user_id on public.scripts (user_id);
create index if not exists idx_scripts_card_id on public.scripts (card_id);
create index if not exists idx_mindmaps_user_id on public.mindmaps (user_id);
create index if not exists idx_card_tags_card_id on public.card_tags (card_id);
create index if not exists idx_card_tags_tag_id on public.card_tags (tag_id);
create index if not exists idx_idea_tags_idea_id on public.idea_tags (idea_id);
create index if not exists idx_idea_tags_tag_id on public.idea_tags (tag_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_channels_updated_at on public.channels;
create trigger set_channels_updated_at
before update on public.channels
for each row
execute function public.set_updated_at();

drop trigger if exists set_tags_updated_at on public.tags;
create trigger set_tags_updated_at
before update on public.tags
for each row
execute function public.set_updated_at();

drop trigger if exists set_ideas_updated_at on public.ideas;
create trigger set_ideas_updated_at
before update on public.ideas
for each row
execute function public.set_updated_at();

drop trigger if exists set_content_cards_updated_at on public.content_cards;
create trigger set_content_cards_updated_at
before update on public.content_cards
for each row
execute function public.set_updated_at();

drop trigger if exists set_scripts_updated_at on public.scripts;
create trigger set_scripts_updated_at
before update on public.scripts
for each row
execute function public.set_updated_at();

drop trigger if exists set_mindmaps_updated_at on public.mindmaps;
create trigger set_mindmaps_updated_at
before update on public.mindmaps
for each row
execute function public.set_updated_at();

drop trigger if exists set_card_tags_updated_at on public.card_tags;
create trigger set_card_tags_updated_at
before update on public.card_tags
for each row
execute function public.set_updated_at();

drop trigger if exists set_idea_tags_updated_at on public.idea_tags;
create trigger set_idea_tags_updated_at
before update on public.idea_tags
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.tags enable row level security;
alter table public.ideas enable row level security;
alter table public.content_cards enable row level security;
alter table public.scripts enable row level security;
alter table public.mindmaps enable row level security;
alter table public.card_tags enable row level security;
alter table public.idea_tags enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
on public.profiles
for delete
using (auth.uid() = id);

drop policy if exists channels_select_own on public.channels;
create policy channels_select_own
on public.channels
for select
using (auth.uid() = user_id);

drop policy if exists channels_insert_own on public.channels;
create policy channels_insert_own
on public.channels
for insert
with check (auth.uid() = user_id);

drop policy if exists channels_update_own on public.channels;
create policy channels_update_own
on public.channels
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists channels_delete_own on public.channels;
create policy channels_delete_own
on public.channels
for delete
using (auth.uid() = user_id);

drop policy if exists tags_select_own on public.tags;
create policy tags_select_own
on public.tags
for select
using (auth.uid() = user_id);

drop policy if exists tags_insert_own on public.tags;
create policy tags_insert_own
on public.tags
for insert
with check (auth.uid() = user_id);

drop policy if exists tags_update_own on public.tags;
create policy tags_update_own
on public.tags
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists tags_delete_own on public.tags;
create policy tags_delete_own
on public.tags
for delete
using (auth.uid() = user_id);

drop policy if exists ideas_select_own on public.ideas;
create policy ideas_select_own
on public.ideas
for select
using (auth.uid() = user_id);

drop policy if exists ideas_insert_own on public.ideas;
create policy ideas_insert_own
on public.ideas
for insert
with check (auth.uid() = user_id);

drop policy if exists ideas_update_own on public.ideas;
create policy ideas_update_own
on public.ideas
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists ideas_delete_own on public.ideas;
create policy ideas_delete_own
on public.ideas
for delete
using (auth.uid() = user_id);

drop policy if exists content_cards_select_own on public.content_cards;
create policy content_cards_select_own
on public.content_cards
for select
using (auth.uid() = user_id);

drop policy if exists content_cards_insert_own on public.content_cards;
create policy content_cards_insert_own
on public.content_cards
for insert
with check (auth.uid() = user_id);

drop policy if exists content_cards_update_own on public.content_cards;
create policy content_cards_update_own
on public.content_cards
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists content_cards_delete_own on public.content_cards;
create policy content_cards_delete_own
on public.content_cards
for delete
using (auth.uid() = user_id);

drop policy if exists scripts_select_own on public.scripts;
create policy scripts_select_own
on public.scripts
for select
using (auth.uid() = user_id);

drop policy if exists scripts_insert_own on public.scripts;
create policy scripts_insert_own
on public.scripts
for insert
with check (auth.uid() = user_id);

drop policy if exists scripts_update_own on public.scripts;
create policy scripts_update_own
on public.scripts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists scripts_delete_own on public.scripts;
create policy scripts_delete_own
on public.scripts
for delete
using (auth.uid() = user_id);

drop policy if exists mindmaps_select_own on public.mindmaps;
create policy mindmaps_select_own
on public.mindmaps
for select
using (auth.uid() = user_id);

drop policy if exists mindmaps_insert_own on public.mindmaps;
create policy mindmaps_insert_own
on public.mindmaps
for insert
with check (auth.uid() = user_id);

drop policy if exists mindmaps_update_own on public.mindmaps;
create policy mindmaps_update_own
on public.mindmaps
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists mindmaps_delete_own on public.mindmaps;
create policy mindmaps_delete_own
on public.mindmaps
for delete
using (auth.uid() = user_id);

drop policy if exists card_tags_select_own on public.card_tags;
create policy card_tags_select_own
on public.card_tags
for select
using (
  exists (
    select 1
    from public.content_cards c
    where c.id = card_tags.card_id
      and c.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags t
    where t.id = card_tags.tag_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists card_tags_insert_own on public.card_tags;
create policy card_tags_insert_own
on public.card_tags
for insert
with check (
  exists (
    select 1
    from public.content_cards c
    where c.id = card_tags.card_id
      and c.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags t
    where t.id = card_tags.tag_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists card_tags_update_own on public.card_tags;
create policy card_tags_update_own
on public.card_tags
for update
using (
  exists (
    select 1
    from public.content_cards c
    where c.id = card_tags.card_id
      and c.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags t
    where t.id = card_tags.tag_id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.content_cards c
    where c.id = card_tags.card_id
      and c.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags t
    where t.id = card_tags.tag_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists card_tags_delete_own on public.card_tags;
create policy card_tags_delete_own
on public.card_tags
for delete
using (
  exists (
    select 1
    from public.content_cards c
    where c.id = card_tags.card_id
      and c.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags t
    where t.id = card_tags.tag_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists idea_tags_select_own on public.idea_tags;
create policy idea_tags_select_own
on public.idea_tags
for select
using (
  exists (
    select 1
    from public.ideas i
    where i.id = idea_tags.idea_id
      and i.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags t
    where t.id = idea_tags.tag_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists idea_tags_insert_own on public.idea_tags;
create policy idea_tags_insert_own
on public.idea_tags
for insert
with check (
  exists (
    select 1
    from public.ideas i
    where i.id = idea_tags.idea_id
      and i.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags t
    where t.id = idea_tags.tag_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists idea_tags_update_own on public.idea_tags;
create policy idea_tags_update_own
on public.idea_tags
for update
using (
  exists (
    select 1
    from public.ideas i
    where i.id = idea_tags.idea_id
      and i.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags t
    where t.id = idea_tags.tag_id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.ideas i
    where i.id = idea_tags.idea_id
      and i.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags t
    where t.id = idea_tags.tag_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists idea_tags_delete_own on public.idea_tags;
create policy idea_tags_delete_own
on public.idea_tags
for delete
using (
  exists (
    select 1
    from public.ideas i
    where i.id = idea_tags.idea_id
      and i.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags t
    where t.id = idea_tags.tag_id
      and t.user_id = auth.uid()
  )
);

-- Add media attachments for content cards.
-- This migration is intentionally idempotent and does not modify existing data.

create table if not exists public.content_card_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.content_cards(id) on delete cascade,
  storage_path text not null,
  file_name text,
  mime_type text,
  media_type text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint content_card_media_media_type_check check (media_type in ('image', 'video'))
);

create index if not exists content_card_media_card_id_idx
  on public.content_card_media (card_id);

create index if not exists content_card_media_user_id_idx
  on public.content_card_media (user_id);

create index if not exists content_card_media_sort_order_idx
  on public.content_card_media (sort_order);

create index if not exists content_card_media_created_at_desc_idx
  on public.content_card_media (created_at desc);

alter table public.content_card_media enable row level security;

drop policy if exists "content_card_media_select_own" on public.content_card_media;
create policy "content_card_media_select_own"
  on public.content_card_media
  for select
  using (auth.uid() = user_id);

drop policy if exists "content_card_media_insert_own" on public.content_card_media;
create policy "content_card_media_insert_own"
  on public.content_card_media
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "content_card_media_update_own" on public.content_card_media;
create policy "content_card_media_update_own"
  on public.content_card_media
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "content_card_media_delete_own" on public.content_card_media;
create policy "content_card_media_delete_own"
  on public.content_card_media
  for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('content-card-media', 'content-card-media', false)
on conflict (id) do update
set public = false;

drop policy if exists "content_card_media_objects_select_own_folder" on storage.objects;
create policy "content_card_media_objects_select_own_folder"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'content-card-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "content_card_media_objects_insert_own_folder" on storage.objects;
create policy "content_card_media_objects_insert_own_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'content-card-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "content_card_media_objects_update_own_folder" on storage.objects;
create policy "content_card_media_objects_update_own_folder"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'content-card-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'content-card-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "content_card_media_objects_delete_own_folder" on storage.objects;
create policy "content_card_media_objects_delete_own_folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'content-card-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

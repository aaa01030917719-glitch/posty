-- Patch existing Instagram /reels/ reference rows after Posty canonicalizer
-- started normalizing /reels/{shortcode}/ to /reel/{shortcode}/.
-- Run this file manually in the Supabase SQL Editor.
-- This file does not execute migrations automatically.
--
-- Safety notes:
-- - This patch only updates references rows whose corrected /reel/ URL does
--   not collide with an existing reference for the same user.
-- - It does not delete analyses, sources, jobs, or source links.
-- - It queues Manus analysis only when the reference has no analysis and no
--   active analysis job.

begin;

create extension if not exists pgcrypto with schema extensions;

with candidates as (
  select
    r.id,
    r.user_id,
    r.canonical_url,
    regexp_replace(
      r.canonical_url,
      '^https://www\.instagram\.com/reels/([^/?#]+)/?.*$',
      'https://www.instagram.com/reel/\1/'
    ) as corrected_canonical_url
  from public.references r
  where r.canonical_url like 'https://www.instagram.com/reels/%'
),
deduped_candidates as (
  select
    c.*,
    encode(extensions.digest(c.corrected_canonical_url, 'sha256'), 'hex') as corrected_url_fingerprint
  from candidates c
  where not exists (
    select 1
    from public.references existing
    where existing.user_id = c.user_id
      and existing.id <> c.id
      and existing.url_fingerprint =
        encode(extensions.digest(c.corrected_canonical_url, 'sha256'), 'hex')
  )
),
updated_references as (
  update public.references r
  set
    canonical_url = c.corrected_canonical_url,
    url_fingerprint = c.corrected_url_fingerprint,
    canonicalizer_version = 'posty-reference-url-v1',
    platform = 'instagram_reel'
  from deduped_candidates c
  where r.id = c.id
  returning
    r.id,
    r.user_id,
    r.latest_analysis_id
),
queue_candidates as (
  select
    ur.id,
    ur.user_id
  from updated_references ur
  where ur.latest_analysis_id is null
    and not exists (
      select 1
      from public.reference_analyses a
      where a.user_id = ur.user_id
        and a.reference_id = ur.id
    )
    and not exists (
      select 1
      from public.reference_analysis_jobs j
      where j.user_id = ur.user_id
        and j.reference_id = ur.id
        and j.status in ('queued', 'processing', 'submitted', 'retry_scheduled')
    )
),
inserted_jobs as (
  insert into public.reference_analysis_jobs (
    user_id,
    reference_id,
    job_type,
    status,
    priority,
    available_at
  )
  select
    qc.user_id,
    qc.id,
    'realtime',
    'queued',
    100,
    now()
  from queue_candidates qc
  on conflict do nothing
  returning user_id, reference_id
),
queued_references as (
  update public.references r
  set analysis_status = 'queued'
  from inserted_jobs ij
  where r.id = ij.reference_id
    and r.user_id = ij.user_id
  returning r.id
)
select count(*) as queued_reference_count
from queued_references;

-- Keep the recorded state reproducible even if a data-modifying CTE execution
-- path leaves a pending reference with an active analysis job.
update public.references r
set analysis_status = 'queued'
where r.analysis_status = 'pending'
  and exists (
    select 1
    from public.reference_analysis_jobs j
    where j.reference_id = r.id
      and j.user_id = r.user_id
      and j.status in ('queued', 'processing', 'submitted', 'retry_scheduled')
  );

commit;

-- Confirmation queries for manual use before and after running the patch.
--
-- 1. Before patch: inspect /reels/ rows and whether corrected /reel/ rows exist.
-- with candidates as (
--   select
--     r.id,
--     r.user_id,
--     r.canonical_url,
--     r.platform,
--     regexp_replace(
--       r.canonical_url,
--       '^https://www\.instagram\.com/reels/([^/?#]+)/?.*$',
--       'https://www.instagram.com/reel/\1/'
--     ) as corrected_canonical_url
--   from public.references r
--   where r.canonical_url like 'https://www.instagram.com/reels/%'
-- )
-- select
--   c.*,
--   existing.id as existing_reel_reference_id
-- from candidates c
-- left join public.references existing
--   on existing.user_id = c.user_id
--  and existing.id <> c.id
--  and existing.url_fingerprint =
--    encode(extensions.digest(c.corrected_canonical_url, 'sha256'), 'hex')
-- order by c.canonical_url;
--
-- 2. After patch: confirm no /reels/ canonical URLs remain.
-- select count(*) as remaining_reels_rows
-- from public.references
-- where canonical_url like 'https://www.instagram.com/reels/%';
--
-- 3. After patch: inspect corrected /reel/ rows and platform.
-- select id, user_id, canonical_url, url_fingerprint, platform, canonicalizer_version, analysis_status
-- from public.references
-- where canonical_url like 'https://www.instagram.com/reel/%'
-- order by updated_at desc;
--
-- 4. After patch: inspect active queue jobs for corrected references.
-- select j.id, j.reference_id, j.job_type, j.status, j.priority, j.created_at
-- from public.reference_analysis_jobs j
-- join public.references r on r.id = j.reference_id
-- where r.canonical_url like 'https://www.instagram.com/reel/%'
--   and j.status in ('queued', 'processing', 'submitted', 'retry_scheduled')
-- order by j.created_at desc;
--
-- 5. After patch: confirm no duplicate fingerprints exist.
-- select user_id, url_fingerprint, count(*) as duplicate_count
-- from public.references
-- group by user_id, url_fingerprint
-- having count(*) > 1
-- order by duplicate_count desc;

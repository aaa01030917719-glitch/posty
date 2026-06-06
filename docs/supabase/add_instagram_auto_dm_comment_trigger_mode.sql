-- Posty Instagram auto DM comment trigger mode migration
-- Run this file manually in the Supabase SQL Editor.
-- This file does not execute migrations automatically.
--
-- Adds a rule-level comment trigger mode:
-- - keyword: keep the existing keyword matching behavior
-- - all_comments: match every top-level non-owner comment for the rule media

alter table public.instagram_auto_dm_rules
  add column if not exists comment_trigger_mode text not null default 'keyword';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'instagram_auto_dm_rules_keyword_check'
      and conrelid = 'public.instagram_auto_dm_rules'::regclass
  ) then
    alter table public.instagram_auto_dm_rules
      drop constraint instagram_auto_dm_rules_keyword_check;
  end if;
end;
$$;

alter table public.instagram_auto_dm_rules
  alter column keyword drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'instagram_auto_dm_rules_comment_trigger_mode_check'
      and conrelid = 'public.instagram_auto_dm_rules'::regclass
  ) then
    alter table public.instagram_auto_dm_rules
      add constraint instagram_auto_dm_rules_comment_trigger_mode_check
      check (comment_trigger_mode in ('keyword', 'all_comments'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'instagram_auto_dm_rules_keyword_by_trigger_mode_check'
      and conrelid = 'public.instagram_auto_dm_rules'::regclass
  ) then
    alter table public.instagram_auto_dm_rules
      add constraint instagram_auto_dm_rules_keyword_by_trigger_mode_check
      check (
        (
          comment_trigger_mode = 'keyword'
          and keyword is not null
          and btrim(keyword) <> ''
        )
        or (
          comment_trigger_mode = 'all_comments'
          and (
            keyword is null
            or btrim(keyword) = ''
          )
        )
      );
  end if;
end;
$$;

comment on column public.instagram_auto_dm_rules.comment_trigger_mode is
  'keyword matches comments containing the rule keyword. all_comments matches every eligible top-level user comment on the rule media.';

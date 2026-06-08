-- Posty Manus reference processing cron draft
-- Run manually in the Supabase SQL Editor only after code deployment and one
-- manual route verification.
-- This file is a draft; do not execute until the API routes are deployed.
--
-- Production Posty base URL:
-- https://project-zzg5e.vercel.app
--
-- Required Vault secret:
-- posty_references_queue_cron_secret

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'posty_references_process_queue'
  ) then
    perform cron.unschedule('posty_references_process_queue');
  end if;

  if exists (
    select 1 from cron.job where jobname = 'posty_references_reconcile_manus'
  ) then
    perform cron.unschedule('posty_references_reconcile_manus');
  end if;
end $$;

select cron.schedule(
  'posty_references_process_queue',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://project-zzg5e.vercel.app/api/references/process-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'posty_references_queue_cron_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'posty_references_reconcile_manus',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://project-zzg5e.vercel.app/api/references/reconcile-manus',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'posty_references_queue_cron_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Confirmation queries:
--
-- select jobid, jobname, schedule, active
-- from cron.job
-- where jobname in (
--   'posty_references_process_queue',
--   'posty_references_reconcile_manus'
-- )
-- order by jobname;
--
-- select name
-- from vault.decrypted_secrets
-- where name = 'posty_references_queue_cron_secret';

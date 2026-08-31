-- Schedule the collector every 15 minutes.
-- Replace วางรหัสลับตรงนี้ with the same value as YAHOO_ARCHIVE_SECRET.

create extension if not exists pg_net with schema net;
create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'yahoo-archive-collector-15m';

select cron.schedule(
  'yahoo-archive-collector-15m',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://urrwbokecdrhnyzmlfay.supabase.co/functions/v1/yahoo-archive-collector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-yahoo-archive-secret', 'วางรหัสลับตรงนี้'
    ),
    body := '{}'::jsonb
  );
  $$
);

select jobid, jobname, schedule, active
from cron.job
where jobname = 'yahoo-archive-collector-15m';

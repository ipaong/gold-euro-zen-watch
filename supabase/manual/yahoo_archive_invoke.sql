-- Run AFTER the Edge Function is deployed and YAHOO_ARCHIVE_SECRET is set.
-- Replace วางรหัสลับตรงนี้ with the same value as the secret.

create extension if not exists pg_net with schema net;

select net.http_post(
  url := 'https://urrwbokecdrhnyzmlfay.supabase.co/functions/v1/yahoo-archive-collector',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-yahoo-archive-secret', 'วางรหัสลับตรงนี้'
  ),
  body := '{}'::jsonb
) as request_id;

-- Wait 3–8 seconds, then:
select
  status_code,
  content::json as body,
  created
from net._http_response
order by id desc
limit 3;

-- Phase 0: ownership, least-privilege grants, RLS, and immutable predictions.
-- Run with `supabase test db`; every fixture is rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(37);

INSERT INTO auth.users (id, aud, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated');

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '';
SELECT throws_ok($$ SELECT * FROM public.predictions $$, '42501', NULL,
'anon cannot select predictions');
SELECT throws_ok(
  $$ INSERT INTO public.predictions (id, as_of, mode, symbol, timeframe, horizon, price, snapshot)
     VALUES ('pred_anon', 1000, 'live', 'XAUEUR', 'M15', 5, 2500, '{}'::jsonb) $$,
  '42501', NULL,
'anon cannot insert predictions');
SELECT throws_ok($$ SELECT * FROM public.prediction_results $$, '42501', NULL,
'anon cannot select results');
SELECT throws_ok($$ SELECT * FROM public.app_settings $$, '42501', NULL,
'anon cannot select settings');
SELECT throws_ok($$ SELECT * FROM public.market_price_samples $$, '42501', NULL,
'anon cannot select market samples');
SELECT throws_ok($$ SELECT * FROM public.market_candles $$, '42501', NULL,
'anon cannot select market candles');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT lives_ok(
  $$ INSERT INTO public.predictions
       (id, user_id, as_of, mode, symbol, timeframe, horizon, price, snapshot, locked)
     VALUES ('pred_a_1', '11111111-1111-1111-1111-111111111111', 1700000000000,
       'live', 'XAUEUR', 'M15', 5, 2500.5, '{"key":"value"}'::jsonb, true) $$,
  'user A can insert its own prediction');
SELECT is((SELECT count(*)::int FROM public.predictions WHERE id = 'pred_a_1'), 1,
  'user A can select its own prediction');

SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM public.predictions WHERE id = 'pred_a_1'), 0,
  'user B cannot select user A prediction');
SELECT throws_ok($$ UPDATE public.predictions SET price = 9999 WHERE id = 'pred_a_1' $$,
  '42501', NULL,
'authenticated clients have no prediction update privilege');
SELECT lives_ok($$ DELETE FROM public.predictions WHERE id = 'pred_a_1' $$,
  'user B delete is filtered to zero rows by RLS');

SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM public.predictions WHERE id = 'pred_a_1'), 1,
  'user A prediction remains after user B delete attempt');

SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT throws_ok(
  $$ INSERT INTO public.prediction_results (prediction_id, user_id, actual, score)
     VALUES ('pred_a_1', '22222222-2222-2222-2222-222222222222', '[]'::jsonb, '{}'::jsonb) $$,
  '42501', NULL,
'user B cannot attach a result to user A prediction');

SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT lives_ok(
  $$ INSERT INTO public.prediction_results (prediction_id, user_id, actual, score)
     VALUES ('pred_a_1', '11111111-1111-1111-1111-111111111111', '[]'::jsonb, '{}'::jsonb) $$,
  'user A can attach a result to its own prediction');
SELECT throws_ok(
  $$ INSERT INTO public.prediction_results (prediction_id, user_id, actual, score)
     VALUES ('pred_a_1', '11111111-1111-1111-1111-111111111111', '[]'::jsonb, '{}'::jsonb) $$,
  '23505', NULL,
'a prediction accepts only one result');

RESET ROLE;
SELECT throws_ok(
  $$ UPDATE public.prediction_results SET score = '{"changed":true}'::jsonb
     WHERE prediction_id = 'pred_a_1' $$,
  'P0001', NULL,
'prediction result score is immutable');
SELECT throws_ok(
  $$ UPDATE public.prediction_results SET user_id = '22222222-2222-2222-2222-222222222222'
     WHERE prediction_id = 'pred_a_1' $$,
  'P0001', NULL,
'prediction result owner is immutable');
SELECT throws_ok(
  $$ UPDATE public.predictions SET user_id = '22222222-2222-2222-2222-222222222222'
     WHERE id = 'pred_a_1' $$,
  'P0001', NULL,
'prediction owner is immutable');
SELECT throws_ok($$ UPDATE public.predictions SET price = 9999 WHERE id = 'pred_a_1' $$,
  'P0001', NULL,
'locked prediction snapshot fields are immutable');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT lives_ok(
  $$ INSERT INTO public.app_settings (user_id, settings)
     VALUES ('11111111-1111-1111-1111-111111111111', '{"minConfidence":70}'::jsonb) $$,
  'user A can insert its own settings');

SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM public.app_settings
  WHERE user_id = '11111111-1111-1111-1111-111111111111'), 0,
  'user B cannot select user A settings');

SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT lives_ok(
  $$ INSERT INTO public.app_settings (user_id, settings)
     VALUES ('11111111-1111-1111-1111-111111111111', '{"minConfidence":80}'::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET settings = EXCLUDED.settings $$,
  'user A can upsert settings by user_id');
SELECT lives_ok($$ DELETE FROM public.predictions WHERE id = 'pred_a_1' $$,
  'user A can delete its own prediction');
SELECT is((SELECT count(*)::int FROM public.prediction_results WHERE prediction_id = 'pred_a_1'), 0,
  'deleting a prediction cascades to its result');

-- Market ingestion is service-role only and uses one transaction for sample + candle updates.
SET LOCAL ROLE service_role;
SELECT lives_ok(
  $$ SELECT public.ingest_gold_api_price(100, '2026-01-02T09:01:00Z'::timestamptz, '2026-01-02T09:01:10Z'::timestamptz) $$,
  'service role can ingest the first Gold API sample');
SELECT lives_ok(
  $$ SELECT public.ingest_gold_api_price(102, '2026-01-02T09:05:00Z'::timestamptz, '2026-01-02T09:05:10Z'::timestamptz) $$,
  'service role can ingest a second sample in the same UTC M15 bucket');
SELECT lives_ok(
  $$ SELECT public.ingest_gold_api_price(99, '2026-01-02T09:10:00Z'::timestamptz, '2026-01-02T09:10:10Z'::timestamptz) $$,
  'service role can ingest a third sample in the same UTC M15 bucket');
SELECT results_eq(
  $$ SELECT open, high, low, close, sample_count, is_closed
     FROM public.market_candles
     WHERE bucket_start = '2026-01-02T09:00:00Z'::timestamptz $$,
  $$ VALUES (100::numeric, 102::numeric, 99::numeric, 99::numeric, 3::integer, false::boolean) $$,
  'transactional upsert produces first/high/low/latest OHLC and remains open');

SELECT is(
  (public.ingest_gold_api_price(1000, '2026-01-02T09:10:00Z'::timestamptz, '2026-01-02T09:11:00Z'::timestamptz) ->> 'sampleInserted')::boolean,
  false,
  'duplicate provider updatedAt is idempotent');
SELECT is(
  (SELECT sample_count FROM public.market_candles
   WHERE bucket_start = '2026-01-02T09:00:00Z'::timestamptz),
  3,
  'duplicate updatedAt does not inflate sample_count or create a fake candle');

SELECT lives_ok(
  $$ SELECT public.ingest_gold_api_price(101, '2026-01-02T09:15:00Z'::timestamptz, '2026-01-02T09:31:00Z'::timestamptz) $$,
  'a later sample closes the prior UTC M15 candle without rebuilding OHLC');
SELECT results_eq(
  $$ SELECT open, high, low, close, sample_count, is_closed
     FROM public.market_candles
     WHERE bucket_start = '2026-01-02T09:00:00Z'::timestamptz $$,
  $$ VALUES (100::numeric, 102::numeric, 99::numeric, 99::numeric, 3::integer, true::boolean) $$,
  'closed candle keeps its OHLC values');
SELECT lives_ok(
  $$ SELECT public.ingest_gold_api_price(110, '2026-01-02T09:20:00Z'::timestamptz, '2026-01-02T09:32:00Z'::timestamptz) $$,
  'a late sample is accepted for audit but cannot change a closed candle');
SELECT results_eq(
  $$ SELECT open, high, low, close, sample_count, is_closed
     FROM public.market_candles
     WHERE bucket_start = '2026-01-02T09:15:00Z'::timestamptz $$,
  $$ VALUES (101::numeric, 101::numeric, 101::numeric, 101::numeric, 1::integer, true::boolean) $$,
  'closed candle OHLC remains immutable after a later provider sample');
SELECT throws_ok(
  $$ UPDATE public.market_candles
     SET close = 999
     WHERE bucket_start = '2026-01-02T09:15:00Z'::timestamptz $$,
  'P0001', NULL,
'direct updates cannot alter a closed market candle');

SELECT lives_ok(
  $$ SELECT public.ingest_gold_api_price(103, '2026-01-02T09:30:00Z'::timestamptz, '2026-01-02T09:31:00Z'::timestamptz) $$,
  'a current bucket remains incomplete until its quarter-hour ends');
SELECT is(
  (SELECT count(*)::int FROM public.market_candles WHERE is_closed = false),
  1,
  'incomplete M15 candles remain excluded from the closed-candle read path');

SELECT * FROM finish();
ROLLBACK;

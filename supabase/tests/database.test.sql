-- Phase 0: ownership, least-privilege grants, RLS, and immutable predictions.
-- Run with `supabase test db`; every fixture is rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(22);

INSERT INTO auth.users (id, aud, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated');

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '';
SELECT throws_ok($$ SELECT * FROM public.predictions $$, '42501', 'anon cannot select predictions');
SELECT throws_ok(
  $$ INSERT INTO public.predictions (id, as_of, mode, symbol, timeframe, horizon, price, snapshot)
     VALUES ('pred_anon', 1000, 'live', 'XAUEUR', 'M15', 5, 2500, '{}'::jsonb) $$,
  '42501', 'anon cannot insert predictions');
SELECT throws_ok($$ SELECT * FROM public.prediction_results $$, '42501', 'anon cannot select results');
SELECT throws_ok($$ SELECT * FROM public.app_settings $$, '42501', 'anon cannot select settings');

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
  '42501', 'authenticated clients have no prediction update privilege');
SELECT lives_ok($$ DELETE FROM public.predictions WHERE id = 'pred_a_1' $$,
  'user B delete is filtered to zero rows by RLS');

SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM public.predictions WHERE id = 'pred_a_1'), 1,
  'user A prediction remains after user B delete attempt');

SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT throws_ok(
  $$ INSERT INTO public.prediction_results (prediction_id, user_id, actual, score)
     VALUES ('pred_a_1', '22222222-2222-2222-2222-222222222222', '[]'::jsonb, '{}'::jsonb) $$,
  '42501', 'user B cannot attach a result to user A prediction');

SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT lives_ok(
  $$ INSERT INTO public.prediction_results (prediction_id, user_id, actual, score)
     VALUES ('pred_a_1', '11111111-1111-1111-1111-111111111111', '[]'::jsonb, '{}'::jsonb) $$,
  'user A can attach a result to its own prediction');
SELECT throws_ok(
  $$ INSERT INTO public.prediction_results (prediction_id, user_id, actual, score)
     VALUES ('pred_a_1', '11111111-1111-1111-1111-111111111111', '[]'::jsonb, '{}'::jsonb) $$,
  '23505', 'a prediction accepts only one result');

RESET ROLE;
SELECT throws_ok(
  $$ UPDATE public.prediction_results SET score = '{"changed":true}'::jsonb
     WHERE prediction_id = 'pred_a_1' $$,
  'P0001', 'prediction result score is immutable');
SELECT throws_ok(
  $$ UPDATE public.prediction_results SET user_id = '22222222-2222-2222-2222-222222222222'
     WHERE prediction_id = 'pred_a_1' $$,
  'P0001', 'prediction result owner is immutable');
SELECT throws_ok(
  $$ UPDATE public.predictions SET user_id = '22222222-2222-2222-2222-222222222222'
     WHERE id = 'pred_a_1' $$,
  'P0001', 'prediction owner is immutable');
SELECT throws_ok($$ UPDATE public.predictions SET price = 9999 WHERE id = 'pred_a_1' $$,
  'P0001', 'locked prediction snapshot fields are immutable');

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

SELECT * FROM finish();
ROLLBACK;

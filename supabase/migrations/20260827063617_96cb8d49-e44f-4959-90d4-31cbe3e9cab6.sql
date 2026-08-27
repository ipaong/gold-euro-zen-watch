-- Phase 0: Anonymous Auth and Database Ownership Migration

-- 1. Predictions: add user_id, make device_id nullable, add index
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.predictions
  ALTER COLUMN device_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS predictions_user_created_idx
  ON public.predictions (user_id, created_at DESC);

-- 2. Prediction results: add user_id, make device_id nullable, add index
ALTER TABLE public.prediction_results
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.prediction_results
  ALTER COLUMN device_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS prediction_results_user_idx
  ON public.prediction_results (user_id);

-- 3. App settings: safely replace device_id primary key design
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_pkey;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() PRIMARY KEY;

ALTER TABLE public.app_settings
  ALTER COLUMN device_id DROP NOT NULL;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_user_id_key'
  ) THEN
    ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 4. Update immutable prediction function to prevent user_id mutation
CREATE OR REPLACE FUNCTION public.enforce_prediction_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.device_id IS DISTINCT FROM OLD.device_id
     OR NEW.as_of IS DISTINCT FROM OLD.as_of
     OR NEW.mode IS DISTINCT FROM OLD.mode
     OR NEW.symbol IS DISTINCT FROM OLD.symbol
     OR NEW.timeframe IS DISTINCT FROM OLD.timeframe
     OR NEW.horizon IS DISTINCT FROM OLD.horizon
     OR NEW.price IS DISTINCT FROM OLD.price
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'prediction snapshot is locked and cannot be modified';
  END IF;
  IF OLD.ai_explanation IS NOT NULL AND NEW.ai_explanation IS DISTINCT FROM OLD.ai_explanation THEN
    RAISE EXCEPTION 'ai explanation is already locked';
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Revoke unauthenticated access from anon
REVOKE ALL ON public.predictions FROM anon;
REVOKE ALL ON public.prediction_results FROM anon;
REVOKE ALL ON public.app_settings FROM anon;

-- 6. Grant authenticated role only operations used by the application
REVOKE ALL ON public.predictions FROM authenticated;
REVOKE ALL ON public.prediction_results FROM authenticated;
REVOKE ALL ON public.app_settings FROM authenticated;

GRANT SELECT, INSERT, DELETE ON public.predictions TO authenticated;
GRANT SELECT, INSERT ON public.prediction_results TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;

GRANT ALL ON public.predictions TO service_role;
GRANT ALL ON public.prediction_results TO service_role;
GRANT ALL ON public.app_settings TO service_role;

-- 7. Drop legacy permissive policies
DROP POLICY IF EXISTS "Anyone can read predictions" ON public.predictions;
DROP POLICY IF EXISTS "Anyone can insert predictions" ON public.predictions;
DROP POLICY IF EXISTS "Anyone can update predictions" ON public.predictions;
DROP POLICY IF EXISTS "Anyone can delete predictions" ON public.predictions;

DROP POLICY IF EXISTS "Anyone can read results" ON public.prediction_results;
DROP POLICY IF EXISTS "Anyone can insert results" ON public.prediction_results;
DROP POLICY IF EXISTS "Anyone can delete results" ON public.prediction_results;

DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can delete settings" ON public.app_settings;

-- 8. Add strict per-operation RLS policies

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own predictions"
  ON public.predictions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own predictions"
  ON public.predictions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own predictions"
  ON public.predictions FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can select own prediction results"
  ON public.prediction_results FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own prediction results"
  ON public.prediction_results FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.predictions p
      WHERE p.id = prediction_results.prediction_id
        AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can select own settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Phase 0 follow-up: a settled result is append-only.

CREATE OR REPLACE FUNCTION public.enforce_prediction_result_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.prediction_id IS DISTINCT FROM OLD.prediction_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.device_id IS DISTINCT FROM OLD.device_id
     OR NEW.actual IS DISTINCT FROM OLD.actual
     OR NEW.score IS DISTINCT FROM OLD.score
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'prediction result is immutable and cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prediction_results_lock ON public.prediction_results;
CREATE TRIGGER prediction_results_lock
BEFORE UPDATE ON public.prediction_results
FOR EACH ROW EXECUTE FUNCTION public.enforce_prediction_result_lock();
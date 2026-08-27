-- Phase 0 follow-up: a settled result is append-only.
-- This is intentionally a separate forward-only migration so the already
-- published ownership migration is never rewritten.

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

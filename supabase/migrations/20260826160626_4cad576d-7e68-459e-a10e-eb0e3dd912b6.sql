CREATE TABLE public.predictions (
  id text PRIMARY KEY,
  device_id text NOT NULL,
  as_of bigint NOT NULL,
  mode text NOT NULL,
  symbol text NOT NULL DEFAULT 'XAUEUR',
  timeframe text NOT NULL DEFAULT 'M15',
  horizon integer NOT NULL,
  price numeric NOT NULL,
  snapshot jsonb NOT NULL,
  ai_explanation jsonb,
  locked boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX predictions_device_created_idx ON public.predictions (device_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read predictions" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert predictions" ON public.predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update predictions" ON public.predictions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete predictions" ON public.predictions FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.enforce_prediction_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
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

CREATE TRIGGER predictions_lock
BEFORE UPDATE ON public.predictions
FOR EACH ROW EXECUTE FUNCTION public.enforce_prediction_lock();

CREATE TABLE public.prediction_results (
  prediction_id text PRIMARY KEY REFERENCES public.predictions(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  actual jsonb NOT NULL,
  score jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.prediction_results TO anon;
GRANT SELECT, INSERT, DELETE ON public.prediction_results TO authenticated;
GRANT ALL ON public.prediction_results TO service_role;

ALTER TABLE public.prediction_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read results" ON public.prediction_results FOR SELECT USING (true);
CREATE POLICY "Anyone can insert results" ON public.prediction_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete results" ON public.prediction_results FOR DELETE USING (true);

CREATE TABLE public.app_settings (
  device_id text PRIMARY KEY,
  settings jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert settings" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update settings" ON public.app_settings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete settings" ON public.app_settings FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
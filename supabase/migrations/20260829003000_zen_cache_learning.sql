-- Zen persistence layer: reusable market/news snapshots and immutable learning feedback.
-- This migration is intentionally additive. Existing prediction snapshots remain source-of-truth.

CREATE TABLE IF NOT EXISTS public.market_snapshot_cache (
  cache_key TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  as_of BIGINT NOT NULL,
  source TEXT NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_snapshot_cache_lookup
  ON public.market_snapshot_cache (symbol, timeframe, as_of DESC);

ALTER TABLE public.market_snapshot_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_snapshot_cache'
      AND policyname = 'Anyone can read market snapshot cache'
  ) THEN
    CREATE POLICY "Anyone can read market snapshot cache"
      ON public.market_snapshot_cache FOR SELECT
      TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_snapshot_cache'
      AND policyname = 'Anyone can upsert market snapshot cache'
  ) THEN
    CREATE POLICY "Anyone can upsert market snapshot cache"
      ON public.market_snapshot_cache FOR INSERT
      TO anon, authenticated WITH CHECK (true);
    CREATE POLICY "Anyone can refresh market snapshot cache"
      ON public.market_snapshot_cache FOR UPDATE
      TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.market_snapshot_cache TO anon, authenticated;
GRANT ALL ON public.market_snapshot_cache TO service_role;

CREATE TABLE IF NOT EXISTS public.prediction_learning_feedback (
  prediction_id TEXT PRIMARY KEY,
  user_id UUID,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  predicted_direction TEXT NOT NULL,
  actual_direction TEXT NOT NULL,
  direction_correct BOOLEAN,
  confidence NUMERIC NOT NULL,
  model_scores JSONB NOT NULL,
  score JSONB NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prediction_learning_feedback_recent
  ON public.prediction_learning_feedback (symbol, timeframe, settled_at DESC);

ALTER TABLE public.prediction_learning_feedback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'prediction_learning_feedback'
      AND policyname = 'Anyone can read prediction learning feedback'
  ) THEN
    CREATE POLICY "Anyone can read prediction learning feedback"
      ON public.prediction_learning_feedback FOR SELECT
      TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'prediction_learning_feedback'
      AND policyname = 'Anyone can insert prediction learning feedback'
  ) THEN
    CREATE POLICY "Anyone can insert prediction learning feedback"
      ON public.prediction_learning_feedback FOR INSERT
      TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT ON public.prediction_learning_feedback TO anon, authenticated;
GRANT ALL ON public.prediction_learning_feedback TO service_role;

-- Defense in depth: no DELETE grants/policies are created for either table.
REVOKE DELETE ON public.market_snapshot_cache FROM anon, authenticated;
REVOKE DELETE ON public.prediction_learning_feedback FROM anon, authenticated;

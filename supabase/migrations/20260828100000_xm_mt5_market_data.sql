-- XM MT5 GOLD M15 bridge store. Forward-only: never reset or rewrite legacy tables.

CREATE TABLE IF NOT EXISTS public.xm_market_candles (
  source text NOT NULL DEFAULT 'xm-mt5',
  version text NOT NULL DEFAULT '1.0.0',
  symbol text NOT NULL DEFAULT 'GOLD',
  timeframe text NOT NULL DEFAULT '15m',
  bucket_start timestamptz NOT NULL,
  open numeric(20, 8) NOT NULL CHECK (open > 0),
  high numeric(20, 8) NOT NULL CHECK (high >= open AND high >= close),
  low numeric(20, 8) NOT NULL CHECK (low <= open AND low <= close),
  close numeric(20, 8) NOT NULL CHECK (close > 0),
  is_closed boolean NOT NULL DEFAULT true,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, version, symbol, timeframe, bucket_start),
  CONSTRAINT xm_market_candles_source_contract CHECK (
    source = 'xm-mt5'
    AND version = '1.0.0'
    AND symbol = 'GOLD'
    AND timeframe = '15m'
    AND is_closed = true
  ),
  CONSTRAINT xm_market_candles_utc_bucket CHECK (
    bucket_start = date_trunc('minute', bucket_start AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    AND extract(second FROM bucket_start AT TIME ZONE 'UTC') = 0
    AND extract(minute FROM bucket_start AT TIME ZONE 'UTC') IN (0, 15, 30, 45)
  )
);

CREATE INDEX IF NOT EXISTS xm_market_candles_closed_bucket_idx
  ON public.xm_market_candles (source, version, symbol, timeframe, bucket_start DESC);

CREATE OR REPLACE FUNCTION public.enforce_xm_market_candle_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'XM market candles are append-only';
END;
$$;

DROP TRIGGER IF EXISTS xm_market_candles_append_only ON public.xm_market_candles;
CREATE TRIGGER xm_market_candles_append_only
  BEFORE UPDATE OR DELETE ON public.xm_market_candles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_xm_market_candle_append_only();

ALTER TABLE public.xm_market_candles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.xm_market_candles FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.xm_market_candles TO service_role;

CREATE OR REPLACE FUNCTION public.ingest_xm_mt5_candles(
  p_candles jsonb,
  p_ingested_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candle record;
  v_existing public.xm_market_candles%ROWTYPE;
  v_bucket_start timestamptz;
  v_previous_bucket_start timestamptz;
  v_inserted integer := 0;
  v_seen integer := 0;
BEGIN
  IF p_candles IS NULL OR jsonb_typeof(p_candles) <> 'array' THEN
    RAISE EXCEPTION 'XM candles must be a JSON array';
  END IF;
  IF jsonb_array_length(p_candles) < 1 OR jsonb_array_length(p_candles) > 600 THEN
    RAISE EXCEPTION 'XM candle batch must contain 1 to 600 candles';
  END IF;
  IF p_ingested_at IS NULL OR p_ingested_at > now() + interval '2 minutes' THEN
    RAISE EXCEPTION 'XM ingested_at is invalid or too far in the future';
  END IF;

  FOR v_candle IN
    SELECT *
    FROM jsonb_to_recordset(p_candles) AS x(
      time_seconds bigint,
      open numeric,
      high numeric,
      low numeric,
      close numeric,
      complete boolean
    )
  LOOP
    v_seen := v_seen + 1;
    IF v_candle.time_seconds IS NULL OR v_candle.time_seconds <= 0 THEN
      RAISE EXCEPTION 'XM candle time_seconds must be a positive integer';
    END IF;
    IF v_candle.open IS NULL OR v_candle.high IS NULL OR v_candle.low IS NULL OR v_candle.close IS NULL
      OR v_candle.open <= 0 OR v_candle.high <= 0 OR v_candle.low <= 0 OR v_candle.close <= 0 THEN
      RAISE EXCEPTION 'XM candle OHLC must be positive finite numbers';
    END IF;
    IF v_candle.high < GREATEST(v_candle.open, v_candle.close)
      OR v_candle.low > LEAST(v_candle.open, v_candle.close) THEN
      RAISE EXCEPTION 'XM candle OHLC geometry is invalid';
    END IF;
    IF v_candle.complete IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'XM bridge only accepts closed candles';
    END IF;

    v_bucket_start := to_timestamp(v_candle.time_seconds);
    IF extract(second FROM v_bucket_start AT TIME ZONE 'UTC') <> 0
      OR extract(minute FROM v_bucket_start AT TIME ZONE 'UTC') NOT IN (0, 15, 30, 45) THEN
      RAISE EXCEPTION 'XM candle timestamp must align to a UTC 15 minute bucket';
    END IF;
    IF v_bucket_start > p_ingested_at + interval '1 minute' THEN
      RAISE EXCEPTION 'XM candle timestamp is too far in the future';
    END IF;
    IF v_previous_bucket_start IS NOT NULL AND v_bucket_start <= v_previous_bucket_start THEN
      RAISE EXCEPTION 'XM candle timestamps must be ascending and unique';
    END IF;
    v_previous_bucket_start := v_bucket_start;

    INSERT INTO public.xm_market_candles (
      source, version, symbol, timeframe, bucket_start,
      open, high, low, close, is_closed, ingested_at
    ) VALUES (
      'xm-mt5', '1.0.0', 'GOLD', '15m', v_bucket_start,
      v_candle.open, v_candle.high, v_candle.low, v_candle.close, true, p_ingested_at
    )
    ON CONFLICT (source, version, symbol, timeframe, bucket_start) DO NOTHING;

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;

    SELECT * INTO v_existing
    FROM public.xm_market_candles
    WHERE source = 'xm-mt5'
      AND version = '1.0.0'
      AND symbol = 'GOLD'
      AND timeframe = '15m'
      AND bucket_start = v_bucket_start;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'XM candle disappeared after insert';
    END IF;
    IF v_existing.open IS DISTINCT FROM v_candle.open
      OR v_existing.high IS DISTINCT FROM v_candle.high
      OR v_existing.low IS DISTINCT FROM v_candle.low
      OR v_existing.close IS DISTINCT FROM v_candle.close THEN
      RAISE EXCEPTION 'conflicting immutable XM candle for bucket %', v_bucket_start;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'acceptedCount', v_seen,
    'insertedCount', v_inserted,
    'source', 'xm-mt5',
    'version', '1.0.0',
    'symbol', 'GOLD',
    'timeframe', '15m'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_xm_mt5_candles(jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_xm_mt5_candles(jsonb, timestamptz)
  TO service_role;

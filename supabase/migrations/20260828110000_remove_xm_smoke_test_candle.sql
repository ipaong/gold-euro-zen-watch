-- Remove the single synthetic candle created during the production deployment
-- smoke test. Match the full immutable identity and OHLC payload so this cannot
-- delete a real XM candle accidentally.

DO $$
DECLARE
  v_deleted integer;
BEGIN
  ALTER TABLE public.xm_market_candles
    DISABLE TRIGGER xm_market_candles_append_only;

  DELETE FROM public.xm_market_candles
  WHERE source = 'xm-mt5'
    AND version = '1.0.0'
    AND symbol = 'GOLD'
    AND timeframe = '15m'
    AND bucket_start = timestamptz '2026-08-28 02:15:00+00'
    AND open = 2500.0
    AND high = 2501.0
    AND low = 2499.0
    AND close = 2500.5;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  ALTER TABLE public.xm_market_candles
    ENABLE TRIGGER xm_market_candles_append_only;

  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'expected to remove exactly one synthetic XM candle, removed %', v_deleted;
  END IF;
END;
$$;

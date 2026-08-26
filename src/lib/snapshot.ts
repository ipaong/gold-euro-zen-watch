import { atr, ema, emaSeries, macd, nearestLevels, rsi, stdev } from "./indicators";
import { MIN_WARMUP_CANDLES, type MarketDataProvider } from "./market/provider";
import { InsufficientDataError, type Candle, type MarketSnapshot, type Regime } from "./types";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Turns raw candles (as of a timestamp) into the structured market snapshot
 * every model and the forecast engine reads. Throws when history is too short
 * for a trustworthy EMA200 — we never show unreliable numbers.
 */
export function buildSnapshot(provider: MarketDataProvider, asOf: number): MarketSnapshot {
  const candles = provider.getCandlesUpTo(asOf, 600);
  if (candles.length < MIN_WARMUP_CANDLES) throw new InsufficientDataError();

  const closes = candles.map((c) => c.c);
  const last = candles[candles.length - 1]!;
  const prev = candles[candles.length - 2]!;
  const price = last.c;

  const e20s = emaSeries(closes, 20);
  const e50s = emaSeries(closes, 50);
  const ema20 = e20s[e20s.length - 1]!;
  const ema50 = e50s[e50s.length - 1]!;
  const ema200 = ema(closes, 200);
  const ema20Slope = ema20 - e20s[e20s.length - 6]!;
  const ema50Slope = ema50 - e50s[e50s.length - 11]!;

  const rsi14 = rsi(closes, 14);
  const m = macd(closes);
  const atr14 = atr(candles.slice(-120), 14);
  const atrPct = (atr14 / price) * 100;

  // ATR now vs the average ATR of the last ~100 candles (volatility context).
  const atrWindow: number[] = [];
  for (let i = candles.length - 60; i < candles.length; i += 10) {
    const seg = candles.slice(Math.max(0, i - 60), i);
    if (seg.length > 20) atrWindow.push(atr(seg, 14));
  }
  const atrAvg = atrWindow.length ? atrWindow.reduce((a, b) => a + b, 0) / atrWindow.length : atr14;
  const atrRatio = atrAvg > 0 ? atr14 / atrAvg : 1;

  const levels = nearestLevels(candles, price);

  const recent = candles.slice(-40);
  const firstHalf = recent.slice(0, 20);
  const secondHalf = recent.slice(20);
  const maxOf = (cs: Candle[]) => cs.reduce((x, c) => Math.max(x, c.h), -Infinity);
  const minOf = (cs: Candle[]) => cs.reduce((x, c) => Math.min(x, c.l), Infinity);
  const higherHighs = maxOf(secondHalf) > maxOf(firstHalf) && minOf(secondHalf) > minOf(firstHalf);
  const lowerLows = maxOf(secondHalf) < maxOf(firstHalf) && minOf(secondHalf) < minOf(firstHalf);

  let consecutiveBull = 0;
  let consecutiveBear = 0;
  for (let i = candles.length - 1; i >= 0; i--) {
    const c = candles[i]!;
    if (c.c > c.o) {
      if (consecutiveBear > 0) break;
      consecutiveBull++;
    } else if (c.c < c.o) {
      if (consecutiveBull > 0) break;
      consecutiveBear++;
    } else break;
    if (consecutiveBull > 12 || consecutiveBear > 12) break;
  }

  const last5 = candles.slice(-5);
  const bodyStrength =
    last5.reduce((a, c) => {
      const range = c.h - c.l;
      return a + (range > 0 ? Math.abs(c.c - c.o) / range : 0);
    }, 0) / last5.length;

  const win50 = closes.slice(-50);
  const mean50 = win50.reduce((a, b) => a + b, 0) / win50.length;
  const sd50 = stdev(win50) || 1;
  const zScore = (price - mean50) / sd50;

  // Trend score: EMA stack + slope + structure, squashed to -1..1
  const stack =
    (price > ema20 ? 0.2 : -0.2) +
    (ema20 > ema50 ? 0.25 : -0.25) +
    (ema50 > ema200 ? 0.25 : -0.25) +
    (price > ema200 ? 0.15 : -0.15);
  const slopeTerm = clamp((ema20Slope / (atr14 || 1)) * 0.5, -0.4, 0.4);
  const structureTerm = higherHighs ? 0.2 : lowerLows ? -0.2 : 0;
  const trendScore = clamp(stack + slopeTerm + structureTerm, -1, 1);

  const rsiTerm = clamp((rsi14 - 50) / 25, -1, 1) * 0.45;
  const macdTerm = clamp(m.hist / (atr14 * 0.5 || 1), -1, 1) * 0.35;
  const accelTerm = clamp((m.hist - m.histPrev) / (atr14 * 0.3 || 1), -1, 1) * 0.2;
  const momentumScore = clamp(rsiTerm + macdTerm + accelTerm, -1, 1);

  let regime: Regime;
  if (atrRatio > 1.55) regime = "volatile";
  else if (trendScore > 0.35) regime = "trending_up";
  else if (trendScore < -0.35) regime = "trending_down";
  else regime = "ranging";

  return {
    asOf,
    price,
    prevClose: prev.c,
    changePct: ((price - prev.c) / prev.c) * 100,
    candles,
    lastCandleTime: last.t,
    ema20,
    ema50,
    ema200,
    ema20Slope,
    ema50Slope,
    rsi14,
    macdLine: m.line,
    macdSignal: m.signal,
    macdHist: m.hist,
    macdHistPrev: m.histPrev,
    atr14,
    atrPct,
    atrRatio,
    support: levels.support,
    resistance: levels.resistance,
    swingHigh: levels.swingHigh,
    swingLow: levels.swingLow,
    higherHighs,
    lowerLows,
    consecutiveBull,
    consecutiveBear,
    bodyStrength,
    zScore,
    trendScore,
    momentumScore,
    regime,
  };
}

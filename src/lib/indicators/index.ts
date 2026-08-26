// Plain technical indicator maths. No market generation, no forecasting here.
import type { Candle } from "../types";

export function sma(values: number[], period: number): number {
  if (values.length < period) return NaN;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** Full EMA series; index i is undefined-safe (NaN) before warm-up. */
export function emaSeries(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function ema(values: number[], period: number): number {
  const s = emaSeries(values, period);
  return s[s.length - 1] ?? NaN;
}

export function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return NaN;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface MacdResult {
  line: number;
  signal: number;
  hist: number;
  histPrev: number;
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const f = emaSeries(values, fast);
  const s = emaSeries(values, slow);
  const line: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const a = f[i];
    const b = s[i];
    if (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b)) continue;
    line.push(a - b);
  }
  if (line.length < signalPeriod + 2) return { line: 0, signal: 0, hist: 0, histPrev: 0 };
  const sig = emaSeries(line, signalPeriod);
  const last = line.length - 1;
  const l = line[last]!;
  const sg = sig[last]!;
  const lPrev = line[last - 1]!;
  const sgPrev = sig[last - 1]!;
  return { line: l, signal: sg, hist: l - sg, histPrev: lPrev - sgPrev };
}

/** Wilder ATR. */
export function atr(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return NaN;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const p = candles[i - 1]!;
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
  }
  let a = trs.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < trs.length; i++) a = (a * (period - 1) + trs[i]!) / period;
  return a;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export interface Pivot {
  index: number;
  price: number;
}

/** Fractal swing pivots: a high/low surrounded by `span` lower/higher bars. */
export function findPivots(candles: Candle[], span = 3): { highs: Pivot[]; lows: Pivot[] } {
  const highs: Pivot[] = [];
  const lows: Pivot[] = [];
  for (let i = span; i < candles.length - span; i++) {
    const c = candles[i]!;
    let isHigh = true;
    let isLow = true;
    for (let j = i - span; j <= i + span; j++) {
      if (j === i) continue;
      if (candles[j]!.h >= c.h) isHigh = false;
      if (candles[j]!.l <= c.l) isLow = false;
    }
    if (isHigh) highs.push({ index: i, price: c.h });
    if (isLow) lows.push({ index: i, price: c.l });
  }
  return { highs, lows };
}

export function nearestLevels(
  candles: Candle[],
  price: number,
): { support: number; resistance: number; swingHigh: number; swingLow: number } {
  const window = candles.slice(-160);
  const { highs, lows } = findPivots(window, 3);
  const above = highs.map((p) => p.price).filter((p) => p > price);
  const below = lows.map((p) => p.price).filter((p) => p < price);
  const swingHigh = window.reduce((m, c) => Math.max(m, c.h), -Infinity);
  const swingLow = window.reduce((m, c) => Math.min(m, c.l), Infinity);
  return {
    resistance: above.length ? Math.min(...above) : swingHigh,
    support: below.length ? Math.max(...below) : swingLow,
    swingHigh,
    swingLow,
  };
}

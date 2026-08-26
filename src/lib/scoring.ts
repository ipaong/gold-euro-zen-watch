import type { Candle, Direction, Prediction, Score } from "./types";

function dirOf(from: number, to: number, atr: number): Direction {
  const th = atr * 0.35;
  if (to - from > th) return "BUY";
  if (from - to < -th) return "BUY";
  if (from - to > th) return "SELL";
  return "WAIT";
}

/** Compares a locked prediction with the candles that actually happened. */
export function scorePrediction(p: Prediction, actual: Candle[]): Score {
  const n = Math.min(p.forecast.length, actual.length);
  const atr = p.plan.atr || 1;
  const lastActual = actual[n - 1]!;
  const lastForecast = p.forecast[n - 1]!;

  let mae = 0;
  let candleDirHits = 0;
  let highError = 0;
  let lowError = 0;
  for (let i = 0; i < n; i++) {
    const f = p.forecast[i]!;
    const a = actual[i]!;
    mae += Math.abs(f.c - a.c);
    highError += Math.abs(f.h - a.h);
    lowError += Math.abs(f.l - a.l);
    const prevF = i === 0 ? p.price : p.forecast[i - 1]!.c;
    const prevA = i === 0 ? p.price : actual[i - 1]!.c;
    if (Math.sign(f.c - prevF) === Math.sign(a.c - prevA)) candleDirHits++;
  }

  const actualDirection = dirOf(p.price, lastActual.c, atr);
  const directionCorrect =
    p.consensus.direction === "WAIT" ? null : p.consensus.direction === actualDirection;

  const move = lastActual.c - p.price;
  const hypotheticalMove =
    p.consensus.direction === "BUY" ? move : p.consensus.direction === "SELL" ? -move : 0;

  return {
    scoredAt: Date.now(),
    directionCorrect,
    actualDirection,
    closeError: +(lastForecast.c - lastActual.c).toFixed(2),
    mae: +(mae / n).toFixed(2),
    highError: +(highError / n).toFixed(2),
    lowError: +(lowError / n).toFixed(2),
    candleDirHits,
    candleDirTotal: n,
    hypotheticalMove: +hypotheticalMove.toFixed(2),
  };
}

export interface Stats {
  total: number;
  scored: number;
  directional: number;
  hits: number;
  hitRate: number | null;
  avgMae: number | null;
  candleHitRate: number | null;
  netMove: number;
  waitCount: number;
}

export function computeStats(preds: Prediction[]): Stats {
  const scored = preds.filter((p) => p.score);
  const directional = scored.filter((p) => p.score!.directionCorrect !== null);
  const hits = directional.filter((p) => p.score!.directionCorrect).length;
  const candleHits = scored.reduce((a, p) => a + p.score!.candleDirHits, 0);
  const candleTotal = scored.reduce((a, p) => a + p.score!.candleDirTotal, 0);
  return {
    total: preds.length,
    scored: scored.length,
    directional: directional.length,
    hits,
    hitRate: directional.length ? Math.round((hits / directional.length) * 100) : null,
    avgMae: scored.length
      ? +(scored.reduce((a, p) => a + p.score!.mae, 0) / scored.length).toFixed(2)
      : null,
    candleHitRate: candleTotal ? Math.round((candleHits / candleTotal) * 100) : null,
    netMove: +scored.reduce((a, p) => a + p.score!.hypotheticalMove, 0).toFixed(2),
    waitCount: preds.filter((p) => p.consensus.direction === "WAIT").length,
  };
}

import { runDirectionEngine } from "./direction-engine";
import { MIN_WARMUP_CANDLES, type MarketDataProvider } from "./market/provider";
import { buildSnapshot } from "./snapshot";
import { runHistoricalPattern } from "./historical-pattern";
import type { Direction, NewsSnapshot } from "./types";

export interface DirectionBenchmark {
  sample: number;
  engineDirectional: number;
  engineHits: number;
  engineAccuracy: number | null;
  engineCoverage: number | null;
  engineWaits: number;
  engineWaitWithDirectionalOutcome: number;
  engineSevereOpposite: number;
  engineSevereOppositeRate: number | null;
  adaptiveDirectional: number;
  adaptiveHits: number;
  adaptiveAccuracy: number | null;
  adaptiveCoverage: number | null;
  adaptiveSevereOpposite: number;
  baselineDirectional: number;
  baselineHits: number;
  baselineAccuracy: number | null;
  patternDirectional: number;
  patternHits: number;
  patternAccuracy: number | null;
  patternSevereOpposite: number;
  alignedDirectional: number;
  alignedHits: number;
  alignedAccuracy: number | null;
  fusedDirectional: number;
  fusedHits: number;
  fusedAccuracy: number | null;
  fusedSevereOpposite: number;
}

const percent = (value: number, total: number) =>
  total ? Math.round((value / total) * 100) : null;

function directionOf(move: number, atr: number): Direction {
  const threshold = Math.max(Math.abs(atr) || 0, Number.EPSILON) * 0.35;
  if (move > threshold) return "BUY";
  if (move < -threshold) return "SELL";
  return "WAIT";
}

function opposite(a: Direction, b: Direction): boolean {
  return (a === "BUY" && b === "SELL") || (a === "SELL" && b === "BUY");
}

function neutralNews(asOf: number): NewsSnapshot {
  return {
    asOf,
    available: false,
    demo: true,
    headlines: [],
    goldBias: "neutral",
    eurBias: "neutral",
    netBias: "WAIT",
    netStrength: 0,
    upcoming: [],
    recent: [],
    minutesToHighImpact: null,
    nextHighImpact: null,
    riskLevel: "low",
  };
}

/**
 * Deterministic walk-forward diagnostic over one immutable provider dataset.
 * Every decision is built at candle i and scored only against candle i+horizon.
 */
export function benchmarkDirectionEngine(
  provider: MarketDataProvider,
  horizon = 5,
): DirectionBenchmark {
  const all = provider.getCandlesUpTo(provider.getLatestTime());
  let sample = 0;
  let engineDirectional = 0;
  let engineHits = 0;
  let engineWaits = 0;
  let engineWaitWithDirectionalOutcome = 0;
  let engineSevereOpposite = 0;
  let adaptiveDirectional = 0;
  let adaptiveHits = 0;
  let adaptiveSevereOpposite = 0;
  let baselineDirectional = 0;
  let baselineHits = 0;
  let patternDirectional = 0;
  let patternHits = 0;
  let patternSevereOpposite = 0;
  let alignedDirectional = 0;
  let alignedHits = 0;
  let fusedDirectional = 0;
  let fusedHits = 0;
  let fusedSevereOpposite = 0;

  for (let index = MIN_WARMUP_CANDLES - 1; index + horizon < all.length; index++) {
    const asOf = all[index]!.t;
    const snapshot = buildSnapshot(provider, asOf);
    const actual = all[index + horizon]!;
    const actualDirection = directionOf(actual.c - snapshot.price, snapshot.atr14);
    const engineDecision = runDirectionEngine(snapshot, neutralNews(asOf));
    const engineDirection = engineDecision.direction;
    const adaptiveDirection = engineDecision.adaptive.direction;
    const patternDecision = runHistoricalPattern(snapshot.candles);
    const patternDirection = patternDecision.direction;
    const alignedDirection = engineDirection === patternDirection ? engineDirection : "WAIT";
    const patternCalibrationAccuracy = patternDecision.calibrationSample
      ? Math.max(patternDecision.directHits, patternDecision.inverseHits) /
        patternDecision.calibrationSample
      : 0;
    const fusedDirection =
      alignedDirection !== "WAIT"
        ? alignedDirection
        : engineDirection === "WAIT" &&
            patternDirection !== "WAIT" &&
            Math.abs(patternDecision.edge) >= 0.25 &&
            patternCalibrationAccuracy >= 0.55
          ? patternDirection
          : patternDirection === "WAIT" &&
              engineDirection !== "WAIT" &&
              Math.abs(engineDecision.score) >= 0.65
            ? engineDirection
            : "WAIT";
    const baselineAnchor = snapshot.candles[snapshot.candles.length - 6];
    const baselineDirection = baselineAnchor
      ? directionOf(snapshot.price - baselineAnchor.c, snapshot.atr14)
      : "WAIT";

    sample++;
    if (engineDirection === "WAIT") {
      engineWaits++;
      if (actualDirection !== "WAIT") engineWaitWithDirectionalOutcome++;
    } else {
      engineDirectional++;
      if (engineDirection === actualDirection) engineHits++;
      if (opposite(engineDirection, actualDirection)) engineSevereOpposite++;
    }
    if (baselineDirection !== "WAIT") {
      baselineDirectional++;
      if (baselineDirection === actualDirection) baselineHits++;
    }
    if (adaptiveDirection !== "WAIT") {
      adaptiveDirectional++;
      if (adaptiveDirection === actualDirection) adaptiveHits++;
      if (opposite(adaptiveDirection, actualDirection)) adaptiveSevereOpposite++;
    }
    if (patternDirection !== "WAIT") {
      patternDirectional++;
      if (patternDirection === actualDirection) patternHits++;
      if (opposite(patternDirection, actualDirection)) patternSevereOpposite++;
    }
    if (alignedDirection !== "WAIT") {
      alignedDirectional++;
      if (alignedDirection === actualDirection) alignedHits++;
    }
    if (fusedDirection !== "WAIT") {
      fusedDirectional++;
      if (fusedDirection === actualDirection) fusedHits++;
      if (opposite(fusedDirection, actualDirection)) fusedSevereOpposite++;
    }
  }

  return {
    sample,
    engineDirectional,
    engineHits,
    engineAccuracy: percent(engineHits, engineDirectional),
    engineCoverage: percent(engineDirectional, sample),
    engineWaits,
    engineWaitWithDirectionalOutcome,
    engineSevereOpposite,
    engineSevereOppositeRate: percent(engineSevereOpposite, engineDirectional),
    adaptiveDirectional,
    adaptiveHits,
    adaptiveAccuracy: percent(adaptiveHits, adaptiveDirectional),
    adaptiveCoverage: percent(adaptiveDirectional, sample),
    adaptiveSevereOpposite,
    baselineDirectional,
    baselineHits,
    baselineAccuracy: percent(baselineHits, baselineDirectional),
    patternDirectional,
    patternHits,
    patternAccuracy: percent(patternHits, patternDirectional),
    patternSevereOpposite,
    alignedDirectional,
    alignedHits,
    alignedAccuracy: percent(alignedHits, alignedDirectional),
    fusedDirectional,
    fusedHits,
    fusedAccuracy: percent(fusedHits, fusedDirectional),
    fusedSevereOpposite,
  };
}

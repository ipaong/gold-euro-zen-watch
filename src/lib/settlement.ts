import type { MarketDataProvider } from "./market/provider";
import { scorePrediction, requiredHorizon } from "./scoring";
import type { Candle, Prediction, Score } from "./types";

export type SettlementStatus = "already_settled" | "not_ready" | "ready";

export interface SettlementEvaluation {
  status: SettlementStatus;
  actual: Candle[];
  score: Score | null;
  required: number;
  available: number;
}

/** Stable job payload for a future worker; it contains no mutation authority. */
export interface SettlementJob {
  predictionId: string;
  asOf: number;
  horizon: number;
}

export function toSettlementJob(prediction: Prediction): SettlementJob | null {
  if (!prediction.locked || prediction.score) return null;
  return {
    predictionId: prediction.id,
    asOf: prediction.asOf,
    horizon: requiredHorizon(prediction),
  };
}

type SettlementProvider = Pick<
  MarketDataProvider,
  "getCandlesAfter" | "intervalMs" | "symbol" | "providerSymbol"
>;

function invalidEvaluation(required: number): SettlementEvaluation {
  return { status: "not_ready", actual: [], score: null, required, available: 0 };
}

function isValidCandle(candle: Candle): boolean {
  return (
    Number.isFinite(candle.t) &&
    Number.isFinite(candle.o) &&
    Number.isFinite(candle.h) &&
    Number.isFinite(candle.l) &&
    Number.isFinite(candle.c) &&
    candle.t > 0 &&
    candle.o > 0 &&
    candle.h > 0 &&
    candle.l > 0 &&
    candle.c > 0 &&
    candle.h >= Math.max(candle.o, candle.c) &&
    candle.l <= Math.min(candle.o, candle.c)
  );
}

function hasContiguousHorizon(actual: Candle[], intervalMs: number): boolean {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return false;
  for (let index = 1; index < actual.length; index += 1) {
    if (actual[index]!.t - actual[index - 1]!.t !== intervalMs) return false;
  }
  return true;
}

/**
 * Pure readiness/evaluation boundary. It never mutates a prediction and never
 * reads data other than the requested candles strictly after its asOf.
 */
export function evaluateSettlement(
  prediction: Prediction,
  provider: SettlementProvider,
): SettlementEvaluation {
  const required = requiredHorizon(prediction);
  if (prediction.score) {
    return {
      status: "already_settled",
      actual: prediction.actual ?? [],
      score: prediction.score,
      required,
      available: prediction.actual?.length ?? 0,
    };
  }

  if (prediction.symbol !== provider.symbol) return invalidEvaluation(required);
  if (prediction.providerSymbol && prediction.providerSymbol !== provider.providerSymbol) {
    return invalidEvaluation(required);
  }

  let supplied: Candle[];
  try {
    supplied = provider.getCandlesAfter(prediction.asOf, required);
  } catch {
    return invalidEvaluation(required);
  }

  const actual = supplied
    .filter((candle) => Number.isFinite(candle.t) && candle.t > prediction.asOf)
    .slice(0, required);
  if (actual.length < required) {
    return { status: "not_ready", actual, score: null, required, available: actual.length };
  }
  if (!actual.every(isValidCandle) || !hasContiguousHorizon(actual, provider.intervalMs)) {
    return invalidEvaluation(required);
  }

  return {
    status: "ready",
    actual,
    score: scorePrediction(prediction, actual),
    required,
    available: actual.length,
  };
}

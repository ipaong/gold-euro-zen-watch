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

/**
 * Pure readiness/evaluation boundary. It never mutates a prediction and never
 * reads data other than the requested candles strictly after its asOf.
 */
export function evaluateSettlement(
  prediction: Prediction,
  provider: Pick<MarketDataProvider, "getCandlesAfter">,
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

  const actual = provider
    .getCandlesAfter(prediction.asOf, required)
    .filter((candle) => Number.isFinite(candle.t) && candle.t > prediction.asOf)
    .slice(0, required);
  if (actual.length < required) {
    return { status: "not_ready", actual, score: null, required, available: actual.length };
  }
  return {
    status: "ready",
    actual,
    score: scorePrediction(prediction, actual),
    required,
    available: actual.length,
  };
}

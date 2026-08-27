import type { MarketDataProvider } from "./market/provider";
import { scorePrediction, requiredHorizon } from "./scoring";
import { M15_MS } from "./market/provider";
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

function isValidCandle(value: unknown): value is Candle {
  if (!value || typeof value !== "object") return false;
  const candle = value as Partial<Candle>;
  if (![candle.t, candle.o, candle.h, candle.l, candle.c].every(Number.isFinite)) return false;
  return candle.h! >= Math.max(candle.o!, candle.c!) && candle.l! <= Math.min(candle.o!, candle.c!);
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

  let supplied: Candle[];
  try {
    supplied = provider.getCandlesAfter(prediction.asOf, required);
  } catch {
    return { status: "not_ready", actual: [], score: null, required, available: 0 };
  }

  if (!Array.isArray(supplied) || supplied.some((candle) => !isValidCandle(candle))) {
    return { status: "not_ready", actual: [], score: null, required, available: 0 };
  }

  const candidates = supplied.filter((candle) => candle.t > prediction.asOf);
  const malformed = candidates.some((candle) => !isValidCandle(candle));
  const ordered = candidates.every((candle, index) => index === 0 || candle.t > candidates[index - 1]!.t);
  const contiguous = candidates.every(
    (candle, index) => index === 0 || candle.t - candidates[index - 1]!.t === M15_MS,
  );
  if (malformed || !ordered || !contiguous) {
    return { status: "not_ready", actual: [], score: null, required, available: 0 };
  }

  const actual = candidates.slice(0, required);
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

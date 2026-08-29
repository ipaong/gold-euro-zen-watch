import { getModelScores } from "./scoring";
import type { ModelId, ModelVote, Prediction } from "./types";

export const MIN_CALIBRATION_SAMPLES = 8;

export interface ModelCalibration {
  samples: number;
  hits: number;
  accuracy: number;
  multiplier: number;
}

export interface LearningCalibration {
  sampleCount: number;
  calibrated: boolean;
  model: Partial<Record<ModelId, ModelCalibration>>;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * Build a walk-forward calibration profile for one replay instant.
 *
 * A settled prediction is eligible only when both its lock time and the last
 * realised candle used to score it are at or before targetAsOf. This makes the
 * same function safe for Time Machine: a replay can learn from its past, never
 * from outcomes that were still in the future at that simulated instant.
 */
export function buildChronologicalCalibration(
  predictions: Prediction[],
  targetAsOf: number,
  symbol: string,
  timeframe: string,
  currentModels: ModelVote[],
): LearningCalibration {
  const eligibleByAsOf = new Map<number, Prediction>();
  for (const prediction of predictions) {
    if (!prediction.score || !prediction.actual?.length) continue;
    if (prediction.symbol !== symbol || prediction.timeframe !== timeframe) continue;
    const lastActualTime = prediction.actual[prediction.actual.length - 1]?.t ?? Infinity;
    if (prediction.asOf < targetAsOf && lastActualTime <= targetAsOf) {
      // Replaying the same timestamp repeatedly must not farm influence.
      if (!eligibleByAsOf.has(prediction.asOf)) eligibleByAsOf.set(prediction.asOf, prediction);
    }
  }
  const eligible = [...eligibleByAsOf.values()];

  const model: Partial<Record<ModelId, ModelCalibration>> = {};
  for (const current of currentModels) {
    const observations = eligible
      .flatMap((prediction) => getModelScores(prediction))
      .filter(
        (score) =>
          score.id === current.id &&
          !score.unavailable &&
          score.direction !== "WAIT" &&
          score.directionCorrect !== null,
      );
    const sameDirection = observations.filter((score) => score.direction === current.direction);
    // Direction-specific skill matters more, but fall back to the full model
    // history until that bucket has enough evidence.
    const sample = sameDirection.length >= 5 ? sameDirection : observations;
    const samples = sample.length;
    const hits = sample.filter((score) => score.directionCorrect === true).length;

    // Beta(4,4) shrinkage prevents a lucky 1/1 streak from becoming a giant
    // vote. Neutral 50% maps to 1.0; the influence is capped at ±25%.
    const posteriorAccuracy = (hits + 4) / (samples + 8);
    const multiplier =
      samples < MIN_CALIBRATION_SAMPLES
        ? 1
        : clamp(1 + (posteriorAccuracy - 0.5), 0.75, 1.25);

    model[current.id] = {
      samples,
      hits,
      accuracy: posteriorAccuracy,
      multiplier,
    };
  }

  return {
    sampleCount: eligible.length,
    calibrated: Object.values(model).some(
      (entry) =>
        entry !== undefined &&
        entry.samples >= MIN_CALIBRATION_SAMPLES &&
        entry.multiplier !== 1,
    ),
    model,
  };
}

export function calibrationMultiplier(
  calibration: LearningCalibration | undefined,
  modelId: ModelId,
): number {
  return calibration?.model[modelId]?.multiplier ?? 1;
}

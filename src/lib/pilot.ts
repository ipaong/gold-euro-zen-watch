import { computeStats, selectPredictionWindow } from "./scoring";
import type { Prediction } from "./types";

export const PILOT_PROTOCOL = {
  minimumLocked: 80,
  tuningPredictions: 30,
  evaluationPredictions: 50,
  confidenceLevel: 0.95,
  primaryMetric: "Consensus directional accuracy on the chronological evaluation set",
  stoppingCriteria: [
    "พบ data-isolation incident หรือ locked snapshot ถูกแก้ย้อนหลัง",
    "settlement completeness ต่ำกว่า 90% เมื่อครบช่วง pilot",
    "ข้อมูลไม่พอสำหรับ evaluation set ตามจำนวนขั้นต่ำ",
  ],
} as const;

export interface IntervalEstimate {
  estimate: number | null;
  lower: number | null;
  upper: number | null;
  sample: number;
}

export interface PilotSummary {
  locked: number;
  scored: number;
  settlementCompleteness: number | null;
  tuning: ReturnType<typeof computeStats>;
  evaluation: ReturnType<typeof computeStats>;
  primaryMetric: IntervalEstimate;
  eligible: boolean;
  warnings: string[];
}

/** Wilson interval: an honest uncertainty estimate for a directional hit rate. */
export function wilsonInterval(hits: number, sample: number, z = 1.96): IntervalEstimate {
  if (!sample) return { estimate: null, lower: null, upper: null, sample: 0 };
  const p = hits / sample;
  const denominator = 1 + (z * z) / sample;
  const centre = (p + (z * z) / (2 * sample)) / denominator;
  const margin =
    (z / denominator) * Math.sqrt((p * (1 - p)) / sample + (z * z) / (4 * sample * sample));
  return {
    estimate: Math.round(p * 100),
    lower: Math.max(0, Math.round((centre - margin) * 100)),
    upper: Math.min(100, Math.round((centre + margin) * 100)),
    sample,
  };
}

export function summarizePilot(predictions: Prediction[]): PilotSummary {
  const chronological = [...predictions].sort((a, b) => a.asOf - b.asOf);
  const tuningPredictions = chronological.slice(0, PILOT_PROTOCOL.tuningPredictions);
  const evaluationPredictions = chronological.slice(
    PILOT_PROTOCOL.tuningPredictions,
    PILOT_PROTOCOL.tuningPredictions + PILOT_PROTOCOL.evaluationPredictions,
  );
  const tuning = computeStats(tuningPredictions);
  const evaluation = computeStats(evaluationPredictions);
  const directional = evaluation.directional;
  const primaryMetric = wilsonInterval(evaluation.hits, directional);
  const scored = predictions.filter((prediction) => prediction.score).length;
  const settlementCompleteness = predictions.length
    ? Math.round((scored / predictions.length) * 100)
    : null;
  const warnings: string[] = [];
  if (predictions.length < PILOT_PROTOCOL.minimumLocked) {
    warnings.push(
      `ยังมี locked predictions ${predictions.length}/${PILOT_PROTOCOL.minimumLocked} รายการ`,
    );
  }
  if (evaluationPredictions.length < PILOT_PROTOCOL.evaluationPredictions) {
    warnings.push(
      `evaluation set มี ${evaluationPredictions.length}/${PILOT_PROTOCOL.evaluationPredictions} รายการ`,
    );
  }
  if (evaluation.directional < PILOT_PROTOCOL.evaluationPredictions) {
    warnings.push(
      `evaluation มีผลทิศทางที่ settle แล้ว ${evaluation.directional}/${PILOT_PROTOCOL.evaluationPredictions} ตัวอย่าง`,
    );
  }
  if (settlementCompleteness !== null && settlementCompleteness < 90) {
    warnings.push(`settlement completeness ${settlementCompleteness}% ต่ำกว่า 90%`);
  }
  if (!directional) warnings.push("ยังไม่มีผล Consensus ที่นับทิศทางได้ใน evaluation set");

  return {
    locked: predictions.length,
    scored,
    settlementCompleteness,
    tuning,
    evaluation,
    primaryMetric,
    eligible:
      predictions.length >= PILOT_PROTOCOL.minimumLocked &&
      evaluationPredictions.length >= PILOT_PROTOCOL.evaluationPredictions &&
      evaluation.directional >= PILOT_PROTOCOL.evaluationPredictions &&
      Boolean(directional) &&
      (settlementCompleteness ?? 0) >= 90,
    warnings,
  };
}

export function latestPilotEvaluation(predictions: Prediction[]): Prediction[] {
  return selectPredictionWindow(predictions, "all")
    .sort((a, b) => a.asOf - b.asOf)
    .slice(-PILOT_PROTOCOL.evaluationPredictions);
}

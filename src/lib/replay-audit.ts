import type { Direction, Prediction } from "./types";

export const MIN_INVERSE_AUDIT_SAMPLE = 10;

export type ReplayDiagnosis = "insufficient" | "possible_inverse" | "direct_better" | "mixed";

export interface ReplayAudit {
  scored: number;
  directional: number;
  coverage: number | null;
  comparable: number;
  directHits: number;
  directAccuracy: number | null;
  inverseHits: number;
  inverseAccuracy: number | null;
  waitCount: number;
  waitWithDirectionalOutcome: number;
  continuationSample: number;
  continuationHits: number;
  continuationAccuracy: number | null;
  diagnosis: ReplayDiagnosis;
  note: string;
}

function percent(numerator: number, denominator: number): number | null {
  return denominator ? Math.round((numerator / denominator) * 100) : null;
}

function opposite(direction: Direction): Direction {
  return direction === "BUY" ? "SELL" : direction === "SELL" ? "BUY" : "WAIT";
}

/**
 * A deliberately simple pre-prediction baseline: continue the net direction
 * of the five latest visible candles. Candles after asOf are always ignored.
 */
function continuationDirection(prediction: Prediction): Direction | null {
  const visible = (prediction.marketCandles ?? [])
    .filter((candle) => candle.t <= prediction.asOf)
    .sort((a, b) => a.t - b.t);
  if (visible.length < 6) return null;

  const latest = visible[visible.length - 1]!;
  const anchor = visible[visible.length - 6]!;
  const threshold = Math.max(Math.abs(prediction.plan.atr) || 0, Number.EPSILON) * 0.35;
  const move = latest.c - anchor.c;
  if (move > threshold) return "BUY";
  if (move < -threshold) return "SELL";
  return "WAIT";
}

/** Audit only immutable, settled predictions; it never recalculates a locked score. */
export function computeReplayAudit(predictions: Prediction[]): ReplayAudit {
  const settled = predictions.filter((prediction) => prediction.score);
  const directional = settled.filter((prediction) => prediction.consensus.direction !== "WAIT");
  const comparable = directional.filter(
    (prediction) => prediction.score!.actualDirection !== "WAIT",
  );
  const directHits = comparable.filter(
    (prediction) => prediction.consensus.direction === prediction.score!.actualDirection,
  ).length;
  const inverseHits = comparable.filter(
    (prediction) => opposite(prediction.consensus.direction) === prediction.score!.actualDirection,
  ).length;
  const waits = settled.filter((prediction) => prediction.consensus.direction === "WAIT");

  const continuation = settled.flatMap((prediction) => {
    const direction = continuationDirection(prediction);
    const actual = prediction.score!.actualDirection;
    return direction && direction !== "WAIT" && actual !== "WAIT"
      ? [{ hit: direction === actual }]
      : [];
  });
  const continuationHits = continuation.filter((item) => item.hit).length;

  const directAccuracy = percent(directHits, comparable.length);
  const inverseAccuracy = percent(inverseHits, comparable.length);
  let diagnosis: ReplayDiagnosis = "mixed";
  let note = "ผลปัจจุบันยังไม่ชี้ชัดว่าระบบมีอาการกลับทิศหรือเพียงเจอช่วงตลาดที่ยาก";

  if (comparable.length < MIN_INVERSE_AUDIT_SAMPLE) {
    diagnosis = "insufficient";
    note = `ต้องมีสัญญาณ BUY/SELL ที่ผลจริงเป็นทิศทางอย่างน้อย ${MIN_INVERSE_AUDIT_SAMPLE} รอบก่อนสรุป inverse test`;
  } else if (
    inverseAccuracy !== null &&
    directAccuracy !== null &&
    inverseAccuracy >= 60 &&
    inverseAccuracy - directAccuracy >= 20
  ) {
    diagnosis = "possible_inverse";
    note =
      "กลับ BUY/SELL แล้วดีกว่าของเดิมอย่างมีนัยเชิงปฏิบัติ ควรตรวจ sign, label และสูตรทิศก่อนปรับน้ำหนัก";
  } else if (
    directAccuracy !== null &&
    inverseAccuracy !== null &&
    directAccuracy >= inverseAccuracy
  ) {
    diagnosis = "direct_better";
    note = "ทิศเดิมไม่ได้แพ้การกลับ BUY/SELL; ให้ไล่ดู regime, session และจังหวะที่พลาดแทน";
  }

  return {
    scored: settled.length,
    directional: directional.length,
    coverage: percent(directional.length, settled.length),
    comparable: comparable.length,
    directHits,
    directAccuracy,
    inverseHits,
    inverseAccuracy,
    waitCount: waits.length,
    waitWithDirectionalOutcome: waits.filter(
      (prediction) => prediction.score!.actualDirection !== "WAIT",
    ).length,
    continuationSample: continuation.length,
    continuationHits,
    continuationAccuracy: percent(continuationHits, continuation.length),
    diagnosis,
    note,
  };
}

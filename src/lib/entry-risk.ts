import { assessReversalRisk } from "./reversal-risk";
import type { Direction, MarketSnapshot } from "./types";

export interface EntryRiskAssessment {
  blocked: boolean;
  reasons: string[];
  opposingReversal: number;
  recentMoveAtr: number;
}

/**
 * Conservative pre-entry guard. It may turn a risky BUY/SELL into WAIT, but it
 * never creates or flips a direction and reads only candles already in the snapshot.
 */
export function assessEntryRisk(
  snapshot: MarketSnapshot,
  direction: Direction,
): EntryRiskAssessment {
  if (direction === "WAIT") {
    return { blocked: false, reasons: [], opposingReversal: 0, recentMoveAtr: 0 };
  }

  const reversal = assessReversalRisk(snapshot);
  const opposingReversal = direction === "BUY" ? reversal.bearish : reversal.bullish;
  const atr = Math.max(Math.abs(snapshot.atr14) || 0, Number.EPSILON);
  const latest = snapshot.candles[snapshot.candles.length - 1];
  const anchor = snapshot.candles[snapshot.candles.length - 4];
  const recentMoveAtr = latest && anchor ? (latest.c - anchor.c) / atr : 0;
  const recentMoveAgainst = direction === "BUY" ? recentMoveAtr <= -0.8 : recentMoveAtr >= 0.8;
  const momentumAgainst =
    direction === "BUY" ? snapshot.momentumScore <= -0.35 : snapshot.momentumScore >= 0.35;
  const chasingStretch =
    direction === "BUY"
      ? snapshot.zScore >= 1.8 && reversal.resistanceProximity >= 0.25
      : snapshot.zScore <= -1.8 && reversal.supportProximity >= 0.25;

  const reasons: string[] = [];
  if (opposingReversal >= 0.58) reasons.push("บริบทกลับตัวสวนสัญญาณแรง");
  if (recentMoveAgainst) reasons.push("3 แท่งล่าสุดเคลื่อนสวนสัญญาณแรง");
  if (momentumAgainst) reasons.push("Momentum หลักสวนทิศเสียงข้างมาก");
  if (chasingStretch) reasons.push("ราคาเหยียดไกลและชิดแนวสำคัญ เสี่ยงไล่ราคา");

  return { blocked: reasons.length > 0, reasons, opposingReversal, recentMoveAtr };
}

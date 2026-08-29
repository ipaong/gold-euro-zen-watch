import { assessReversalRisk } from "./reversal-risk";
import type { Direction, MarketSnapshot } from "./types";

export interface EntryRiskAssessment {
  blocked: boolean;
  reasons: string[];
  opposingReversal: number;
  recentMoveAtr: number;
}

/**
 * Hard contradiction guard. Reversal proximity by itself is deliberately not
 * a blocker: being near support/resistance is a setup, not proof of a turn.
 * It may turn a contradictory BUY/SELL into WAIT, but never flips direction.
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
  const reasons: string[] = [];
  if (recentMoveAgainst) reasons.push("3 แท่งล่าสุดเคลื่อนสวนสัญญาณแรง");
  if (momentumAgainst) reasons.push("Momentum หลักสวนทิศเสียงข้างมาก");

  return { blocked: reasons.length > 0, reasons, opposingReversal, recentMoveAtr };
}

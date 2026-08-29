import { assessReversalRisk } from "./reversal-risk";
import { runHistoricalPattern, type HistoricalPatternDecision } from "./historical-pattern";
import type { Candle, Direction, MarketSnapshot, NewsSnapshot } from "./types";

export const DIRECTION_ENGINE_VERSION = "2.0.0";

export interface DirectionEngineDecision {
  version: typeof DIRECTION_ENGINE_VERSION;
  direction: Direction;
  confidence: number;
  /** Final signed edge after confirmed-reversal routing, -1..1. */
  score: number;
  /** Continuation-only edge before reversal routing, -1..1. */
  continuationScore: number;
  shortTapeScore: number;
  swingTapeScore: number;
  movesAtr: { one: number; three: number; five: number; twelve: number };
  alignedEvidence: number;
  reversalConfirmed: boolean;
  reversalDirection: Direction;
  severeOpposition: boolean;
  tapeDirection: Direction;
  patternAligned: boolean;
  multiHorizonAligned: boolean;
  exhaustionVeto: boolean;
  pattern: HistoricalPatternDecision;
  reasons: string[];
}

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));

function directionOf(value: number, threshold: number): Direction {
  if (value > threshold) return "BUY";
  if (value < -threshold) return "SELL";
  return "WAIT";
}

function visibleCandles(snapshot: MarketSnapshot): Candle[] {
  return snapshot.candles.filter((candle) => candle.t <= snapshot.asOf).sort((a, b) => a.t - b.t);
}

function moveInAtr(snapshot: MarketSnapshot, candles: Candle[], bars: number): number {
  const latest = candles[candles.length - 1]?.c ?? snapshot.price;
  const anchor = candles[candles.length - 1 - bars]?.c;
  const fallback = bars === 1 ? snapshot.prevClose : undefined;
  const from = anchor ?? fallback;
  if (from === undefined) return 0;
  return (latest - from) / Math.max(Math.abs(snapshot.atr14) || 0, Number.EPSILON);
}

function emaContext(snapshot: MarketSnapshot): number {
  const atr = Math.max(Math.abs(snapshot.atr14) || 0, Number.EPSILON);
  const priceVsFast = clamp((snapshot.price - snapshot.ema20) / (atr * 1.2));
  const fastVsMedium = clamp((snapshot.ema20 - snapshot.ema50) / (atr * 2));
  const fastSlope = clamp(snapshot.ema20Slope / (atr * 0.8));
  return clamp(priceVsFast * 0.38 + fastVsMedium * 0.22 + fastSlope * 0.4);
}

function structureContext(snapshot: MarketSnapshot): number {
  if (snapshot.higherHighs && !snapshot.lowerLows) return 1;
  if (snapshot.lowerLows && !snapshot.higherHighs) return -1;
  return 0;
}

/**
 * Five-candle direction engine.
 *
 * Continuation is the default because the target is only five M15 candles.
 * Mean-reversion context may reduce conviction, but it can reverse a trend
 * only after both price structure and momentum have visibly turned. Every
 * input comes from MarketSnapshot, which is already clipped to `asOf`.
 */
export function runDirectionEngine(
  snapshot: MarketSnapshot,
  news: NewsSnapshot,
): DirectionEngineDecision {
  const candles = visibleCandles(snapshot);
  const movesAtr = {
    one: moveInAtr(snapshot, candles, 1),
    three: moveInAtr(snapshot, candles, 3),
    five: moveInAtr(snapshot, candles, 5),
    twelve: moveInAtr(snapshot, candles, 12),
  };

  // Split price action into two horizons so one noisy candle cannot masquerade
  // as several independent votes.
  const shortTapeScore = clamp(
    clamp(movesAtr.one / 0.55) * 0.35 + clamp(movesAtr.three / 1.05) * 0.65,
  );
  const swingTapeScore = clamp(
    clamp(movesAtr.five / 1.45) * 0.65 + clamp(movesAtr.twelve / 2.4) * 0.35,
  );
  const emaScore = emaContext(snapshot);
  const structureScore = structureContext(snapshot);
  const priceActionScore = clamp(shortTapeScore * 0.45 + swingTapeScore * 0.4 + emaScore * 0.15);
  const continuationScore = clamp(
    priceActionScore * 0.65 + snapshot.momentumScore * 0.2 + emaScore * 0.1 + structureScore * 0.05,
  );

  const reversal = assessReversalRisk(snapshot);
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const twoBack = candles[candles.length - 3];
  const atr = Math.max(Math.abs(snapshot.atr14) || 0, Number.EPSILON);

  // Proximity, RSI or a wick is only a SETUP. Reversal needs a close through
  // the previous two-bar structure and momentum follow-through as confirmation.
  const bullishStructureBreak = Boolean(
    latest && previous && twoBack && latest.c > Math.max(previous.h, twoBack.h) + atr * 0.02,
  );
  const bearishStructureBreak = Boolean(
    latest && previous && twoBack && latest.c < Math.min(previous.l, twoBack.l) - atr * 0.02,
  );
  const bullishMomentumTurn =
    movesAtr.one >= 0.18 && movesAtr.three > 0 && snapshot.macdHist > snapshot.macdHistPrev;
  const bearishMomentumTurn =
    movesAtr.one <= -0.18 && movesAtr.three < 0 && snapshot.macdHist < snapshot.macdHistPrev;
  const bullishConfirmed = reversal.bullish >= 0.42 && bullishStructureBreak && bullishMomentumTurn;
  const bearishConfirmed = reversal.bearish >= 0.42 && bearishStructureBreak && bearishMomentumTurn;

  let score = continuationScore;
  let reversalDirection: Direction = "WAIT";
  if (bullishConfirmed && !bearishConfirmed) {
    reversalDirection = "BUY";
    // A confirmed reversal first neutralises a still-strong bearish tape. It
    // becomes BUY only when the continuation edge has already weakened.
    score =
      continuationScore < -0.35
        ? 0
        : Math.max(0.28, continuationScore * 0.4 + reversal.bullish * 0.6);
  } else if (bearishConfirmed && !bullishConfirmed) {
    reversalDirection = "SELL";
    score =
      continuationScore > 0.35
        ? 0
        : Math.min(-0.28, continuationScore * 0.4 - reversal.bearish * 0.6);
  }
  score = clamp(score);

  const deadZone =
    snapshot.regime === "ranging" ? 0.26 : snapshot.regime === "volatile" ? 0.28 : 0.2;
  let direction = directionOf(score, deadZone);

  const lanes = [
    directionOf(shortTapeScore, 0.18),
    directionOf(swingTapeScore, 0.18),
    directionOf(emaScore, 0.2),
    directionOf(snapshot.momentumScore, 0.2),
    directionOf(structureScore, 0.5),
  ];
  let alignedEvidence =
    direction === "WAIT" ? 0 : lanes.filter((lane) => lane === direction).length;
  const reversalConfirmed = bullishConfirmed || bearishConfirmed;
  if (direction !== "WAIT" && reversalDirection === direction) alignedEvidence += 1;

  // Hard anti-opposite guard: never fire against both fast and swing tape (or
  // price action plus momentum) unless a reversal has actually confirmed.
  const strongBearTape =
    (shortTapeScore <= -0.42 && swingTapeScore <= -0.35) ||
    (priceActionScore <= -0.42 && snapshot.momentumScore <= -0.35);
  const strongBullTape =
    (shortTapeScore >= 0.42 && swingTapeScore >= 0.35) ||
    (priceActionScore >= 0.42 && snapshot.momentumScore >= 0.35);
  const severeOpposition =
    (direction === "BUY" && strongBearTape && !bullishConfirmed) ||
    (direction === "SELL" && strongBullTape && !bearishConfirmed);

  if (severeOpposition || (direction !== "WAIT" && alignedEvidence < 2)) {
    direction = "WAIT";
  }

  const tapeDirection = direction;
  const pattern = runHistoricalPattern(candles);
  const patternRequired = pattern.calibrated && pattern.neighborCount >= 9;
  const patternAligned = direction !== "WAIT" && patternRequired && pattern.direction === direction;
  // Accuracy-first contract: when the walk-forward historical pattern and
  // visible tape disagree, abstain. The pattern may confirm or veto a call;
  // it can never flip a continuation call into its opposite.
  if (patternRequired && direction !== pattern.direction) {
    direction = "WAIT";
  }
  const multiHorizonAligned =
    direction !== "WAIT" &&
    directionOf(shortTapeScore, 0.18) === direction &&
    directionOf(swingTapeScore, 0.18) === direction;
  const exhaustionVeto =
    (direction === "BUY" && snapshot.zScore >= 2 && snapshot.rsi14 >= 65) ||
    (direction === "SELL" && snapshot.zScore <= -2 && snapshot.rsi14 <= 35);
  if (direction !== "WAIT" && ((!multiHorizonAligned && !reversalConfirmed) || exhaustionVeto)) {
    direction = "WAIT";
  }

  let confidence =
    direction === "WAIT"
      ? 46 + Math.max(0, deadZone - Math.abs(score)) * 35
      : 43 + Math.abs(score) * 42 + Math.min(4, alignedEvidence) * 4;
  if (news.riskLevel === "high") confidence -= 8;
  else if (news.riskLevel === "medium") confidence -= 3;
  if (snapshot.regime === "volatile") confidence -= 5;
  if (news.stale) confidence -= 3;
  if (patternAligned) confidence += 6;
  if (patternRequired && !patternAligned) confidence -= 5;
  confidence = Math.round(clamp(confidence, 25, 92));

  const reasons: string[] = [];
  if (shortTapeScore >= 0.18) reasons.push("แรงราคา 1–3 แท่งเอียงขึ้น");
  if (shortTapeScore <= -0.18) reasons.push("แรงราคา 1–3 แท่งเอียงลง");
  if (swingTapeScore >= 0.18) reasons.push("ทิศ 5–12 แท่งสนับสนุนขาขึ้น");
  if (swingTapeScore <= -0.18) reasons.push("ทิศ 5–12 แท่งสนับสนุนขาลง");
  if (reversalDirection !== "WAIT")
    reasons.push(
      `กลับตัว${reversalDirection === "BUY" ? "ขึ้น" : "ลง"}ยืนยันด้วยโครงสร้างและโมเมนตัม`,
    );
  if (severeOpposition) reasons.push("ระงับสัญญาณที่สวนแรงราคาหลายช่วงพร้อมกัน");
  if (patternAligned) reasons.push("รูปแบบย้อนหลังแบบ walk-forward ยืนยันทิศเดียวกัน");
  if (patternRequired && !patternAligned)
    reasons.push("WAIT เพราะรูปแบบย้อนหลังไม่ยืนยันทิศจากแรงราคาปัจจุบัน");
  if (!multiHorizonAligned && tapeDirection !== "WAIT" && !reversalConfirmed)
    reasons.push("WAIT เพราะแรงราคาเร็วกับทิศ 5–12 แท่งยังไม่ไปทางเดียวกัน");
  if (exhaustionVeto) reasons.push("WAIT แทนการไล่ราคา เพราะเทรนด์ยืดสุดทางและ RSI ตึงมาก");
  if (!reasons.length) reasons.push("แรงราคาหลายช่วงยังหักล้างกัน");

  return {
    version: DIRECTION_ENGINE_VERSION,
    direction,
    confidence,
    score: +score.toFixed(4),
    continuationScore: +continuationScore.toFixed(4),
    shortTapeScore: +shortTapeScore.toFixed(4),
    swingTapeScore: +swingTapeScore.toFixed(4),
    movesAtr: {
      one: +movesAtr.one.toFixed(3),
      three: +movesAtr.three.toFixed(3),
      five: +movesAtr.five.toFixed(3),
      twelve: +movesAtr.twelve.toFixed(3),
    },
    alignedEvidence,
    reversalConfirmed,
    reversalDirection,
    severeOpposition,
    tapeDirection,
    patternAligned,
    multiHorizonAligned,
    exhaustionVeto,
    pattern,
    reasons,
  };
}

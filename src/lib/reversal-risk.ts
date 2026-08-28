import type { MarketSnapshot } from "./types";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function proximity(distanceAtr: number): number {
  if (distanceAtr < -0.15) return 0;
  return clamp01((1.3 - Math.max(0, distanceAtr)) / 0.9);
}

export interface ReversalRisk {
  bullish: number;
  bearish: number;
  supportDistanceAtr: number;
  resistanceDistanceAtr: number;
  supportProximity: number;
  resistanceProximity: number;
  bullishSignals: string[];
  bearishSignals: string[];
}

/**
 * Continuous reversal context shared by all models.
 *
 * This deliberately does not create BUY/SELL signals. It softens conviction
 * when price is stretched into a nearby level or a strong move fails to get
 * follow-through. Formal pivot divergence and multi-timeframe levels remain
 * separate roadmap work.
 */
export function assessReversalRisk(s: MarketSnapshot): ReversalRisk {
  const atr = Math.max(Math.abs(s.atr14) || 0, Number.EPSILON);
  const supportDistanceAtr = (s.price - s.support) / atr;
  const resistanceDistanceAtr = (s.resistance - s.price) / atr;
  const supportProximity = proximity(supportDistanceAtr);
  const resistanceProximity = proximity(resistanceDistanceAtr);
  const downsideStretch = clamp01((-s.zScore - 1.2) / 1.2);
  const upsideStretch = clamp01((s.zScore - 1.2) / 1.2);
  const oversoldPressure = clamp01((45 - s.rsi14) / 20);
  const overboughtPressure = clamp01((s.rsi14 - 55) / 20);
  const macdTurningUp = s.macdHist < 0 ? clamp01((s.macdHist - s.macdHistPrev) / (atr * 0.08)) : 0;
  const macdTurningDown =
    s.macdHist > 0 ? clamp01((s.macdHistPrev - s.macdHist) / (atr * 0.08)) : 0;

  const latest = s.candles[s.candles.length - 1];
  const previous = s.candles[s.candles.length - 2];
  let bullishRejection = 0;
  let bearishRejection = 0;
  if (latest) {
    const range = Math.max(latest.h - latest.l, Number.EPSILON);
    const bodyTop = Math.max(latest.o, latest.c);
    const bodyBottom = Math.min(latest.o, latest.c);
    const lowerWickShare = (bodyBottom - latest.l) / range;
    const upperWickShare = (latest.h - bodyTop) / range;
    bullishRejection = clamp01((lowerWickShare - 0.2) / 0.35) * (latest.c >= latest.o ? 1 : 0.65);
    bearishRejection = clamp01((upperWickShare - 0.2) / 0.35) * (latest.c <= latest.o ? 1 : 0.65);
  }

  let failedBearFollowThrough = 0;
  let failedBullFollowThrough = 0;
  if (latest && previous) {
    const previousBodyAtr = Math.abs(previous.c - previous.o) / atr;
    if (
      previous.c < previous.o &&
      previousBodyAtr >= 0.8 &&
      latest.l >= previous.l - atr * 0.1 &&
      latest.c >= previous.c
    ) {
      failedBearFollowThrough = clamp01(previousBodyAtr / 1.5);
    }
    if (
      previous.c > previous.o &&
      previousBodyAtr >= 0.8 &&
      latest.h <= previous.h + atr * 0.1 &&
      latest.c <= previous.c
    ) {
      failedBullFollowThrough = clamp01(previousBodyAtr / 1.5);
    }
  }

  const bullish = clamp01(
    supportProximity * 0.3 +
      downsideStretch * 0.22 +
      oversoldPressure * 0.13 +
      macdTurningUp * 0.13 +
      Math.max(bullishRejection, failedBearFollowThrough) * 0.22,
  );
  const bearish = clamp01(
    resistanceProximity * 0.3 +
      upsideStretch * 0.22 +
      overboughtPressure * 0.13 +
      macdTurningDown * 0.13 +
      Math.max(bearishRejection, failedBullFollowThrough) * 0.22,
  );

  const bullishSignals: string[] = [];
  const bearishSignals: string[] = [];
  if (supportProximity >= 0.2)
    bullishSignals.push(`ราคาอยู่ใกล้แนวรับ ${supportDistanceAtr.toFixed(1)} ATR`);
  if (resistanceProximity >= 0.2)
    bearishSignals.push(`ราคาอยู่ใกล้แนวต้าน ${resistanceDistanceAtr.toFixed(1)} ATR`);
  if (downsideStretch >= 0.2)
    bullishSignals.push(`ราคาต่ำกว่าค่าเฉลี่ยมาก (Z ${s.zScore.toFixed(2)})`);
  if (upsideStretch >= 0.2)
    bearishSignals.push(`ราคาสูงกว่าค่าเฉลี่ยมาก (Z +${s.zScore.toFixed(2)})`);
  if (macdTurningUp >= 0.2) bullishSignals.push("MACD ฝั่งลบเริ่มฟื้นตัว");
  if (macdTurningDown >= 0.2) bearishSignals.push("MACD ฝั่งบวกเริ่มชะลอ");
  if (failedBearFollowThrough >= 0.35)
    bullishSignals.push("แรงขายแท่งก่อนหน้าไม่มี follow-through");
  if (failedBullFollowThrough >= 0.35)
    bearishSignals.push("แรงซื้อแท่งก่อนหน้าไม่มี follow-through");
  if (bullishRejection >= 0.35) bullishSignals.push("แท่งล่าสุดมีแรงปฏิเสธราคาด้านล่าง");
  if (bearishRejection >= 0.35) bearishSignals.push("แท่งล่าสุดมีแรงปฏิเสธราคาด้านบน");

  return {
    bullish,
    bearish,
    supportDistanceAtr,
    resistanceDistanceAtr,
    supportProximity,
    resistanceProximity,
    bullishSignals,
    bearishSignals,
  };
}

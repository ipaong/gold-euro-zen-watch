import { MIN_WARMUP_CANDLES } from "./provider";
import type { MarketDataValidation } from "./contract";

export type GoldFeedReadiness =
  | { mode: "live"; reason?: never }
  | { mode: "warming"; reason: string }
  | { mode: "fallback"; reason: string };

export function evaluateGoldFeedReadiness(
  candleCount: number,
  validation: Pick<MarketDataValidation, "valid" | "stale">,
  requiredCandles = MIN_WARMUP_CANDLES,
): GoldFeedReadiness {
  if (!validation.valid) return { mode: "fallback", reason: "ข้อมูลไม่ผ่าน validation" };
  if (validation.stale) return { mode: "fallback", reason: "ข้อมูลค้างเกินเกณฑ์" };
  if (candleCount < requiredCandles) {
    return { mode: "warming", reason: `กำลังสะสมข้อมูลจริง ${candleCount}/${requiredCandles} แท่ง` };
  }
  return { mode: "live" };
}

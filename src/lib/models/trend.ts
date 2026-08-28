import type { MarketSnapshot, ModelVote } from "../types";
import { fmtPrice } from "../format";
import { assessReversalRisk } from "../reversal-risk";

/** MODEL 1 — Trend: market direction and structure. */
export function trendModel(s: MarketSnapshot): ModelVote {
  const factors: string[] = [];
  const risks: string[] = [];

  const stacked = s.ema20 > s.ema50 && s.ema50 > s.ema200;
  const stackedDown = s.ema20 < s.ema50 && s.ema50 < s.ema200;

  if (stacked) factors.push("EMA 20 > 50 > 200 เรียงตัวแบบขาขึ้น");
  if (stackedDown) factors.push("EMA 20 < 50 < 200 เรียงตัวแบบขาลง");
  if (s.higherHighs)
    factors.push("ทำจุดสูงสุดและจุดต่ำสุดสูงขึ้นต่อเนื่อง (Higher High / Higher Low)");
  if (s.lowerLows) factors.push("ทำจุดสูงสุดและจุดต่ำสุดต่ำลงต่อเนื่อง (Lower High / Lower Low)");
  factors.push(`ความชัน EMA20 ล่าสุด ${s.ema20Slope >= 0 ? "+" : ""}${s.ema20Slope.toFixed(2)}`);
  factors.push(`ราคาอยู่${s.price > s.ema200 ? "เหนือ" : "ใต้"} EMA200 (${fmtPrice(s.ema200)})`);

  const score = s.trendScore;
  const strength = Math.abs(score);
  let direction: ModelVote["direction"] = "WAIT";
  if (score > 0.3) direction = "BUY";
  else if (score < -0.3) direction = "SELL";

  let confidence = Math.round(45 + strength * 42);
  const reversal = assessReversalRisk(s);
  const opposingRisk =
    direction === "BUY" ? reversal.bearish : direction === "SELL" ? reversal.bullish : 0;
  if (opposingRisk >= 0.3) {
    confidence -= Math.round(5 + opposingRisk * 12);
    const signals = direction === "BUY" ? reversal.bearishSignals : reversal.bullishSignals;
    risks.push(`เทรนด์ยังชัด แต่มีความเสี่ยงกลับตัวระยะสั้น: ${signals.slice(0, 2).join(" / ")}`);
  }
  if (s.regime === "ranging") {
    confidence -= 10;
    risks.push("ตลาดออกข้าง เทรนด์ยังไม่ชัด");
  }
  if (s.regime === "volatile") {
    confidence -= 6;
    risks.push("ความผันผวนสูงกว่าปกติ ทิศทางอาจสวิงแรง");
  }
  if (!stacked && !stackedDown) risks.push("เส้น EMA ยังไม่เรียงตัวไปทางเดียวกัน");
  if (direction === "WAIT") risks.push("คะแนนเทรนด์อยู่ในโซนกลาง ยังไม่ให้สัญญาณ");

  confidence = Math.max(20, Math.min(88, confidence));

  const instrument = s.symbol === "GC=F" ? "Gold Futures GC=F" : s.symbol;
  const summary =
    direction === "BUY"
      ? `${instrument} ยังอยู่ในโครงสร้างขาขึ้น ราคายืนเหนือเส้นค่าเฉลี่ยหลัก`
      : direction === "SELL"
        ? "โครงสร้างราคาเป็นขาลง ราคาอยู่ใต้เส้นค่าเฉลี่ยหลัก"
        : "โครงสร้างราคายังไม่มีทิศทางชัดเจน เป็นการแกว่งในกรอบ";

  return {
    id: "trend",
    name: "เทรนด์",
    direction,
    confidence,
    summary,
    factors,
    risks,
    unavailable: false,
  };
}

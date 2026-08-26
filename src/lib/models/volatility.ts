import type { MarketSnapshot, ModelVote } from "../types";
import { stdev } from "../indicators";

/**
 * MODEL 5 (voting) — Volatility / statistical.
 * Looks at the statistical position of price rather than chart patterns:
 * z-score vs the 50-candle mean, volatility expansion/contraction, and the
 * sign balance of recent returns.
 */
export function volatilityModel(s: MarketSnapshot): ModelVote {
  const factors: string[] = [];
  const risks: string[] = [];

  const closes = s.candles.map((c) => c.c);
  const rets: number[] = [];
  for (let i = closes.length - 30; i < closes.length; i++) {
    if (i <= 0) continue;
    rets.push(closes[i]! - closes[i - 1]!);
  }
  const up = rets.filter((r) => r > 0).length;
  const down = rets.filter((r) => r < 0).length;
  const retMean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const retSd = stdev(rets) || 1;
  const driftT = retMean / (retSd / Math.sqrt(rets.length || 1)); // t-stat ของ drift

  factors.push(`Z-Score ของราคาเทียบค่าเฉลี่ย 50 แท่ง = ${s.zScore.toFixed(2)}`);
  factors.push(`ผลตอบแทน 30 แท่ง: บวก ${up} / ลบ ${down}`);
  factors.push(`ค่าสถิติ drift (t) = ${driftT.toFixed(2)}`);
  factors.push(`ATR ปัจจุบันเทียบค่าเฉลี่ย = ${s.atrRatio.toFixed(2)} เท่า`);

  // Statistical drift favours continuation; an extreme z-score favours reversion.
  let score = Math.max(-1, Math.min(1, driftT / 2.2)) * 0.6;
  const extreme = Math.abs(s.zScore) > 1.8;
  if (extreme) {
    score += s.zScore > 0 ? -0.45 : 0.45;
    risks.push("ราคายืดตัวจากค่าเฉลี่ยมาก เสี่ยงย้อนกลับเข้าหาค่าเฉลี่ย");
    factors.push("ราคายืดตัวออกจากค่าเฉลี่ยเกิน 1.8 เท่าของส่วนเบี่ยงเบน");
  }
  if (s.atrRatio < 0.75) {
    factors.push("ความผันผวนหดตัว มักตามด้วยการขยายตัวของช่วงราคา");
    score *= 0.8;
    risks.push("ความผันผวนต่ำ ระยะทางที่คาดหวังใน 5 แท่งจึงจำกัด");
  }
  if (s.atrRatio > 1.6) {
    risks.push("ความผันผวนสูงกว่าปกติมาก ค่าพยากรณ์มีช่วงคลาดเคลื่อนกว้าง");
    score *= 0.85;
  }

  let direction: ModelVote["direction"] = "WAIT";
  if (score > 0.25) direction = "BUY";
  else if (score < -0.25) direction = "SELL";

  let confidence = Math.round(40 + Math.min(1, Math.abs(score)) * 42);
  if (s.atrRatio > 1.6) confidence -= 6;
  if (direction === "WAIT") risks.push("ค่าสถิติยังไม่มีนัยสำคัญพอจะระบุทิศทาง");
  confidence = Math.max(20, Math.min(82, confidence));

  const summary = extreme
    ? s.zScore > 0
      ? "ราคาสูงกว่าค่าเฉลี่ยมากผิดปกติ สถิติเอียงไปทางย่อตัวเข้าหาค่าเฉลี่ย"
      : "ราคาต่ำกว่าค่าเฉลี่ยมากผิดปกติ สถิติเอียงไปทางเด้งกลับ"
    : direction === "BUY"
      ? "ค่าสถิติของผลตอบแทนล่าสุดเอียงไปทางขึ้นอย่างมีนัยเล็กน้อย"
      : direction === "SELL"
        ? "ค่าสถิติของผลตอบแทนล่าสุดเอียงไปทางลง"
        : "การกระจายของผลตอบแทนล่าสุดค่อนข้างสมมาตร ยังไม่มีทิศทางทางสถิติ";

  return {
    id: "volatility",
    name: "ความผันผวน & สถิติ",
    direction,
    confidence,
    summary,
    factors,
    risks,
    unavailable: false,
  };
}

import { fmtPrice } from "../format";
import { assessReversalRisk } from "../reversal-risk";
import type { MarketSnapshot, ModelVote } from "../types";

/** MODEL 3 — Technical / price structure: behaviour around key levels. */
export function technicalModel(s: MarketSnapshot): ModelVote {
  const factors: string[] = [];
  const risks: string[] = [];

  const toRes = s.resistance - s.price;
  const toSup = s.price - s.support;
  const atr = s.atr14 || 1;
  const resAtr = toRes / atr;
  const supAtr = toSup / atr;
  const range = s.resistance - s.support;
  const posInRange = range > 0 ? (s.price - s.support) / range : 0.5;

  factors.push(`แนวต้านใกล้สุด ${fmtPrice(s.resistance)} (ห่าง ${resAtr.toFixed(1)} ATR)`);
  factors.push(`แนวรับใกล้สุด ${fmtPrice(s.support)} (ห่าง ${supAtr.toFixed(1)} ATR)`);
  factors.push(`ตำแหน่งราคาในกรอบ ${Math.round(posInRange * 100)}% จากแนวรับ`);

  const compressed = range / atr < 4;
  const reversal = assessReversalRisk(s);
  if (compressed) factors.push("กรอบราคาแคบลง (compression) มักนำไปสู่การเบรกเอาต์");

  const brokeUp = s.price > s.swingHigh - atr * 0.15 && s.trendScore > 0;
  const brokeDown = s.price < s.swingLow + atr * 0.15 && s.trendScore < 0;
  if (brokeUp) factors.push("ราคาเบรกโซนสูงสุดของกรอบล่าสุดขึ้นไป");
  if (brokeDown) factors.push("ราคาหลุดโซนต่ำสุดของกรอบล่าสุดลงมา");

  let score = 0;
  // Mean-reversion inside a range, continuation on a genuine break.
  if (reversal.resistanceProximity > 0) {
    score -= reversal.resistanceProximity * 0.55;
    risks.push("ราคาชนแนวต้าน เสี่ยงถูกขายกลับระยะสั้น");
  }
  if (reversal.supportProximity > 0) {
    score += reversal.supportProximity * 0.55;
    risks.push("ราคาใกล้แนวรับ เสี่ยงเด้งกลับสวนทาง");
  }
  if (brokeUp) score += 0.5;
  if (brokeDown) score -= 0.5;
  score += (posInRange - 0.5) * -0.5; // ยิ่งใกล้เพดานกรอบยิ่งเอียงลง
  score += s.trendScore * 0.35;

  let direction: ModelVote["direction"] = "WAIT";
  if (score > 0.25) direction = "BUY";
  else if (score < -0.25) direction = "SELL";

  let confidence = Math.round(42 + Math.min(1, Math.abs(score)) * 40);
  if (compressed) {
    confidence -= 8;
    risks.push("กรอบแคบ ทิศทางหลังเบรกยังคาดเดายาก");
  }
  if (direction === "WAIT") risks.push("ราคาอยู่กลางกรอบ ไม่มีระดับสำคัญที่ให้เปรียบฝ่ายใด");
  confidence = Math.max(20, Math.min(84, confidence));

  const summary =
    direction === "SELL"
      ? "ราคาเข้าใกล้โซนแนวต้านสำคัญ ความเสี่ยงถูกปฏิเสธในระยะสั้นเพิ่มขึ้น"
      : direction === "BUY"
        ? brokeUp
          ? "ราคาเบรกกรอบด้านบนและยังยืนอยู่เหนือโซนเดิมได้"
          : "ราคายืนอยู่เหนือแนวรับที่ยังทำงานอยู่"
        : "ราคาอยู่กลางกรอบระหว่างแนวรับและแนวต้าน";

  return {
    id: "technical",
    name: "โครงสร้างราคา",
    direction,
    confidence,
    summary,
    factors,
    risks,
    unavailable: false,
  };
}

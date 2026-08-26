import { eurBiasLabel, goldBiasLabel, regimeLabel } from "../format";
import type { EnsembleResult, MarketSnapshot, ModelVote, NewsSnapshot, Regime } from "../types";

/**
 * Meta-analysis layer ("หัวหน้าทีม").
 * It reads the five voting models plus raw market/volatility context and gives
 * its own independent read — but it has NO vote and can never override the
 * Final Signal produced by src/lib/consensus.
 */
const REGIME_WEIGHTS: Record<Regime, Record<ModelVote["id"], number>> = {
  trending_up: { trend: 1.3, momentum: 1.1, technical: 0.85, news: 1.0, volatility: 0.8 },
  trending_down: { trend: 1.3, momentum: 1.1, technical: 0.85, news: 1.0, volatility: 0.8 },
  ranging: { trend: 0.7, momentum: 0.85, technical: 1.35, news: 1.0, volatility: 1.15 },
  volatile: { trend: 0.85, momentum: 0.9, technical: 0.95, news: 1.3, volatility: 1.2 },
};

export function runEnsemble(
  s: MarketSnapshot,
  n: NewsSnapshot,
  models: ModelVote[],
): EnsembleResult {
  const weights = REGIME_WEIGHTS[s.regime];
  let net = 0;
  let weightSum = 0;

  for (const m of models) {
    if (m.unavailable) continue;
    const w = weights[m.id];
    const sign = m.direction === "BUY" ? 1 : m.direction === "SELL" ? -1 : 0;
    net += sign * (m.confidence / 100) * w;
    weightSum += w;
  }
  // Volatility context: high volatility shrinks the ensemble's conviction.
  const volDamp = s.atrRatio > 1.6 ? 0.8 : s.atrRatio < 0.75 ? 0.9 : 1;
  const normalized = weightSum > 0 ? (net / weightSum) * volDamp : 0;

  const direction: EnsembleResult["direction"] =
    normalized > 0.18 ? "BUY" : normalized < -0.18 ? "SELL" : "WAIT";

  const spread = (() => {
    const active = models.filter((m) => !m.unavailable);
    const buys = active.filter((m) => m.direction === "BUY").length;
    const sells = active.filter((m) => m.direction === "SELL").length;
    return Math.min(buys, sells);
  })();

  let confidence = Math.round(42 + Math.min(1, Math.abs(normalized) * 1.8) * 45);
  if (spread >= 2) confidence -= 10;
  if (n.riskLevel === "high") confidence -= 10;
  if (models.some((m) => m.unavailable)) confidence -= 8;
  confidence = Math.max(20, Math.min(88, confidence));

  const bullish: string[] = [];
  const bearish: string[] = [];
  const risks: string[] = [];

  if (s.trendScore > 0.25) bullish.push("โครงสร้างเทรนด์ยังเป็นขาขึ้น");
  if (s.trendScore < -0.25) bearish.push("โครงสร้างเทรนด์ยังเป็นขาลง");
  if (s.momentumScore > 0.2) bullish.push("โมเมนตัมอยู่ฝั่งผู้ซื้อ");
  if (s.momentumScore < -0.2) bearish.push("โมเมนตัมอยู่ฝั่งผู้ขาย");
  if (n.goldBias === "bullish") bullish.push(`ข่าวฝั่งทองคำ${goldBiasLabel.bullish}`);
  if (n.goldBias === "bearish") bearish.push(`ข่าวฝั่งทองคำ${goldBiasLabel.bearish}`);
  if (n.eurBias === "weak") bullish.push(`ยูโร${eurBiasLabel.weak} หนุนราคาทองในสกุลยูโร`);
  if (n.eurBias === "strong") bearish.push(`ยูโร${eurBiasLabel.strong} กดราคาทองในสกุลยูโร`);
  if (s.price < s.resistance && s.resistance - s.price < s.atr14)
    bearish.push("ราคาชิดแนวต้านระยะสั้น");
  if (s.price > s.support && s.price - s.support < s.atr14) bullish.push("ราคายืนใกล้แนวรับ");

  if (spread >= 2) risks.push("โมเดลยังเห็นไม่ตรงกัน");
  if (s.atrRatio > 1.6) risks.push("ความผันผวนสูงกว่าปกติ");
  if (n.riskLevel !== "low") risks.push("มีข่าวสำคัญรออยู่ใกล้ ๆ");
  if (Math.abs(s.zScore) > 1.8) risks.push("ราคายืดจากค่าเฉลี่ยมาก");
  if (!risks.length) risks.push("ยังไม่พบความเสี่ยงเด่นชัดจากข้อมูลที่มี");

  const summary =
    `สภาพตลาดโดยรวมคือ${regimeLabel[s.regime]} ` +
    (direction === "WAIT"
      ? "เมื่อถ่วงน้ำหนักความเห็นของทั้ง 5 โมเดลแล้ว น้ำหนักสองฝั่งใกล้เคียงกันเกินไป"
      : `เมื่อถ่วงน้ำหนักความเห็นของทั้ง 5 โมเดลแล้ว น้ำหนักเอียงไปทางฝั่ง${direction === "BUY" ? "ซื้อ" : "ขาย"}`) +
    " (เป็นความเห็นประกอบ ไม่ใช่สัญญาณสุดท้าย)";

  return { direction, confidence, summary, bullish, bearish, risks };
}

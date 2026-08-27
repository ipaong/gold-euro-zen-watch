import { eurBiasLabel, fmtMinutes, goldBiasLabel } from "../format";
import type { MarketSnapshot, ModelVote, NewsSnapshot } from "../types";

/**
 * MODEL 4 — News & macro. Gold-linked assets are driven by two forces: the gold side
 * (Fed, US rates/inflation, yields, USD, geopolitics) and the EUR side
 * (ECB, eurozone inflation/growth). Never invents headlines.
 */
export function newsModel(s: MarketSnapshot, n: NewsSnapshot): ModelVote {
  const factors: string[] = [];
  const risks: string[] = [];
  const goldOnly = s.symbol === "GC=F";

  if (!n.available) {
    return {
      id: "news",
      name: "ข่าว & มหภาค",
      direction: "WAIT",
      confidence: 20,
      summary: n.live
        ? "ดึงข่าวจริงไม่สำเร็จในช่วงเวลานี้ ระบบจึงไม่ออกความเห็น (ไม่เดาข่าวเอง)"
        : "ไม่มีข้อมูลข่าวในช่วงเวลานี้ จึงไม่ออกความเห็น",
      factors: ["ไม่พบข่าวที่เผยแพร่ก่อนเวลาที่วิเคราะห์"],
      risks: ["ข่าวใช้งานไม่ได้ — ความมั่นใจถูกลดลงโดยอัตโนมัติ"],
      unavailable: true,
    };
  }

  factors.push(`มุมมองทองคำ: ${goldBiasLabel[n.goldBias]}`);
  if (goldOnly) {
    factors.push("GC=F เป็น Gold Futures ที่อ้างอิง USD จึงไม่ใช้ EUR เป็นตัวหารโดยตรง");
  } else {
    factors.push(`มุมมองยูโร: ${eurBiasLabel[n.eurBias]}`);
  }
  factors.push(
    `พาดหัวข่าวที่นำมาใช้ ${n.headlines.length} ข่าว (${n.live ? "ข่าวจริง" : "ข้อมูลเดโม"}) สำหรับ ${s.symbol}`,
  );
  if (n.interpretation) {
    factors.push(
      `AI อ่านข่าวได้: ${n.interpretation.xaueurBias} (มั่นใจ ${n.interpretation.confidence}%)`,
    );
    n.interpretation.keyDrivers.slice(0, 3).forEach((d) => factors.push(d));
  }
  if (n.nextHighImpact && n.minutesToHighImpact !== null) {
    factors.push(
      `ข่าวผลกระทบสูงถัดไป: ${n.nextHighImpact.name} อีก ${fmtMinutes(n.minutesToHighImpact)}`,
    );
  }

  const direction: ModelVote["direction"] = goldOnly
    ? n.goldBias === "bullish"
      ? "BUY"
      : n.goldBias === "bearish"
        ? "SELL"
        : "WAIT"
    : n.netBias;
  let confidence = Math.round(38 + n.netStrength * 45);

  if (n.riskLevel === "high") {
    risks.push("มีข่าวผลกระทบสูงใกล้เกินไป ราคาอาจสวิงแรงโดยไม่สนปัจจัยเทคนิค");
    confidence -= 12;
  } else if (n.riskLevel === "medium") {
    risks.push("มีข่าวสำคัญรออยู่ในอีกไม่นาน");
    confidence -= 5;
  }
  if (n.stale) {
    risks.push("ข่าวล่าสุดเก่ากว่ากรอบเวลาที่ถือว่าสด — ลดความมั่นใจลง");
    confidence -= 15;
  }
  if (n.providerErrors && n.providerErrors.length) {
    risks.push(`แหล่งข่าวบางแหล่งดึงไม่สำเร็จ (${n.providerErrors.length} แหล่ง)`);
    confidence -= 5;
  }
  if (n.live && !n.interpretation) {
    risks.push("AI อ่านข่าวไม่สำเร็จ ระบบใช้การให้น้ำหนักแบบกติกาแทน");
    confidence -= 8;
  }
  n.interpretation?.risks.slice(0, 2).forEach((r) => risks.push(r));
  if (goldOnly ? n.goldBias === "neutral" : n.goldBias === "neutral" && n.eurBias === "neutral") {
    risks.push(
      goldOnly
        ? "ข่าวทองคำยังไม่มีทิศทางมหภาคที่ชัด"
        : "ข่าวทั้งสองฝั่งหักล้างกัน ยังไม่มีทิศทางมหภาคที่ชัด",
    );
  }
  if (direction !== "WAIT" && Math.sign(s.trendScore) !== 0) {
    const agreeWithTrend = (direction === "BUY") === s.trendScore > 0;
    if (!agreeWithTrend) risks.push("มุมมองข่าวสวนทางกับเทรนด์ราคาปัจจุบัน");
  }
  confidence = Math.max(20, Math.min(85, confidence));
  if (direction === "WAIT") confidence = Math.min(confidence, 55);

  const summary = goldOnly
    ? direction === "BUY"
      ? `ข่าวทองคำ${goldBiasLabel[n.goldBias]} ผลรวมเอียงขึ้นต่อ ${s.symbol}`
      : direction === "SELL"
        ? `ข่าวทองคำ${goldBiasLabel[n.goldBias]} ผลรวมเอียงลงต่อ ${s.symbol}`
        : `ข่าวทองคำยังเป็นกลาง ผลรวมต่อ ${s.symbol} เป็นกลาง`
    : direction === "BUY"
      ? `ข่าวหนุนทองคำมากกว่ายูโร (ทอง${goldBiasLabel[n.goldBias]} / ยูโร${eurBiasLabel[n.eurBias]}) ผลรวมเอียงขึ้นต่อ ${s.symbol}`
      : direction === "SELL"
        ? `ข่าวกดทองคำและ/หรือหนุนยูโร ผลรวมเอียงลงต่อ ${s.symbol}`
        : `ข่าวสองฝั่งยังหักล้างกัน ผลรวมต่อ ${s.symbol} เป็นกลาง`;

  return {
    id: "news",
    name: "ข่าว & มหภาค",
    direction,
    confidence,
    summary,
    factors,
    risks,
    unavailable: false,
  };
}

import { fmtPrice, regimeLabel } from "./format";
import type {
  Consensus,
  EnsembleResult,
  MarketSnapshot,
  ModelVote,
  Narrative,
  NewsSnapshot,
  RiskLevel,
  TradePlan,
} from "./types";

/** Reference levels only — Phase 1 gives no trade advice, no lots, no SL/TP orders. */
export function buildPlan(s: MarketSnapshot, c: Consensus, risk: RiskLevel): TradePlan {
  const invalidation =
    c.direction === "BUY"
      ? s.support - s.atr14 * 0.3
      : c.direction === "SELL"
        ? s.resistance + s.atr14 * 0.3
        : s.price;
  return {
    direction: c.direction,
    price: s.price,
    support: s.support,
    resistance: s.resistance,
    invalidation: +invalidation.toFixed(2),
    atr: +s.atr14.toFixed(2),
    risk,
  };
}

export function buildNarrative(
  s: MarketSnapshot,
  n: NewsSnapshot,
  models: ModelVote[],
  ensemble: EnsembleResult,
  c: Consensus,
  plan: TradePlan,
): Narrative {
  const whatsHappening =
    `ราคา ${s.symbol} (${s.timeframe}) อยู่ที่ ${fmtPrice(s.price)} (${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}% จากแท่งก่อน) ` +
    `สภาพตลาดตอนนี้คือ${regimeLabel[s.regime]} ` +
    `Direction Engine V3 อ่าน edge ${c.engine?.score?.toFixed(2) ?? "–"} ` +
    `(โมเดลประกอบ ซื้อ ${c.buyVotes} / ขาย ${c.sellVotes} / รอ ${c.waitVotes}) ` +
    `และสัญญาณสุดท้ายหลังผ่านเกณฑ์คุณภาพคือ "${c.direction === "BUY" ? "ซื้อ" : c.direction === "SELL" ? "ขาย" : "รอ"}"`;

  const why: string[] = [];
  for (const m of models) {
    if (m.unavailable) {
      why.push(`${m.name}: ใช้งานไม่ได้ จึงไม่ถูกนับเป็นเสียงโหวต`);
      continue;
    }
    const dir = m.direction === "BUY" ? "ซื้อ" : m.direction === "SELL" ? "ขาย" : "รอ";
    why.push(`${m.name} (${dir} ${m.confidence}%): ${m.summary}`);
  }
  why.push(`หัวหน้าทีม (Ensemble): ${ensemble.summary}`);
  if (c.engine) why.push(`เครื่องยนต์ทิศทาง: ${c.engine.reasons.join(" / ")}`);
  why.push(`เกณฑ์คุณภาพ: ${c.reason}`);

  const invalidate: string[] = [];
  if (c.direction === "BUY")
    invalidate.push(`ราคาหลุด ${fmtPrice(plan.invalidation)} — สมมติฐานฝั่งขึ้นถือว่าผิด`);
  if (c.direction === "SELL")
    invalidate.push(`ราคายืนเหนือ ${fmtPrice(plan.invalidation)} — สมมติฐานฝั่งลงถือว่าผิด`);
  if (c.direction === "WAIT")
    invalidate.push(
      `ต้องเห็นราคาเบรก ${fmtPrice(s.resistance)} หรือหลุด ${fmtPrice(s.support)} อย่างชัดเจนก่อน จึงจะมีทิศทาง`,
    );
  invalidate.push(`ความผันผวนพุ่งเกิน 2 เท่าของค่าเฉลี่ย (ตอนนี้ ${s.atrRatio.toFixed(2)} เท่า)`);
  if (n.nextHighImpact) invalidate.push(`ผลข่าว ${n.nextHighImpact.name} ออกมาผิดจากที่ตลาดคาด`);
  if (Math.abs(s.zScore) > 1.8)
    invalidate.push("ราคายืดจากค่าเฉลี่ยมากผิดปกติ อาจย้อนกลับเร็วกว่าที่คาด");

  return { whatsHappening, why, invalidate };
}

import { fmtMinutes } from "../format";
import { assessEntryRisk } from "../entry-risk";
import type {
  AppSettings,
  Consensus,
  Direction,
  GateCheck,
  MarketSnapshot,
  ModelVote,
  NewsSnapshot,
} from "../types";

/**
 * QUALITY GATE — the single source of the Final Signal.
 *
 * Votes come only from the 5 voting models. The Ensemble is deliberately not
 * an input here: it can neither create nor override the Final Signal.
 */
export function buildConsensus(
  s: MarketSnapshot,
  n: NewsSnapshot,
  models: ModelVote[],
  settings: AppSettings,
  forecastQuality: number,
): Consensus {
  const active = models.filter((m) => !m.unavailable);
  const buyVotes = active.filter((m) => m.direction === "BUY").length;
  const sellVotes = active.filter((m) => m.direction === "SELL").length;
  const waitVotes = active.filter((m) => m.direction === "WAIT").length;

  let rawDirection: Direction = "WAIT";
  if (buyVotes > sellVotes && buyVotes >= waitVotes) rawDirection = "BUY";
  else if (sellVotes > buyVotes && sellVotes >= waitVotes) rawDirection = "SELL";

  const agree = rawDirection === "BUY" ? buyVotes : rawDirection === "SELL" ? sellVotes : waitVotes;
  const agreeing = active.filter((m) => m.direction === rawDirection);
  const avgConf = agreeing.length
    ? Math.round(agreeing.reduce((a, m) => a + m.confidence, 0) / agreeing.length)
    : 0;

  const agreementRatio = active.length ? agree / active.length : 0;
  const hasIndependentConfirmation =
    rawDirection !== "WAIT" &&
    agreeing.some((model) => model.id === "technical" || model.id === "news");
  let confidence = Math.round(
    avgConf * (0.6 + agreementRatio * 0.4) * (0.85 + forecastQuality * 0.15),
  );
  if (active.length < models.length) confidence -= 8;
  if (n.riskLevel === "high") confidence -= 10;
  confidence = Math.max(0, Math.min(95, confidence));

  const checks: GateCheck[] = [];

  checks.push({
    id: "agreement",
    label: `โมเดลเห็นตรงกันอย่างน้อย ${settings.minAgreement} จาก 5`,
    pass: rawDirection !== "WAIT" && agree >= settings.minAgreement && hasIndependentConfirmation,
    detail:
      rawDirection === "WAIT"
        ? `เสียงส่วนใหญ่คือ "รอ" (ซื้อ ${buyVotes} / ขาย ${sellVotes} / รอ ${waitVotes})`
        : agree >= settings.minAgreement && !hasIndependentConfirmation
          ? `เห็นตรงกัน ${agree} เสียง แต่ทั้งหมดมาจากกลุ่มราคาที่สัมพันธ์กัน จึงรอ Technical หรือ News ยืนยัน`
          : `เห็นตรงกัน ${agree} จาก ${active.length} โมเดลที่ใช้งานได้`,
  });

  checks.push({
    id: "confidence",
    label: `ความมั่นใจรวม ≥ ${settings.confidenceThreshold}%`,
    pass: confidence >= settings.confidenceThreshold,
    detail: `ความมั่นใจรวมคำนวณได้ ${confidence}%`,
  });

  const conflict = Math.min(buyVotes, sellVotes) >= 2;
  checks.push({
    id: "conflict",
    label: "ไม่มีความขัดแย้งรุนแรงระหว่างโมเดล",
    pass: !conflict,
    detail: conflict
      ? `มีโมเดลเชียร์คนละทางอย่างละ ${Math.min(buyVotes, sellVotes)} เสียง`
      : "ไม่มีสองฝ่ายที่ขัดแย้งกันตั้งแต่ 2 เสียงขึ้นไป",
  });

  const newsTooClose =
    n.minutesToHighImpact !== null && n.minutesToHighImpact <= settings.newsAvoidMinutes;
  checks.push({
    id: "news",
    label: `ไม่มีข่าวผลกระทบสูงภายใน ${settings.newsAvoidMinutes} นาที`,
    pass: !newsTooClose,
    detail: newsTooClose
      ? `${n.nextHighImpact?.name ?? "ข่าวสำคัญ"} จะประกาศในอีก ${fmtMinutes(n.minutesToHighImpact!)}`
      : n.minutesToHighImpact !== null
        ? `ข่าวสำคัญถัดไปอีก ${fmtMinutes(n.minutesToHighImpact)}`
        : "ไม่มีข่าวผลกระทบสูงรออยู่ในข้อมูลเดโม",
  });

  const volOk = s.atrRatio <= 2;
  checks.push({
    id: "volatility",
    label: "ความผันผวนไม่สูงผิดปกติ",
    pass: volOk,
    detail: `ATR ปัจจุบัน ${s.atrRatio.toFixed(2)} เท่าของค่าเฉลี่ย`,
  });

  const entryRisk = assessEntryRisk(s, rawDirection);
  checks.push({
    id: "entry_context",
    label: "ราคาและโมเมนตัมระยะสั้นไม่สวนสัญญาณแรง",
    pass: !entryRisk.blocked,
    detail: entryRisk.blocked
      ? `ระงับการไล่ราคา: ${entryRisk.reasons.join(" / ")}`
      : rawDirection === "WAIT"
        ? "ยังไม่มีทิศเสียงข้างมากให้ตรวจจังหวะเข้า"
        : `บริบทก่อนจุดทำนายยังไม่พบความเสี่ยงสวนทางรุนแรง (3 แท่ง ${entryRisk.recentMoveAtr.toFixed(2)} ATR)`,
  });

  const failed = checks.filter((c) => !c.pass);
  const blocked = failed.length > 0;
  const direction: Direction = blocked ? "WAIT" : rawDirection;

  const reason = blocked
    ? `สัญญาณสุดท้ายเป็น "รอ" เพราะไม่ผ่านเกณฑ์: ${failed.map((f) => f.label).join(" / ")}`
    : `ผ่านเกณฑ์คุณภาพทุกข้อ จึงยืนยันสัญญาณ ${direction === "BUY" ? "ซื้อ" : "ขาย"}`;

  return {
    direction,
    rawDirection,
    agree,
    total: active.length,
    confidence,
    buyVotes,
    sellVotes,
    waitVotes,
    checks,
    blocked,
    reason,
  };
}

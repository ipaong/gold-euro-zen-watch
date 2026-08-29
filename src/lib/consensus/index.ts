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

  // Confidence-weighted voting avoids letting several weak/uncertain votes
  // overpower a smaller number of strong, independently supported votes.
  const buyStrength = active
    .filter((m) => m.direction === "BUY")
    .reduce((sum, m) => sum + m.confidence / 100, 0);
  const sellStrength = active
    .filter((m) => m.direction === "SELL")
    .reduce((sum, m) => sum + m.confidence / 100, 0);
  const strengthGap = buyStrength - sellStrength;

  let rawDirection: Direction = "WAIT";
  if (buyVotes >= 2 && strengthGap >= 0.2) rawDirection = "BUY";
  else if (sellVotes >= 2 && strengthGap <= -0.2) rawDirection = "SELL";

  const agree = rawDirection === "BUY" ? buyVotes : rawDirection === "SELL" ? sellVotes : waitVotes;
  const agreeing = active.filter((m) => m.direction === rawDirection);
  const avgConf = agreeing.length
    ? Math.round(agreeing.reduce((a, m) => a + m.confidence, 0) / agreeing.length)
    : 0;

  const agreementRatio = active.length ? agree / active.length : 0;
  const directionalStrength = rawDirection === "BUY" ? buyStrength : rawDirection === "SELL" ? sellStrength : 0;
  const leadMargin = rawDirection === "BUY"
    ? buyVotes - Math.max(sellVotes, waitVotes)
    : rawDirection === "SELL"
      ? sellVotes - Math.max(buyVotes, waitVotes)
      : 0;
  const hasIndependentConfirmation =
    rawDirection !== "WAIT" &&
    agreeing.some((model) => model.id === "technical" || model.id === "news");
  // Calibrate confidence as a readable 0–95 score. The previous formula
  // multiplied average model confidence by two dampers, making an otherwise
  // valid 3/5 setup almost impossible to pass the default 60% threshold.
  // Agreement is rewarded explicitly, while forecast quality remains a small
  // adjustment rather than a second hard penalty.
  let confidence = Math.round(
    avgConf * 0.8 + agreementRatio * 30 + Math.min(8, directionalStrength * 4) +
      Math.max(0, leadMargin) * 2 + (forecastQuality - 0.5) * 5,
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
  // Fun/experimental mode: keep a directional call when there is a clear
  // plurality, instead of converting every imperfect setup into WAIT. The
  // failed checks remain visible as warnings; no future candle is consulted.
  const boldAgreement = Math.max(2, settings.minAgreement - 1);
  const boldConfidence = Math.max(45, settings.confidenceThreshold - 15);
  const boldCall =
    rawDirection !== "WAIT" &&
    agree >= boldAgreement &&
    confidence >= boldConfidence &&
    (agree >= 3 ||
      leadMargin >= 2 ||
      (agree === 2 && directionalStrength >= 1.7 && strengthGap >= 0.3 && confidence >= 70));
  const blocked = !boldCall;
  const direction: Direction = boldCall ? rawDirection : "WAIT";

  const reason = blocked
    ? `หมอดูยังไม่กล้าฟันธง เพราะเสียงยังไม่ชัดพอ: ${failed.map((f) => f.label).join(" / ") || "ต้องมีเสียงนำอย่างน้อย 2 เสียง"}`
    : failed.length
      ? `โหมดหมอดูสายกล้าฟันธง ${direction === "BUY" ? "ซื้อ" : "ขาย"} แม้มีคำเตือน: ${failed.map((f) => f.label).join(" / ")}`
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

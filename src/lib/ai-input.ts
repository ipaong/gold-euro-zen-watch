import type { AnalystInput } from "./ai.functions";
import type { AiExplanation, AnalysisResult } from "./types";

/** Flattens the engine output into the small structured payload the AI reads. */
export function buildAnalystInput(r: AnalysisResult): AnalystInput {
  return {
    direction: r.consensus.direction,
    rawDirection: r.consensus.rawDirection,
    confidence: r.consensus.confidence,
    agree: r.consensus.agree,
    total: r.consensus.total,
    blocked: r.consensus.blocked,
    reason: r.consensus.reason,
    price: r.snapshot.price,
    regime: r.snapshot.regime,
    atr: r.snapshot.atr14,
    support: r.plan.support,
    resistance: r.plan.resistance,
    ensembleDirection: r.ensemble.direction,
    ensembleConfidence: r.ensemble.confidence,
    ensembleSummary: r.ensemble.summary,
    newsRisk: r.news.riskLevel,
    goldBias: r.news.goldBias,
    eurBias: r.news.eurBias,
    minutesToHighImpact: r.news.minutesToHighImpact,
    nextHighImpact: r.news.nextHighImpact?.name ?? null,
    models: r.models.map((m) => ({
      name: m.name,
      direction: m.direction,
      confidence: m.confidence,
      summary: m.summary,
    })),
    failedChecks: r.consensus.checks
      .filter((c) => !c.pass)
      .map((c) => ({ label: c.label, detail: c.detail })),
    passedChecks: r.consensus.checks.filter((c) => c.pass).map((c) => c.label),
  };
}

/** Deterministic fallback used whenever the AI call fails. */
export function templateExplanation(r: AnalysisResult): AiExplanation {
  const failed = r.consensus.checks.filter((c) => !c.pass);
  return {
    signal: `${r.narrative.whatsHappening} เสียงโหวตตอนนี้: ซื้อ ${r.consensus.buyVotes} · ขาย ${r.consensus.sellVotes} · รอ ${r.consensus.waitVotes} ความมั่นใจรวม ${r.consensus.confidence}%`,
    news: r.news.available
      ? `ความเสี่ยงข่าวระดับ${r.news.riskLevel === "high" ? "สูง" : r.news.riskLevel === "medium" ? "กลาง" : "ต่ำ"}${
          r.news.nextHighImpact ? ` ข่าวแรงถัดไปคือ ${r.news.nextHighImpact.name}` : ""
        }`
      : "ช่วงเวลานี้ไม่มีข้อมูลข่าว ระบบจึงลดน้ำหนักของโมเดลข่าวลงและไม่เดาข่าวเอง",
    gate: failed.length
      ? `ยังติดเกณฑ์คุณภาพ ${failed.length} ข้อ: ${failed.map((c) => c.label).join(" · ")}`
      : "ผ่านเกณฑ์คุณภาพครบทุกข้อ สัญญาณจึงถูกปล่อยออกมา",
    source: "template",
    generatedAt: Date.now(),
  };
}

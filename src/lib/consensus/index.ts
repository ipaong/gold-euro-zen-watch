import { runDirectionEngine, type DirectionEngineDecision } from "../direction-engine";
import { assessEntryRisk } from "../entry-risk";
import { fmtMinutes } from "../format";
import { calibrationMultiplier, type LearningCalibration } from "../learning-calibration";
import type {
  AppSettings,
  Consensus,
  GateCheck,
  MarketSnapshot,
  ModelVote,
  NewsSnapshot,
} from "../types";

/**
 * Direction Engine V2 quality gate.
 *
 * The five model cards remain useful supporting opinions and keep their own
 * score history, but correlated votes no longer decide the five-candle call.
 * The primary direction comes from orthogonal tape horizons, fast EMA context,
 * momentum and confirmed reversal routing. No future candle is consulted.
 */
export function buildConsensus(
  snapshot: MarketSnapshot,
  news: NewsSnapshot,
  models: ModelVote[],
  settings: AppSettings,
  forecastQuality: number,
  learning?: LearningCalibration,
  suppliedDecision?: DirectionEngineDecision,
): Consensus {
  const active = models.filter((model) => !model.unavailable);
  const buyVotes = active.filter((model) => model.direction === "BUY").length;
  const sellVotes = active.filter((model) => model.direction === "SELL").length;
  const waitVotes = active.filter((model) => model.direction === "WAIT").length;

  const engine = suppliedDecision ?? runDirectionEngine(snapshot, news);
  const rawDirection = engine.direction;
  const agree =
    rawDirection === "WAIT"
      ? waitVotes
      : active.filter((model) => model.direction === rawDirection).length;

  // Historical model skill may nudge confidence a few points, but it cannot
  // flip the price engine or make correlated votes overpower visible tape.
  const alignedWeights =
    rawDirection === "WAIT"
      ? []
      : active
          .filter((model) => model.direction === rawDirection)
          .map((model) => calibrationMultiplier(learning, model.id));
  const historicalNudge = alignedWeights.length
    ? (alignedWeights.reduce((sum, weight) => sum + weight, 0) / alignedWeights.length - 1) * 12
    : 0;
  let confidence = Math.round(engine.confidence + historicalNudge + (forecastQuality - 0.5) * 3);
  if (active.length < models.length) confidence -= 4;
  confidence = Math.max(0, Math.min(95, confidence));

  const requiredEvidence = Math.max(2, Math.min(4, settings.minAgreement - 1));
  const entryRisk = assessEntryRisk(snapshot, rawDirection);
  const hardOpposition =
    engine.severeOpposition || (entryRisk.blocked && !engine.reversalConfirmed);
  const checks: GateCheck[] = [];

  checks.push({
    id: "agreement",
    label: `หลักฐานทิศทางอิสระอย่างน้อย ${requiredEvidence} ชุด`,
    pass: rawDirection !== "WAIT" && engine.alignedEvidence >= requiredEvidence,
    detail:
      rawDirection === "WAIT"
        ? engine.reasons.join(" / ")
        : `ตรงทิศ ${engine.alignedEvidence} ชุด · ระยะ 1/3/5/12 แท่ง = ${engine.movesAtr.one}/${engine.movesAtr.three}/${engine.movesAtr.five}/${engine.movesAtr.twelve} ATR`,
  });

  checks.push({
    id: "confidence",
    label: `ความมั่นใจรวม ≥ ${settings.confidenceThreshold}%`,
    pass: confidence >= settings.confidenceThreshold,
    detail: `Direction Engine V2 คำนวณได้ ${confidence}% (edge ${engine.score >= 0 ? "+" : ""}${engine.score.toFixed(2)})`,
  });

  const modelConflict = Math.min(buyVotes, sellVotes) >= 2;
  checks.push({
    id: "model_context",
    label: "ความเห็นประกอบไม่ขัดแย้งกันรุนแรง",
    pass: !modelConflict,
    detail: modelConflict
      ? `โมเดลประกอบแบ่งฝั่ง ซื้อ ${buyVotes} / ขาย ${sellVotes} / รอ ${waitVotes} — ลดความเชื่อมั่นแต่ไม่พลิกทิศราคา`
      : `โมเดลประกอบ ซื้อ ${buyVotes} / ขาย ${sellVotes} / รอ ${waitVotes}`,
  });

  const newsTooClose =
    news.minutesToHighImpact !== null && news.minutesToHighImpact <= settings.newsAvoidMinutes;
  checks.push({
    id: "news",
    label: `ไม่มีข่าวผลกระทบสูงภายใน ${settings.newsAvoidMinutes} นาที`,
    pass: !newsTooClose,
    detail: newsTooClose
      ? `${news.nextHighImpact?.name ?? "ข่าวสำคัญ"} จะประกาศในอีก ${fmtMinutes(news.minutesToHighImpact!)}`
      : news.minutesToHighImpact !== null
        ? `ข่าวสำคัญถัดไปอีก ${fmtMinutes(news.minutesToHighImpact)}`
        : "ไม่พบข่าวผลกระทบสูงที่ใกล้เกินไป",
  });

  checks.push({
    id: "volatility",
    label: "ความผันผวนไม่สูงผิดปกติ",
    pass: snapshot.atrRatio <= 2,
    detail: `ATR ปัจจุบัน ${snapshot.atrRatio.toFixed(2)} เท่าของค่าเฉลี่ย`,
  });

  checks.push({
    id: "entry_context",
    label: "สัญญาณไม่สวนแรงราคาหลายช่วงพร้อมกัน",
    pass: !hardOpposition,
    detail: hardOpposition
      ? engine.severeOpposition
        ? "Anti-opposite guard ระงับสัญญาณที่สวนทั้งแรงราคาเร็วและทิศ 5–12 แท่ง"
        : `ระงับสัญญาณ: ${entryRisk.reasons.join(" / ")}`
      : engine.reversalConfirmed
        ? `ยอมให้สัญญาณกลับตัว เพราะโครงสร้างและโมเมนตัมยืนยัน ${engine.reversalDirection}`
        : "ไม่พบแรงราคาหลักที่สวนคำทายอย่างรุนแรง",
  });

  const boldConfidence = Math.max(45, settings.confidenceThreshold - 15);
  const hasDirectionalEdge =
    rawDirection !== "WAIT" &&
    engine.alignedEvidence >= requiredEvidence &&
    confidence >= boldConfidence;
  const blocked = !hasDirectionalEdge || hardOpposition;
  const direction = blocked ? "WAIT" : rawDirection;
  const failed = checks.filter((check) => !check.pass);

  const reason = blocked
    ? rawDirection === "WAIT"
      ? `Direction Engine V2 ยังไม่พบ edge ชัด: ${engine.reasons.join(" / ")}`
      : `งดฟันธง ${rawDirection === "BUY" ? "ขึ้น" : "ลง"}: ${hardOpposition ? checks.find((check) => check.id === "entry_context")?.detail : "หลักฐานหรือความมั่นใจยังไม่ถึงเกณฑ์ทดลอง"}`
    : failed.length
      ? `ฟันธง ${direction === "BUY" ? "ขึ้น" : "ลง"} ตามแรงราคา ${engine.alignedEvidence} ชุด โดยถือ ${failed.map((check) => check.label).join(" / ")} เป็นคำเตือน`
      : `ฟันธง ${direction === "BUY" ? "ขึ้น" : "ลง"}: แรงราคา เทรนด์เร็ว และโมเมนตัมผ่านครบ`;

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
    engine: {
      version: engine.version,
      score: engine.score,
      continuationScore: engine.continuationScore,
      shortTapeScore: engine.shortTapeScore,
      swingTapeScore: engine.swingTapeScore,
      movesAtr: engine.movesAtr,
      alignedEvidence: engine.alignedEvidence,
      reversalConfirmed: engine.reversalConfirmed,
      reversalDirection: engine.reversalDirection,
      severeOpposition: engine.severeOpposition,
      tapeDirection: engine.tapeDirection,
      patternAligned: engine.patternAligned,
      multiHorizonAligned: engine.multiHorizonAligned,
      exhaustionVeto: engine.exhaustionVeto,
      historicalPattern: engine.pattern,
      reasons: engine.reasons,
    },
    ...(learning
      ? {
          learning: {
            sampleCount: learning.sampleCount,
            calibrated: learning.calibrated,
            modelWeights: Object.fromEntries(
              Object.entries(learning.model).map(([id, entry]) => [id, entry?.multiplier ?? 1]),
            ),
          },
        }
      : {}),
  };
}

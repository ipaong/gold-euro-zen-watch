import type { Consensus, Direction, NewsSnapshot } from "./types";

export type AlertKind =
  | "signal_changed"
  | "high_impact_news"
  | "forecast_ready"
  | "settlement_ready"
  | "settlement_completed";

export interface AppAlert {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  tone: "neutral" | "warning" | "positive";
  createdAt: number;
}

export interface AlertContext {
  previousDirection?: Direction;
  consensus: Consensus;
  news: NewsSnapshot;
  forecastLocked: boolean;
  settlementReady?: boolean;
  settlementCompleted?: boolean;
  now?: number;
  newsAvoidMinutes: number;
}

/**
 * Deterministic, in-app-only alerts. No alert is phrased as a trading command
 * or urgency cue, and external channels remain outside this implementation.
 */
export function buildAlerts(context: AlertContext): AppAlert[] {
  const now = context.now ?? Date.now();
  const alerts: AppAlert[] = [];
  const direction = context.consensus.direction;

  if (context.previousDirection && context.previousDirection !== direction) {
    alerts.push({
      id: `signal:${context.previousDirection}:${direction}`,
      kind: "signal_changed",
      title: "มุมมองของระบบเปลี่ยน",
      body: `${context.previousDirection} → ${direction} ตามผล Quality Gate ล่าสุด`,
      tone: direction === "WAIT" ? "warning" : "neutral",
      createdAt: now,
    });
  }

  if (
    context.news.minutesToHighImpact !== null &&
    context.news.minutesToHighImpact >= 0 &&
    context.news.minutesToHighImpact <= context.newsAvoidMinutes
  ) {
    alerts.push({
      id: `news:${context.news.nextHighImpact?.id ?? context.news.minutesToHighImpact}`,
      kind: "high_impact_news",
      title: "มีข่าวผลกระทบสูงใกล้เวลา",
      body: `${context.news.nextHighImpact?.name ?? "เหตุการณ์เศรษฐกิจ"} ในอีกประมาณ ${context.news.minutesToHighImpact} นาที ควรอ่านความเสี่ยงประกอบ ไม่ใช่คำสั่งให้รีบทำรายการ`,
      tone: "warning",
      createdAt: now,
    });
  }

  if (context.forecastLocked) {
    alerts.push({
      id: "forecast:locked",
      kind: "forecast_ready",
      title: "คำพยากรณ์ถูกล็อกแล้ว",
      body: "มี snapshot สำหรับรอเปิดผลจริงเมื่อแท่งถัดไปครบตาม horizon",
      tone: "positive",
      createdAt: now,
    });
  }

  if (context.settlementReady) {
    alerts.push({
      id: "settlement:ready",
      kind: "settlement_ready",
      title: "พร้อมเปิดผลจริง",
      body: "ข้อมูลแท่งจริงครบตาม horizon แล้ว ตรวจผลเทียบได้โดยไม่แก้ snapshot เดิม",
      tone: "positive",
      createdAt: now,
    });
  }

  if (context.settlementCompleted) {
    alerts.push({
      id: "settlement:completed",
      kind: "settlement_completed",
      title: "เปิดผลและบันทึกคะแนนแล้ว",
      body: "ผล settlement ถูกแยกเก็บจาก prediction และไม่ควรถูกแก้ย้อนหลัง",
      tone: "positive",
      createdAt: now,
    });
  }

  return alerts;
}

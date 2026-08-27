import { describe, expect, it } from "vitest";

import { buildAlerts } from "./alerts";
import type { Consensus, NewsSnapshot } from "./types";

const consensus = (direction: Consensus["direction"]): Consensus => ({
  direction,
  rawDirection: direction,
  agree: 4,
  total: 5,
  confidence: 70,
  buyVotes: direction === "BUY" ? 4 : 0,
  sellVotes: direction === "SELL" ? 4 : 0,
  waitVotes: direction === "WAIT" ? 5 : 0,
  checks: [],
  blocked: direction === "WAIT",
  reason: "test",
});

const news: NewsSnapshot = {
  asOf: 1,
  available: true,
  demo: true,
  headlines: [],
  goldBias: "neutral",
  eurBias: "neutral",
  netBias: "WAIT",
  netStrength: 0,
  upcoming: [],
  recent: [],
  minutesToHighImpact: 10,
  nextHighImpact: {
    id: "event-1",
    time: 1,
    currency: "USD",
    impact: "high",
    name: "CPI",
    previous: "—",
    forecast: "—",
    actual: null,
    released: false,
  },
  riskLevel: "high",
};

describe("in-app alerts", () => {
  it("reports signal changes and nearby high-impact news without trading commands", () => {
    const alerts = buildAlerts({
      previousDirection: "BUY",
      consensus: consensus("WAIT"),
      news,
      forecastLocked: false,
      newsAvoidMinutes: 30,
      now: 1234,
    });

    expect(alerts.map((alert) => alert.kind)).toEqual(["signal_changed", "high_impact_news"]);
    expect(alerts[0]?.body).toContain("BUY → WAIT");
    expect(alerts[1]?.body).toContain("ไม่ใช่คำสั่ง");
  });

  it("reports locked, settlement-ready and completed states", () => {
    const alerts = buildAlerts({
      consensus: consensus("BUY"),
      news: { ...news, minutesToHighImpact: null, nextHighImpact: null },
      forecastLocked: true,
      settlementReady: true,
      settlementCompleted: true,
      newsAvoidMinutes: 30,
    });

    expect(alerts.map((alert) => alert.kind)).toEqual([
      "forecast_ready",
      "settlement_ready",
      "settlement_completed",
    ]);
  });
});

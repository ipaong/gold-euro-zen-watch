import { describe, expect, it } from "vitest";

import { frozenYahooGoldProvider } from "../market/yahoo-frozen-provider";
import { buildSnapshot } from "../snapshot";
import type { NewsSnapshot } from "../types";
import { newsModel } from "./news";

function news(overrides: Partial<NewsSnapshot> = {}): NewsSnapshot {
  return {
    asOf: frozenYahooGoldProvider.getLatestTime(),
    available: true,
    demo: true,
    live: false,
    stale: false,
    headlines: [],
    goldBias: "neutral",
    eurBias: "strong",
    netBias: "BUY",
    netStrength: 1,
    upcoming: [],
    recent: [],
    minutesToHighImpact: null,
    nextHighImpact: null,
    riskLevel: "low",
    ...overrides,
  };
}

describe("asset-aware news model", () => {
  it("does not turn EUR-only strength into a GC=F BUY", () => {
    const snapshot = buildSnapshot(
      frozenYahooGoldProvider,
      frozenYahooGoldProvider.getLatestTime(),
    );
    const vote = newsModel(snapshot, news());
    expect(vote.direction).toBe("WAIT");
    expect(vote.summary).toContain("GC=F");
  });

  it("uses gold bias for GC=F", () => {
    const snapshot = buildSnapshot(
      frozenYahooGoldProvider,
      frozenYahooGoldProvider.getLatestTime(),
    );
    expect(newsModel(snapshot, news({ goldBias: "bullish", eurBias: "weak" })).direction).toBe(
      "BUY",
    );
    expect(newsModel(snapshot, news({ goldBias: "bearish", eurBias: "strong" })).direction).toBe(
      "SELL",
    );
  });

  it("includes Gold/USD macro factors and AI Gold direction for GC=F", () => {
    const snapshot = buildSnapshot(
      frozenYahooGoldProvider,
      frozenYahooGoldProvider.getLatestTime(),
    );
    const vote = newsModel(
      snapshot,
      news({
        goldBias: "bullish",
        interpretation: {
          goldBias: "bullish",
          eurBias: "neutral",
          xaueurBias: "BUY",
          confidence: 85,
          keyDrivers: ["Fed rate cut expectations", "Dollar weakening"],
          risks: ["Inflation stickiness"],
          supportingNewsIds: [],
          supportingEventIds: [],
          source: "ai",
          generatedAt: Date.now(),
        },
      }),
    );
    expect(vote.direction).toBe("BUY");
    expect(vote.factors.some((f) => f.includes("COMEX Gold Futures (USD)"))).toBe(true);
    expect(vote.factors.some((f) => f.includes("AI อ่านข่าวได้: BUY (ขึ้น)"))).toBe(true);
  });
});

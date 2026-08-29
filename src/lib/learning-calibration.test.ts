import { describe, expect, it } from "vitest";

import { buildChronologicalCalibration, MIN_CALIBRATION_SAMPLES } from "./learning-calibration";
import type { ModelVote, Prediction } from "./types";

const vote: ModelVote = {
  id: "trend",
  name: "Trend",
  direction: "BUY",
  confidence: 70,
  summary: "",
  factors: [],
  risks: [],
  unavailable: false,
};

function prediction(index: number, correct: boolean, actualTime = index * 100 + 50): Prediction {
  return {
    id: `p-${index}`,
    asOf: index * 100,
    createdAt: index * 100,
    mode: "time_machine",
    demo: true,
    symbol: "GC=F",
    timeframe: "15m",
    horizon: 1,
    price: 100,
    models: [vote],
    ensemble: { direction: "BUY", confidence: 70, summary: "", bullish: [], bearish: [], risks: [] },
    consensus: { direction: "BUY", rawDirection: "BUY", agree: 1, total: 1, confidence: 70, buyVotes: 1, sellVotes: 0, waitVotes: 0, checks: [], blocked: false, reason: "" },
    scenarios: [],
    forecast: [{ t: index * 100 + 10, o: 100, h: 102, l: 99, c: 101 }],
    plan: { direction: "BUY", price: 100, support: 99, resistance: 102, invalidation: 98, atr: 1, risk: "low" },
    narrative: { whatsHappening: "", why: [], invalidate: [] },
    newsRisk: "low",
    goldBias: "neutral",
    eurBias: "neutral",
    actual: [{ t: actualTime, o: 100, h: 102, l: 99, c: correct ? 101 : 99 }],
    score: {
      scoreVersion: "1.0.0",
      modelScores: [{ ...vote, directionCorrect: correct }],
      scoredAt: actualTime,
      directionCorrect: correct,
      actualDirection: correct ? "BUY" : "SELL",
      closeError: 0,
      mae: 0,
      highError: 0,
      lowError: 0,
      candleDirHits: correct ? 1 : 0,
      candleDirTotal: 1,
      hypotheticalMove: correct ? 1 : -1,
    },
    locked: true,
  };
}

describe("buildChronologicalCalibration", () => {
  it("does not learn until a conservative sample floor is reached", () => {
    const history = Array.from({ length: MIN_CALIBRATION_SAMPLES - 1 }, (_, i) => prediction(i + 1, true));
    const profile = buildChronologicalCalibration(history, 10_000, "GC=F", "15m", [vote]);
    expect(profile.model.trend?.multiplier).toBe(1);
    expect(profile.calibrated).toBe(false);
  });

  it("rewards a model with settled walk-forward evidence without exceeding the cap", () => {
    const history = Array.from({ length: 20 }, (_, i) => prediction(i + 1, true));
    const profile = buildChronologicalCalibration(history, 10_000, "GC=F", "15m", [vote]);
    expect(profile.model.trend?.multiplier).toBeGreaterThan(1);
    expect(profile.model.trend?.multiplier).toBeLessThanOrEqual(1.25);
    expect(profile.calibrated).toBe(true);
  });

  it("rejects outcomes that had not happened at the replay instant", () => {
    const leaked = Array.from({ length: 20 }, (_, i) => prediction(i + 1, true, 20_000 + i));
    const profile = buildChronologicalCalibration(leaked, 10_000, "GC=F", "15m", [vote]);
    expect(profile.sampleCount).toBe(0);
    expect(profile.model.trend?.samples).toBe(0);
    expect(profile.model.trend?.multiplier).toBe(1);
  });

  it("counts repeated runs at the same replay timestamp only once", () => {
    const repeated = Array.from({ length: 20 }, () => prediction(1, true));
    const profile = buildChronologicalCalibration(repeated, 10_000, "GC=F", "15m", [vote]);
    expect(profile.sampleCount).toBe(1);
    expect(profile.model.trend?.samples).toBe(1);
  });
});

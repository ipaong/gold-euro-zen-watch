import { describe, expect, it } from "vitest";

import { PILOT_PROTOCOL, summarizePilot, wilsonInterval } from "./pilot";
import type { Prediction } from "./types";

function prediction(asOf: number, correct: boolean): Prediction {
  return {
    id: `p-${asOf}`,
    asOf,
    models: [],
    consensus: { direction: "BUY" },
    score: {
      scoreVersion: "1.0.0",
      modelScores: [],
      scoredAt: asOf,
      directionCorrect: correct,
      actualDirection: correct ? "BUY" : "SELL",
      closeError: 0,
      mae: 1,
      highError: 1,
      lowError: 1,
      candleDirHits: 1,
      candleDirTotal: 1,
      hypotheticalMove: correct ? 1 : -1,
    },
  } as unknown as Prediction;
}

describe("pilot protocol", () => {
  it("uses a wide uncertainty interval for small samples", () => {
    const interval = wilsonInterval(7, 10);
    expect(interval.estimate).toBe(70);
    expect(interval.sample).toBe(10);
    expect(interval.lower).toBeLessThan(interval.estimate!);
    expect(interval.upper).toBeGreaterThan(interval.estimate!);
  });

  it("keeps incomplete pilot data ineligible and reports warnings", () => {
    const summary = summarizePilot([prediction(1, true), prediction(2, false)]);
    expect(summary.eligible).toBe(false);
    expect(summary.warnings.join(" ")).toContain(`${PILOT_PROTOCOL.minimumLocked}`);
    expect(summary.primaryMetric.sample).toBe(0);
  });

  it("splits chronological tuning and evaluation sets without retroactive tuning", () => {
    const predictions = Array.from({ length: 80 }, (_, index) =>
      prediction(index + 1, index >= 30),
    ).reverse();
    const summary = summarizePilot(predictions);
    expect(summary.tuning.total).toBe(30);
    expect(summary.evaluation.total).toBe(50);
    expect(summary.evaluation.hits).toBe(50);
    expect(summary.primaryMetric.sample).toBe(50);
    expect(summary.eligible).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { computeReplayAudit } from "./replay-audit";
import type { Candle, Direction, Prediction } from "./types";

function candle(t: number, close: number): Candle {
  return { t, o: close, h: close + 1, l: close - 1, c: close };
}

function settled(predicted: Direction, actual: Direction, marketCloses: number[] = []): Prediction {
  const asOf = 10;
  return {
    asOf,
    consensus: { direction: predicted },
    plan: { atr: 1 },
    marketCandles: marketCloses.map((close, index) => candle(index + 1, close)),
    score: { actualDirection: actual },
  } as Prediction;
}

describe("replay accuracy audit", () => {
  it("keeps WAIT outside directional accuracy and detects a possible inverse signal", () => {
    const predictions = [
      ...Array.from({ length: 8 }, () => settled("BUY", "SELL")),
      ...Array.from({ length: 2 }, () => settled("SELL", "BUY")),
      settled("WAIT", "SELL"),
      settled("WAIT", "WAIT"),
    ];

    expect(computeReplayAudit(predictions)).toMatchObject({
      scored: 12,
      directional: 10,
      coverage: 83,
      comparable: 10,
      directAccuracy: 0,
      inverseAccuracy: 100,
      waitCount: 2,
      waitWithDirectionalOutcome: 1,
      diagnosis: "possible_inverse",
    });
  });

  it("compares against a five-candle continuation baseline without reading future candles", () => {
    const prediction = settled("SELL", "BUY", [100, 101, 102, 103, 104, 105, 1]);
    prediction.asOf = 6;

    expect(computeReplayAudit([prediction])).toMatchObject({
      continuationSample: 1,
      continuationHits: 1,
      continuationAccuracy: 100,
      diagnosis: "insufficient",
    });
  });
});

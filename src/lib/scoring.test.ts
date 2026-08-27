import { describe, expect, it, vi } from "vitest";

import { scorePrediction } from "./scoring";
import type { Candle, Direction, Prediction } from "./types";

function candle(t: number, close: number): Candle {
  return { t, o: close - 0.2, h: close + 0.5, l: close - 0.5, c: close };
}

function prediction(direction: Direction, closes = [101, 102]): Prediction {
  return {
    price: 100,
    forecast: closes.map((close, index) => candle(index + 1, close)),
    consensus: { direction },
    plan: { atr: 1 },
  } as Prediction;
}

describe("scorePrediction", () => {
  it("requires a complete actual horizon", () => {
    expect(() => scorePrediction(prediction("BUY", []), [])).toThrow(/without forecast/i);
    expect(() => scorePrediction(prediction("BUY"), [candle(1, 101)])).toThrow(
      /all 2 actual candles/i,
    );
  });

  it("scores BUY and SELL against the realised direction", () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    const buy = scorePrediction(prediction("BUY"), [candle(1, 101), candle(2, 103)]);
    const sell = scorePrediction(prediction("SELL", [99, 98]), [candle(1, 99), candle(2, 97)]);

    expect(buy).toMatchObject({ scoredAt: 1234, actualDirection: "BUY", directionCorrect: true });
    expect(sell).toMatchObject({ actualDirection: "SELL", directionCorrect: true });
    expect(sell.hypotheticalMove).toBe(3);
    vi.restoreAllMocks();
  });

  it("keeps WAIT unscored directionally and tolerates a zero ATR", () => {
    const p = prediction("WAIT");
    p.plan.atr = 0;
    const score = scorePrediction(p, [candle(1, 100.1), candle(2, 100.2)]);

    expect(score.directionCorrect).toBeNull();
    expect(score.hypotheticalMove).toBe(0);
    expect(Number.isFinite(score.mae)).toBe(true);
  });
});

describe("measurement contract", () => {
  it("stores a versioned result for each voting model and Consensus, excluding Ensemble", () => {
    const p = prediction("BUY");
    p.models = [
      {
        id: "trend",
        name: "เทรนด์",
        direction: "BUY",
        confidence: 80,
        summary: "",
        factors: [],
        risks: [],
        unavailable: false,
      },
      {
        id: "news",
        name: "ข่าว",
        direction: "SELL",
        confidence: 55,
        summary: "",
        factors: [],
        risks: [],
        unavailable: false,
      },
    ];
    const score = scorePrediction(p, [candle(1, 101), candle(2, 103)]);

    expect(score.scoreVersion).toBe("1.0.0");
    expect(score.modelScores.map((item) => item.id)).toEqual(["trend", "news", "consensus"]);
    expect(score.modelScores.find((item) => item.id === "trend")?.directionCorrect).toBe(true);
    expect(score.modelScores.find((item) => item.id === "news")?.directionCorrect).toBe(false);
  });

  it("uses exactly the configured horizon and rejects partial actual data", () => {
    const p = prediction("BUY", [101, 102, 103]);
    p.horizon = 3;
    expect(() => scorePrediction(p, [candle(1, 101), candle(2, 102)])).toThrow(
      /all 3 actual candles/i,
    );
    const score = scorePrediction(p, [
      candle(1, 101),
      candle(2, 102),
      candle(3, 103),
      candle(4, 999),
    ]);
    expect(score.candleDirTotal).toBe(3);
  });
});

describe("computeModelStats", () => {
  it("reports per-direction sample sizes and confidence buckets", async () => {
    const { computeModelStats } = await import("./scoring");
    const make = (
      direction: Direction,
      actualDirection: Direction,
      confidence: number,
    ): Prediction => {
      const p = prediction(direction);
      p.models = [
        {
          id: "trend",
          name: "เทรนด์",
          direction,
          confidence,
          summary: "",
          factors: [],
          risks: [],
          unavailable: false,
        },
      ];
      p.score = {
        scoreVersion: "1.0.0",
        modelScores: [
          {
            id: "trend",
            name: "เทรนด์",
            direction,
            confidence,
            unavailable: false,
            directionCorrect: direction === actualDirection,
          },
        ],
        scoredAt: 1,
        directionCorrect: direction === actualDirection,
        actualDirection,
        closeError: 0,
        mae: 0,
        highError: 0,
        lowError: 0,
        candleDirHits: 2,
        candleDirTotal: 2,
        hypotheticalMove: 1,
      };
      return p;
    };

    const stats = computeModelStats([
      make("BUY", "BUY", 80),
      make("SELL", "BUY", 55),
      make("WAIT", "SELL", 90),
    ]);
    const trend = stats.find((item) => item.id === "trend")!;
    expect(trend.sample).toBe(3);
    expect(trend.buyAccuracy).toBe(100);
    expect(trend.sellAccuracy).toBe(0);
    expect(trend.waitFrequency).toBe(33);
    expect(trend.calibration.find((bucket) => bucket.label === "70–84%")?.sample).toBe(1);
  });
});

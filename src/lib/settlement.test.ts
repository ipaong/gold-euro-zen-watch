import { describe, expect, it } from "vitest";

import { evaluateSettlement, toSettlementJob } from "./settlement";
import type { Candle, Prediction } from "./types";

const FUTURE_1 = 900_000;
const FUTURE_2 = 1_800_000;

function candle(t: number, close: number): Candle {
  return { t, o: close - 0.2, h: close + 0.5, l: close - 0.5, c: close };
}

function prediction(score: Prediction["score"] = null): Prediction {
  return {
    id: "p-1",
    asOf: 100,
    createdAt: 100,
    mode: "time_machine",
    demo: true,
    symbol: "XAUEUR",
    timeframe: "M15",
    horizon: 2,
    price: 100,
    models: [],
    ensemble: {} as never,
    consensus: {
      direction: "BUY",
      rawDirection: "BUY",
      agree: 3,
      total: 5,
      confidence: 70,
      buyVotes: 3,
      sellVotes: 0,
      waitVotes: 2,
      checks: [],
      blocked: false,
      reason: "test",
    },
    scenarios: [],
    forecast: [candle(1, 101), candle(2, 102)],
    plan: {
      direction: "BUY",
      price: 100,
      support: 99,
      resistance: 103,
      invalidation: 98,
      atr: 1,
      risk: "low",
    },
    narrative: {} as never,
    newsRisk: "low",
    goldBias: "neutral",
    eurBias: "neutral",
    actual: score ? [candle(101, 101), candle(102, 102)] : null,
    score,
    locked: true,
    ai: null,
  };
}

describe("settlement contract", () => {
  it("is not ready when the future horizon is partial", () => {
    const result = evaluateSettlement(prediction(), {
      getCandlesAfter: () => [candle(FUTURE_1, 101)],
    });
    expect(result.status).toBe("not_ready");
    expect(result.available).toBe(1);
    expect(result.score).toBeNull();
  });

  it("filters provider candles at or before asOf before deciding readiness", () => {
    const result = evaluateSettlement(prediction(), {
      getCandlesAfter: () => [candle(100, 100), candle(FUTURE_1, 101)],
    });
    expect(result.status).toBe("not_ready");
    expect(result.actual.map((item) => item.t)).toEqual([FUTURE_1]);
    expect(result.available).toBe(1);
  });

  it("scores a complete horizon and creates a worker-safe job only before settlement", () => {
    const p = prediction();
    const result = evaluateSettlement(p, {
      getCandlesAfter: () => [candle(FUTURE_1, 101), candle(FUTURE_2, 103)],
    });
    expect(result.status).toBe("ready");
    expect(result.score?.scoreVersion).toBe("1.0.0");
    expect(toSettlementJob(p)).toEqual({ predictionId: "p-1", asOf: 100, horizon: 2 });
  });

  it("treats a settled prediction as immutable and gives no second job", () => {
    const settled = prediction({
      scoreVersion: "1.0.0",
      modelScores: [],
      scoredAt: 123,
      directionCorrect: true,
      actualDirection: "BUY",
      closeError: 0,
      mae: 0,
      highError: 0,
      lowError: 0,
      candleDirHits: 2,
      candleDirTotal: 2,
      hypotheticalMove: 2,
    });
    const result = evaluateSettlement(settled, { getCandlesAfter: () => [] });
    expect(result.status).toBe("already_settled");
    expect(result.score?.scoredAt).toBe(123);
    expect(toSettlementJob(settled)).toBeNull();
  });

  it("does not score reversed provider candles", () => {
    const result = evaluateSettlement(prediction(), {
      getCandlesAfter: () => [candle(FUTURE_2, 103), candle(FUTURE_1, 101)],
    });

    expect(result.status).toBe("not_ready");
    expect(result.score).toBeNull();
    expect(result.available).toBe(0);
    expect(result.actual).toEqual([]);
  });

  it("does not score a horizon padded with duplicate timestamps", () => {
    const result = evaluateSettlement(prediction(), {
      getCandlesAfter: () => [candle(FUTURE_1, 101), candle(FUTURE_1, 999), candle(FUTURE_2, 102)],
    });

    expect(result.status).toBe("not_ready");
    expect(result.score).toBeNull();
    expect(result.available).toBe(0);
    expect(result.actual).toEqual([]);
  });

  it("does not score malformed candles or crash on provider timeout", () => {
    const malformed = { ...candle(FUTURE_2, 102), h: Number.NaN };
    const malformedResult = evaluateSettlement(prediction(), {
      getCandlesAfter: () => [candle(FUTURE_1, 101), malformed],
    });
    const timeoutResult = evaluateSettlement(prediction(), {
      getCandlesAfter: () => {
        throw new Error("timeout");
      },
    });

    expect(malformedResult).toMatchObject({ status: "not_ready", actual: [], score: null, available: 0 });
    expect(timeoutResult).toMatchObject({ status: "not_ready", actual: [], score: null, available: 0 });
  });
});

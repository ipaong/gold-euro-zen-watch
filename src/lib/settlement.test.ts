import { describe, expect, it } from "vitest";

import { evaluateSettlement, toSettlementJob } from "./settlement";
import type { Candle, Prediction } from "./types";

const AS_OF = Date.parse("2026-08-27T00:00:00Z");
const INTERVAL_MS = 15 * 60 * 1000;

function candle(t: number, close: number): Candle {
  return { t, o: close - 0.2, h: close + 0.5, l: close - 0.5, c: close };
}

function actualCandle(index: number, close: number): Candle {
  return candle(AS_OF + (index + 1) * INTERVAL_MS, close);
}

function prediction(score: Prediction["score"] = null): Prediction {
  return {
    id: "p-1",
    asOf: AS_OF,
    createdAt: AS_OF,
    mode: "time_machine",
    demo: true,
    symbol: "XAUEUR",
    timeframe: "M15",
    provider: "fixture",
    providerSymbol: "XAUEUR",
    dataStatus: "demo",
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
    forecast: [candle(AS_OF + INTERVAL_MS, 101), candle(AS_OF + 2 * INTERVAL_MS, 102)],
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
    actual: score ? [actualCandle(0, 101), actualCandle(1, 102)] : null,
    score,
    locked: true,
    ai: null,
  };
}

function provider(getCandlesAfter: (timestamp: number, count: number) => Candle[]) {
  return {
    symbol: "XAUEUR" as const,
    providerSymbol: "XAUEUR" as const,
    intervalMs: INTERVAL_MS,
    sourceType: "demo" as const,
    demo: true,
    getCandlesAfter,
  };
}

describe("settlement contract", () => {
  it("is not ready when the future horizon is partial", () => {
    const result = evaluateSettlement(prediction(), provider(() => [actualCandle(0, 101)]));
    expect(result.status).toBe("not_ready");
    expect(result.available).toBe(1);
    expect(result.score).toBeNull();
  });

  it("filters provider candles at or before asOf before deciding readiness", () => {
    const result = evaluateSettlement(
      prediction(),
      provider(() => [candle(AS_OF, 100), actualCandle(0, 101)]),
    );
    expect(result.status).toBe("not_ready");
    expect(result.actual.map((item) => item.t)).toEqual([AS_OF + INTERVAL_MS]);
    expect(result.available).toBe(1);
  });

  it("scores a complete horizon and creates a worker-safe job only before settlement", () => {
    const p = prediction();
    const result = evaluateSettlement(
      p,
      provider(() => [actualCandle(0, 101), actualCandle(1, 103)]),
    );
    expect(result.status).toBe("ready");
    expect(result.score?.scoreVersion).toBe("1.0.0");
    expect(toSettlementJob(p)).toEqual({ predictionId: "p-1", asOf: AS_OF, horizon: 2 });
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
    const result = evaluateSettlement(settled, provider(() => []));
    expect(result.status).toBe("already_settled");
    expect(result.score?.scoredAt).toBe(123);
    expect(toSettlementJob(settled)).toBeNull();
  });

  it.each([
    ["reversed", [actualCandle(1, 102), actualCandle(0, 101)]],
    ["duplicate timestamp", [actualCandle(0, 101), actualCandle(0, 102)]],
    ["interval gap", [actualCandle(0, 101), { ...actualCandle(1, 102), t: AS_OF + 3 * INTERVAL_MS }]],
    [
      "malformed OHLC",
      [
        { ...actualCandle(0, 101), h: 99 },
        actualCandle(1, 102),
      ],
    ],
  ] as [string, Candle[]][])("rejects %s candles instead of scoring them", (_label, candles) => {
    const result = evaluateSettlement(prediction(), provider(() => candles));
    expect(result.status).toBe("not_ready");
    expect(result.score).toBeNull();
  });

  it("converts provider timeout into an explicit not-ready result", () => {
    const result = evaluateSettlement(
      prediction(),
      provider(() => {
        throw new Error("Yahoo timeout");
      }),
    );
    expect(result.status).toBe("not_ready");
    expect(result.actual).toEqual([]);
    expect(result.score).toBeNull();
  });

  it("rejects settlement when the provider instrument does not match the locked prediction", () => {
    const mismatched = {
      ...provider(() => [actualCandle(0, 101), actualCandle(1, 102)]),
      symbol: "GC=F" as const,
      providerSymbol: "GC=F" as const,
    };
    const result = evaluateSettlement(prediction(), mismatched);
    expect(result.status).toBe("not_ready");
    expect(result.score).toBeNull();
  });
});

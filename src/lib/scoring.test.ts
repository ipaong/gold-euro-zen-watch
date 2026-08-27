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

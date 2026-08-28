import { describe, expect, it } from "vitest";

import { buildConsensus } from "./consensus";
import { runForecast } from "./forecast/engine";
import { momentumModel, newsModel, technicalModel, trendModel, volatilityModel } from "./models";
import { assessReversalRisk } from "./reversal-risk";
import type { AppSettings, Candle, MarketSnapshot, NewsSnapshot } from "./types";

const intervalMs = 15 * 60 * 1000;
const asOf = Date.parse("2026-08-28T05:45:00Z");

function screenshotCase(): MarketSnapshot {
  const candles: Candle[] = [
    { t: asOf - intervalMs * 11, o: 4638.7, h: 4640.9, l: 4635, c: 4637.1 },
    { t: asOf - intervalMs * 10, o: 4636.8, h: 4642.3, l: 4636.8, c: 4640.6 },
    { t: asOf - intervalMs * 9, o: 4640.5, h: 4640.5, l: 4633.4, c: 4634.1 },
    { t: asOf - intervalMs * 8, o: 4634, h: 4634, l: 4630.9, c: 4631.4 },
    { t: asOf - intervalMs * 7, o: 4632.3, h: 4632.9, l: 4630.2, c: 4631.6 },
    { t: asOf - intervalMs * 6, o: 4631.2, h: 4637.5, l: 4630.8, c: 4636.8 },
    { t: asOf - intervalMs * 5, o: 4636.5, h: 4636.5, l: 4630, c: 4632 },
    { t: asOf - intervalMs * 4, o: 4632, h: 4637.5, l: 4630.2, c: 4636.4 },
    { t: asOf - intervalMs * 3, o: 4636.7, h: 4637.3, l: 4630.3, c: 4632.3 },
    { t: asOf - intervalMs * 2, o: 4631.9, h: 4638.6, l: 4631.4, c: 4636.4 },
    { t: asOf - intervalMs, o: 4636.2, h: 4636.2, l: 4623, c: 4625 },
    { t: asOf, o: 4624.9, h: 4629.5, l: 4623.8, c: 4625.5 },
  ];
  return {
    asOf,
    symbol: "GC=F",
    timeframe: "15m",
    intervalMs,
    price: 4625.5,
    prevClose: 4625,
    changePct: 0.01,
    candles,
    lastCandleTime: asOf,
    ema20: 4635.8773,
    ema50: 4643.4954,
    ema200: 4661.7227,
    ema20Slope: -3.4701,
    ema50Slope: -4,
    rsi14: 38.0498,
    macdLine: -5,
    macdSignal: -4.7413,
    macdHist: -0.2587,
    macdHistPrev: 0.0054,
    atr14: 7.1349,
    atrPct: 0.154,
    atrRatio: 0.8728,
    support: 4618.9,
    resistance: 4642.4,
    swingHigh: 4680,
    swingLow: 4618.9,
    higherHighs: false,
    lowerLows: true,
    consecutiveBull: 1,
    consecutiveBear: 0,
    bodyStrength: 0.562,
    zScore: -1.7726,
    trendScore: -1,
    momentumScore: -0.2652,
    regime: "trending_down",
  };
}

function neutralNews(): NewsSnapshot {
  return {
    asOf,
    available: true,
    demo: false,
    live: true,
    stale: false,
    headlines: [],
    goldBias: "neutral",
    eurBias: "neutral",
    netBias: "WAIT",
    netStrength: 0,
    upcoming: [],
    recent: [],
    minutesToHighImpact: null,
    nextHighImpact: null,
    riskLevel: "low",
  };
}

const settings: AppSettings = {
  confidenceThreshold: 60,
  minAgreement: 3,
  newsAvoidMinutes: 30,
  horizon: 5,
};

describe("continuous reversal context", () => {
  it("recognises the 12:45 failed sell follow-through without leaking future candles", () => {
    const risk = assessReversalRisk(screenshotCase());

    expect(risk.bullish).toBeGreaterThan(0.4);
    expect(risk.bearish).toBeLessThan(0.2);
    expect(risk.bullish).toBeGreaterThan(risk.bearish);
    expect(risk.supportDistanceAtr).toBeCloseTo(0.93, 1);
    expect(risk.bullishSignals).toContain("แรงขายแท่งก่อนหน้าไม่มี follow-through");
  });

  it("softens all five models instead of forcing a hindsight BUY", () => {
    const snapshot = screenshotCase();
    const news = neutralNews();
    const models = [
      trendModel(snapshot),
      momentumModel(snapshot),
      technicalModel(snapshot),
      newsModel(snapshot, news),
      volatilityModel(snapshot),
    ];

    expect(models.map((model) => model.direction)).toEqual([
      "SELL",
      "WAIT",
      "WAIT",
      "WAIT",
      "WAIT",
    ]);
    expect(models[0]!.confidence).toBeLessThan(87);
    expect(models[0]!.risks.some((risk) => risk.includes("เสี่ยงกลับตัว"))).toBe(true);

    const bearishNews = newsModel(snapshot, {
      ...news,
      goldBias: "bearish",
      netBias: "SELL",
      netStrength: 1,
    });
    expect(bearishNews.direction).toBe("SELL");
    expect(bearishNews.confidence).toBeLessThan(83);
    expect(bearishNews.risks.some((risk) => risk.includes("ราคาเสี่ยงกลับตัว"))).toBe(true);

    const forecast = runForecast(snapshot, 5);
    const sellWeight = forecast.scenarios
      .filter((scenario) => scenario.direction === "SELL")
      .reduce((sum, scenario) => sum + scenario.weight, 0);
    expect(sellWeight).toBeLessThan(80);

    const consensus = buildConsensus(snapshot, news, models, settings, forecast.quality);
    expect(consensus.direction).toBe("WAIT");
  });
});

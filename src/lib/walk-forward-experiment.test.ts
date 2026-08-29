import { describe, expect, it } from "vitest";

import { frozenYahooGoldProvider } from "./market/yahoo-frozen-provider";
import { runAdaptiveAblation, runWalkForwardExperiment } from "./walk-forward-experiment";

const candles = frozenYahooGoldProvider.getCandlesUpTo(frozenYahooGoldProvider.getLatestTime());

describe("Gold Oracle V3 walk-forward experiment contract", () => {
  it("splits only chronological out-of-sample anchors and reports honest breakdowns", () => {
    const report = runWalkForwardExperiment(candles, {
      mode: "anchored",
      foldCount: 4,
      horizon: 5,
      sentinelChecks: 5,
    });

    expect(report.version).toBe("1.0.0");
    expect(report.aggregate).toMatchObject({
      sample: 94,
      directional: 32,
      hits: 16,
      accuracy: 50,
      coverage: 34.04,
    });
    expect(report.folds).toHaveLength(4);
    expect(report.folds.reduce((sum, fold) => sum + fold.metrics.sample, 0)).toBe(94);
    expect(report.folds.every((fold) => fold.startAsOf <= fold.endAsOf)).toBe(true);
    expect(Object.values(report.aggregate.byRegime).every((metrics) => metrics.sample > 0)).toBe(
      true,
    );
    expect(
      Object.values(report.aggregate.bySession).reduce((sum, metrics) => sum + metrics.sample, 0),
    ).toBe(94);
    expect(report.controls.futureLeakChecks).toBe(5);
    expect(report.controls.futureLeakMismatches).toBe(0);
    expect(report.controls.shuffledLabels).toMatchObject({
      sample: 94,
      accuracy: 31.25,
      softBrier: 0.2285,
    });
    expect(report.controls.shiftedLabelBars).toBe(31);
    expect(report.controls.shiftedLabels).toMatchObject({
      sample: 63,
      accuracy: 29.41,
      softBrier: 0.2564,
    });
  }, 15_000);

  it("can reset learning to a fixed rolling history without reading future candles", () => {
    const report = runWalkForwardExperiment(candles, {
      mode: "rolling",
      rollingWindow: 240,
      foldCount: 4,
      horizon: 5,
      sentinelChecks: 4,
    });

    expect(report.mode).toBe("rolling");
    expect(report.rollingWindow).toBe(240);
    expect(report.aggregate.sample).toBe(94);
    expect(report.folds).toHaveLength(4);
    expect(report.controls.futureLeakChecks).toBe(4);
    expect(report.controls.futureLeakMismatches).toBe(0);
  }, 20_000);

  it("runs a fixed ablation matrix without selecting a winner on the same fixture", () => {
    const report = runAdaptiveAblation(candles, { horizon: 5 });
    const ids = report.variants.map((variant) => variant.id);
    const champion = report.variants[0]!;

    expect(report.fixedBeforeEvaluation).toBe(true);
    expect(report.trialCount).toBe(9);
    expect(ids).toEqual([
      "champion",
      "without_tape",
      "without_trend",
      "without_mean_reversion",
      "without_breakout",
      "without_analog",
      "without_inversion",
      "without_regime_skill",
      "without_analog_recency",
    ]);
    expect(champion.metrics).toMatchObject({ sample: 94, directional: 32, hits: 16 });
    expect(champion.accuracyDelta).toBe(0);
    expect(champion.coverageDelta).toBe(0);
    expect(champion.severeOppositeDelta).toBe(0);
    expect(champion.softBrierDelta).toBe(0);
    expect(report.variants.every((variant) => variant.metrics.sample === 94)).toBe(true);
  }, 15_000);
});

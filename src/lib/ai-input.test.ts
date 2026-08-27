import { afterEach, describe, expect, it, vi } from "vitest";

import { analyze } from "./analysis";
import { buildAnalystInput, templateExplanation } from "./ai-input";
import { frozenMarketProvider } from "./market/frozen-provider";

describe("AI explanation boundary", () => {
  afterEach(() => vi.useRealTimers());

  it("passes the quality-gated direction, while rawDirection stays context only", () => {
    const result = analyze(frozenMarketProvider.getLatestTime() - 24 * 60 * 60 * 1000);
    result.consensus.direction = "WAIT";
    result.consensus.rawDirection = "BUY";
    result.consensus.blocked = true;

    expect(buildAnalystInput(result)).toMatchObject({ direction: "WAIT", rawDirection: "BUY", blocked: true });
  });

  it("produces a deterministic template fallback when the clock is fixed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T04:00:00Z"));
    const result = analyze(frozenMarketProvider.getLatestTime() - 24 * 60 * 60 * 1000);
    const first = templateExplanation(result);
    const second = templateExplanation(result);

    expect(second).toEqual(first);
    expect(first.source).toBe("template");
    expect(first.generatedAt).toBe(Date.now());
  });
});

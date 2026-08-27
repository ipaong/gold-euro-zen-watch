import { describe, expect, it } from "vitest";

import { guardInterpretation, parseInterpretation } from "./interpret.server";

const headline = {
  id: "news-1",
  publishedAt: 1,
  title: "Gold rises as euro weakens",
  source: "Test",
  tag: "gold_up" as const,
  impact: "high" as const,
};
const event = {
  id: "event-1",
  time: 1,
  currency: "USD" as const,
  impact: "high" as const,
  name: "CPI",
  previous: "1",
  forecast: "2",
  actual: "2",
  released: true,
};

describe("news interpretation boundary", () => {
  it("extracts valid JSON from a fenced or prefixed response", () => {
    const parsed = parseInterpretation(
      `Here is the result:\n\`\`\`json\n${JSON.stringify({
        goldBias: "bullish",
        eurBias: "weak",
        xaueurBias: "BUY",
        confidence: 72,
        keyDrivers: ["ทองแข็ง"],
        risks: ["ข่าวแรง"],
        supportingNewsIds: ["news-1"],
        supportingEventIds: ["event-1"],
      })}\n\`\`\``,
    );

    expect(parsed).toMatchObject({ goldBias: "bullish", eurBias: "weak", xaueurBias: "BUY" });
  });

  it("rejects invalid enum values and non-JSON text", () => {
    expect(parseInterpretation("not json")).toBeNull();
    expect(
      parseInterpretation(
        JSON.stringify({
          goldBias: "up",
          eurBias: "weak",
          xaueurBias: "BUY",
        }),
      ),
    ).toBeNull();
  });

  it("keeps only supporting IDs present in the input snapshot and clamps output", () => {
    const parsed = parseInterpretation(
      JSON.stringify({
        goldBias: "bullish",
        eurBias: "weak",
        xaueurBias: "BUY",
        confidence: 150,
        keyDrivers: Array.from({ length: 8 }, (_, i) => `driver-${i}`),
        risks: Array.from({ length: 8 }, (_, i) => `risk-${i}`),
        supportingNewsIds: ["news-1", "not-in-input"],
        supportingEventIds: ["event-1", "not-in-input"],
      }),
    )!;

    const guarded = guardInterpretation(parsed, { headlines: [headline], events: [event] }, 1234);
    expect(guarded.confidence).toBe(100);
    expect(guarded.keyDrivers).toHaveLength(4);
    expect(guarded.risks).toHaveLength(4);
    expect(guarded.supportingNewsIds).toEqual(["news-1"]);
    expect(guarded.supportingEventIds).toEqual(["event-1"]);
    expect(guarded.generatedAt).toBe(1234);
  });
});

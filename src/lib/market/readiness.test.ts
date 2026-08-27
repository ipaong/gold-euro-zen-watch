import { describe, expect, it } from "vitest";

import { evaluateGoldFeedReadiness } from "./readiness";

const valid = { valid: true, stale: false } as const;

describe("Gold API feed readiness", () => {
  it("keeps 239 closed candles on the warming fallback", () => {
    expect(evaluateGoldFeedReadiness(239, valid)).toEqual({
      mode: "warming",
      reason: "กำลังสะสมข้อมูลจริง 239/240 แท่ง",
    });
  });

  it("allows LIVE only at 240 valid, fresh closed candles", () => {
    expect(evaluateGoldFeedReadiness(240, valid)).toEqual({ mode: "live" });
    expect(evaluateGoldFeedReadiness(600, valid)).toEqual({ mode: "live" });
  });

  it("keeps stale and invalid data on fallback regardless of candle count", () => {
    expect(evaluateGoldFeedReadiness(600, { valid: true, stale: true })).toEqual({
      mode: "fallback",
      reason: "ข้อมูลค้างเกินเกณฑ์",
    });
    expect(evaluateGoldFeedReadiness(600, { valid: false, stale: false })).toEqual({
      mode: "fallback",
      reason: "ข้อมูลไม่ผ่าน validation",
    });
  });
});

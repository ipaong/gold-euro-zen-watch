import { describe, expect, it } from "vitest";

import { buildLiveNewsSnapshot } from "./build-snapshot";
import type { EconomicEvent, NewsItem } from "../types";

const AS_OF = Date.UTC(2026, 7, 27, 12, 0, 0);

const headline: NewsItem = {
  id: "news-1",
  publishedAt: AS_OF - 1_000,
  title: "Gold rises as euro weakens",
  source: "fixture",
  tag: "gold_up",
  impact: "high",
};

const futureEvent: EconomicEvent = {
  id: "event-1",
  time: AS_OF + 60_000,
  currency: "USD",
  impact: "high",
  name: "CPI",
  previous: "1",
  forecast: "2",
  actual: "2",
  released: true,
};

describe("live news snapshot resilience", () => {
  it("keeps the pipeline usable while marking optional-provider failure and stale state", () => {
    const snapshot = buildLiveNewsSnapshot({
      asOf: AS_OF,
      headlines: [headline],
      events: [futureEvent],
      interpretation: null,
      fetchedAt: AS_OF,
      providers: ["Fed/ECB press"],
      providerErrors: ["GDELT: timeout"],
      providerHealth: [
        {
          id: "GDELT",
          version: "DOC-2.0",
          status: "error",
          fetchedAt: AS_OF,
          optional: true,
          error: "timeout",
        },
        {
          id: "Fed/ECB press",
          version: "RSS-1.0",
          status: "ok",
          fetchedAt: AS_OF,
          optional: false,
        },
      ],
    });

    expect(snapshot.available).toBe(true);
    expect(snapshot.stale).toBe(false);
    expect(snapshot.fallbackReason).toContain("แหล่งข้อมูลหรือขั้นตอนบางราย");
    expect(snapshot.nextHighImpact?.actual).toBeNull();
    expect(snapshot.nextHighImpact?.released).toBe(false);
  });
});

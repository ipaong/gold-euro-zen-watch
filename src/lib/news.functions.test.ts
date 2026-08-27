import { describe, expect, it } from "vitest";

import {
  buildNewsCacheKey,
  isSuccessfulNewsSnapshot,
  maskNewsEventsForAsOf,
  NEWS_CACHE_TTL_MS,
} from "./news.functions";
import type { NewsSnapshot } from "./types";

const baseSnapshot = (overrides: Partial<NewsSnapshot> = {}): NewsSnapshot => ({
  asOf: 1_000_000,
  available: true,
  demo: false,
  live: true,
  stale: false,
  fetchedAt: 1_000_000,
  providers: ["ECB"],
  providerErrors: [],
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
  interpretation: null,
  ...overrides,
});

describe("news cache contract", () => {
  it("separates live and historical cache namespaces", () => {
    const asOf = 1_000_000;
    expect(buildNewsCacheKey(asOf, asOf)).toMatch(/^live:/);
    expect(buildNewsCacheKey(asOf, asOf + 3 * 60 * 60 * 1000)).toMatch(/^historical:/);
    expect(NEWS_CACHE_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("caches only fresh snapshots and tolerates an optional GDELT failure", () => {
    expect(isSuccessfulNewsSnapshot(baseSnapshot())).toBe(true);
    expect(
      isSuccessfulNewsSnapshot(
        baseSnapshot({
          providerErrors: ["GDELT: timeout"],
          providerHealth: [
            {
              id: "GDELT",
              version: "DOC-2.0",
              status: "error",
              fetchedAt: 1_000_000,
              optional: true,
            },
            { id: "ECB", version: "RSS-1.0", status: "ok", fetchedAt: 1_000_000, optional: false },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      isSuccessfulNewsSnapshot(
        baseSnapshot({
          providerHealth: [
            {
              id: "ECB",
              version: "RSS-1.0",
              status: "error",
              fetchedAt: 1_000_000,
              optional: false,
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(isSuccessfulNewsSnapshot(baseSnapshot({ stale: true }))).toBe(false);
    expect(isSuccessfulNewsSnapshot(baseSnapshot({ available: false }))).toBe(false);
  });

  it("does not reuse one cache entry for different asOf values in the same 10-minute bucket", () => {
    const now = Date.UTC(2026, 7, 27, 12, 0, 0);
    const firstAsOf = now - 2 * 60 * 1000;
    const secondAsOf = now - 1 * 60 * 1000;

    expect(buildNewsCacheKey(firstAsOf, now)).not.toBe(buildNewsCacheKey(secondAsOf, now));
  });

  it("masks future event actuals before the news snapshot reaches AI", () => {
    const asOf = Date.UTC(2026, 7, 27, 12, 0, 0);
    const futureEvent = {
      id: "future-event-red-team",
      time: asOf + 60 * 60 * 1000,
      currency: "USD" as const,
      impact: "high" as const,
      name: "Future CPI",
      previous: "1",
      forecast: "2",
      actual: "3",
      released: true,
    };

    const masked = maskNewsEventsForAsOf([futureEvent], asOf);

    expect(masked[0]).toMatchObject({ released: false, actual: null });
  });
});

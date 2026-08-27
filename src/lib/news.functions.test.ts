import { describe, expect, it } from "vitest";

import { buildNewsCacheKey, isSuccessfulNewsSnapshot, NEWS_CACHE_TTL_MS } from "./news.functions";
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
});

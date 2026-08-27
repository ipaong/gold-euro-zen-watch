import { describe, expect, it } from "vitest";

import {
  assertGoldApiFreshness,
  getM15BucketStartMs,
  parseGoldApiResponse,
} from "./goldapi";

const NOW = Date.parse("2026-08-27T09:00:00Z");

function response(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "XAU",
    currency: "EUR",
    price: 3944.5,
    updatedAt: "2026-08-27T08:59:30Z",
    ...overrides,
  };
}

describe("Gold API adapter", () => {
  it("parses the provider contract and preserves the source timestamp", () => {
    expect(parseGoldApiResponse(response())).toMatchObject({
      symbol: "XAU",
      currency: "EUR",
      price: 3944.5,
      updatedAt: "2026-08-27T08:59:30Z",
      updatedAtMs: Date.parse("2026-08-27T08:59:30Z"),
    });
  });

  it.each([
    ["symbol", { symbol: "XAG" }],
    ["currency", { currency: "USD" }],
    ["price", { price: 0 }],
    ["negative price", { price: -1 }],
    ["missing timestamp", { updatedAt: undefined }],
    ["timestamp without timezone", { updatedAt: "2026-08-27T08:59:30" }],
    ["malformed timestamp", { updatedAt: "not-a-dateZ" }],
  ])("rejects invalid %s", (_label, overrides) => {
    expect(() => parseGoldApiResponse(response(overrides))).toThrow();
  });

  it("rejects stale and materially future samples", () => {
    const stale = parseGoldApiResponse(response({ updatedAt: "2026-08-27T08:50:00Z" }));
    expect(() => assertGoldApiFreshness(stale, NOW)).toThrow(/เกิน/);

    const future = parseGoldApiResponse(response({ updatedAt: "2026-08-27T09:02:00Z" }));
    expect(() => assertGoldApiFreshness(future, NOW)).toThrow(/อนาคต/);
  });

  it("allows a response inside the freshness window", () => {
    const sample = parseGoldApiResponse(response());
    expect(() => assertGoldApiFreshness(sample, NOW)).not.toThrow();
  });

  it("maps exact quarter-hour boundaries to UTC M15 buckets", () => {
    expect(getM15BucketStartMs(Date.parse("2026-08-27T08:59:59Z"))).toBe(
      Date.parse("2026-08-27T08:45:00Z"),
    );
    expect(getM15BucketStartMs(Date.parse("2026-08-27T09:00:00Z"))).toBe(
      Date.parse("2026-08-27T09:00:00Z"),
    );
    expect(getM15BucketStartMs(Date.parse("2026-08-27T09:14:59Z"))).toBe(
      Date.parse("2026-08-27T09:00:00Z"),
    );
    expect(getM15BucketStartMs(Date.parse("2026-08-27T09:15:00Z"))).toBe(
      Date.parse("2026-08-27T09:15:00Z"),
    );
  });
});

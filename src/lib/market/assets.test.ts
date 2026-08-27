import { describe, expect, it } from "vitest";

import { findEnabledMarketAsset, getMarketAsset } from "./assets";

describe("market asset registry", () => {
  it("exposes only the validated Gold Futures default", () => {
    expect(getMarketAsset("gold")).toMatchObject({
      id: "gold",
      providerSymbol: "GC=F",
      defaultTimeframe: "15m",
      enabled: true,
    });
  });

  it("does not substitute a disabled future asset with Gold Futures", () => {
    expect(findEnabledMarketAsset("silver")).toBeNull();
    expect(findEnabledMarketAsset("not-a-real-asset")).toBeNull();
    expect(getMarketAsset("not-a-real-asset").id).toBe("gold");
  });
});

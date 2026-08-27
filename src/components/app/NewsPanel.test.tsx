import { describe, expect, it } from "vitest";

import { getNewsStatusLabel } from "@/lib/news/status";

describe("news status presentation", () => {
  it("distinguishes live, stale real, and demo snapshots", () => {
    expect(getNewsStatusLabel({ demo: false, live: true, stale: false })).toBe("ข่าวจริง (LIVE)");
    expect(getNewsStatusLabel({ demo: false, live: true, stale: true })).toBe("ข่าวจริง (STALE)");
    expect(getNewsStatusLabel({ demo: true, live: false, stale: false })).toBe("ข่าวเดโม");
  });

  it("does not overclaim live while loading", () => {
    expect(getNewsStatusLabel({ demo: false, live: true, stale: false }, true)).toBe(
      "กำลังดึงข่าวจริง…",
    );
  });
});

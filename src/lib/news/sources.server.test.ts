import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchGdelt } from "./sources.server";

const AS_OF = Date.UTC(2026, 7, 27, 12, 0, 0);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("optional GDELT source", () => {
  it("uses one bounded request with the short gold-linked query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          articles: [
            {
              title: "Gold rises as euro weakens",
              url: "https://example.test/article",
              domain: "example.test",
              seendate: "20260827T115900Z",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGdelt(AS_OF);
    expect(result.error).toBeUndefined();
    expect(result.articles).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("gold+OR+bullion+OR+euro");
    expect(url).not.toContain("XAUEUR");
    expect(init.signal).toBeDefined();
  });

  it("returns an annotation instead of throwing when GDELT is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    await expect(fetchGdelt(AS_OF)).resolves.toMatchObject({ articles: [] });
    const result = await fetchGdelt(AS_OF);
    expect(result.error).toContain("GDELT");
  });
});

import { describe, expect, it } from "vitest";

import { maskEvents, normalizeArticles } from "./normalize";

const AS_OF = Date.UTC(2026, 7, 27, 12, 0, 0);

describe("news normalization", () => {
  it("filters future, irrelevant and duplicate articles deterministically", () => {
    const articles = normalizeArticles(
      [
        {
          title: "Gold prices rise as central bank demand grows",
          url: "https://example.test/a",
          source: "A",
          publishedAt: AS_OF - 1_000,
        },
        {
          title: "Gold prices rise as central bank demand grows",
          url: "https://example.test/b",
          source: "B",
          publishedAt: AS_OF - 2_000,
        },
        {
          title: "Gold prices rise as central bank demand grows",
          url: "https://example.test/a",
          source: "A",
          publishedAt: AS_OF - 3_000,
        },
        {
          title: "Gold prices rise after the close",
          url: "https://example.test/future",
          source: "A",
          publishedAt: AS_OF + 1_000,
        },
        {
          title: "Local sports results",
          url: "https://example.test/irrelevant",
          source: "A",
          publishedAt: AS_OF - 4_000,
        },
      ],
      AS_OF,
    );

    expect(articles).toHaveLength(1);
    expect(articles[0]?.url).toBe("https://example.test/a");
  });

  it("masks actual values for events that have not been released", () => {
    const events = maskEvents(
      [
        {
          id: "past",
          time: AS_OF - 1,
          currency: "USD",
          impact: "high",
          name: "Past event",
          previous: "1",
          forecast: "2",
          actual: "3",
          released: false,
        },
        {
          id: "future",
          time: AS_OF + 1,
          currency: "EUR",
          impact: "high",
          name: "Future event",
          previous: "1",
          forecast: "2",
          actual: "3",
          released: true,
        },
      ],
      AS_OF,
    );

    expect(events).toMatchObject([
      { id: "past", released: true, actual: "3" },
      { id: "future", released: false, actual: null },
    ]);
  });
});

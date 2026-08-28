import { beforeEach, describe, expect, it, vi } from "vitest";

import { archiveNewsArticles, fetchArchivedNews } from "./archive.server";
import type { NewsItem } from "../types";

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "market_news_articles") {
        return {
          upsert: mockUpsert,
          select: mockSelect,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  },
}));

describe("Supabase Historical News Archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({ lte: mockLte });
    mockLte.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
  });

  it("archives live news articles to Supabase market_news_articles table", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const articles: NewsItem[] = [
      {
        id: "nw-1",
        title: "Fed signals potential rate cuts as inflation cools",
        source: "Reuters",
        url: "https://example.com/1",
        publishedAt: 1724800000000,
        tag: "gold_up",
        impact: "high",
      },
    ];

    const archivedCount = await archiveNewsArticles(articles);
    expect(archivedCount).toBe(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        {
          id: "nw-1",
          title: "Fed signals potential rate cuts as inflation cools",
          source: "Reuters",
          url: "https://example.com/1",
          published_at: new Date(1724800000000).toISOString(),
          tag: "gold_up",
          impact: "high",
        },
      ],
      { onConflict: "id", ignoreDuplicates: true },
    );
  });

  it("returns 0 if articles list is empty", async () => {
    const archivedCount = await archiveNewsArticles([]);
    expect(archivedCount).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("handles Supabase error gracefully without throwing", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "Database offline" } });

    const articles: NewsItem[] = [
      {
        id: "nw-2",
        title: "Dollar rallies on strong jobs data",
        source: "Bloomberg",
        url: "https://example.com/2",
        publishedAt: 1724800000000,
        tag: "gold_down",
        impact: "medium",
      },
    ];

    const archivedCount = await archiveNewsArticles(articles);
    expect(archivedCount).toBe(0);
  });

  it("fetches historical news at or before asOf", async () => {
    const asOf = 1724850000000;
    const fakeRows = [
      {
        id: "nw-arch-1",
        title: "Gold hits record high on safe-haven demand",
        source: "Kitco",
        url: "https://example.com/arch-1",
        published_at: new Date(1724840000000).toISOString(),
        tag: "gold_up",
        impact: "high",
      },
    ];

    mockLimit.mockResolvedValue({ data: fakeRows, error: null });

    const result = await fetchArchivedNews(asOf, 24);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("nw-arch-1");
    expect(result[0]?.publishedAt).toBe(1724840000000);
    expect(mockLte).toHaveBeenCalledWith("published_at", new Date(asOf).toISOString());
  });

  it("returns empty array if Supabase query errors", async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: "Table not found" } });

    const result = await fetchArchivedNews(1724850000000, 24);
    expect(result).toEqual([]);
  });
});

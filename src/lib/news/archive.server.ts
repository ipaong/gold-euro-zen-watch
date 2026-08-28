import type { NewsItem } from "../types";
import { recordMetric } from "../observability";

export interface ArchivedArticleRow {
  id: string;
  title: string;
  source: string;
  url: string;
  published_at: string;
  tag: string | null;
  impact: string | null;
}

/**
 * Persist live news articles into the Supabase historical archive.
 * Runs in background (best-effort); failures never block live user requests.
 */
export async function archiveNewsArticles(articles: NewsItem[]): Promise<number> {
  if (!articles.length) return 0;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows: ArchivedArticleRow[] = articles.map((a) => ({
      id: a.id,
      title: a.title,
      source: a.source,
      url: a.url ?? "",
      published_at: new Date(a.publishedAt).toISOString(),
      tag: a.tag ?? null,
      impact: a.impact ?? "low",
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("market_news_articles")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });

    if (error) {
      recordMetric("provider_failure", {
        provider: "supabase_news_archive",
        status: "error",
        error: error.message,
      });
      return 0;
    }

    recordMetric("news_archived", { count: rows.length });
    return rows.length;
  } catch (err) {
    // If Supabase is unreachable or not configured in development, fail silently
    recordMetric("provider_failure", {
      provider: "supabase_news_archive",
      status: "unreachable",
      error: (err as Error).message,
    });
    return 0;
  }
}

/**
 * Retrieve historical news articles from Supabase archive for Time Machine.
 * Returns only articles published at or before `asOf`.
 */
export async function fetchArchivedNews(asOf: number, limit = 24): Promise<NewsItem[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const asOfIso = new Date(asOf).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from("market_news_articles")
      .select("id, title, source, url, published_at, tag, impact")
      .lte("published_at", asOfIso)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error || !Array.isArray(data)) {
      return [];
    }

    return (data as ArchivedArticleRow[])
      .map((row) => ({
        id: row.id,
        title: row.title,
        source: row.source,
        url: row.url,
        publishedAt: Date.parse(row.published_at),
        tag: (row.tag ?? "gold_up") as NewsItem["tag"],
        impact: (row.impact ?? "low") as NewsItem["impact"],
      }))
      .filter((item) => item.title && Number.isFinite(item.publishedAt));
  } catch {
    return [];
  }
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { EconomicEvent, NewsSnapshot } from "./types";
import { recordMetric } from "./observability";

const Input = z.object({ asOf: z.number().finite() });

/** Cache successful source snapshots for an hour; failed reads are never cached. */
export const NEWS_CACHE_TTL_MS = 60 * 60 * 1000;
const LIVE_BUCKET_WINDOW_MS = 2 * 60 * 60 * 1000;

interface CacheEntry {
  at: number;
  snapshot: NewsSnapshot;
}
const cache = new Map<string, CacheEntry>();

export function buildNewsCacheKey(asOf: number, now = Date.now()): string {
  const kind = Math.abs(now - asOf) <= LIVE_BUCKET_WINDOW_MS ? "live" : "historical";
  return `${kind}:${asOf}`;
}

export function maskNewsEventsForAsOf(
  events: EconomicEvent[],
  asOf: number,
): EconomicEvent[] {
  return events.map((event) =>
    event.time <= asOf
      ? event
      : { ...event, actual: null, released: false },
  );
}

export function isSuccessfulNewsSnapshot(snapshot: NewsSnapshot): boolean {
  if (!snapshot.available || snapshot.stale) return false;
  const failedRequiredProvider = (snapshot.providerHealth ?? []).some(
    (provider) => provider.status === "error" && !provider.optional,
  );
  // An optional provider such as GDELT may fail without invalidating the
  // successful official-feed snapshot. AI fallback errors are also safe to
  // cache because the source snapshot itself remains reproducible.
  if (snapshot.providerHealth?.length) return !failedRequiredProvider;
  return !(snapshot.providerErrors?.length ?? 0);
}

/** Keyed by a hash of the normalised news content: no content change, no AI call. */
const aiCache = new Map<string, NewsSnapshot["interpretation"]>();

/**
 * Phase 3: real news + macro → deterministic normalisation → AI interpretation.
 * The result feeds the existing news model (1 of 5 votes). Nothing here can
 * change the final signal.
 */
export const getNewsSnapshot = createServerFn({ method: "POST" })
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<NewsSnapshot> => {
    const now = Date.now();
    const cacheKey = buildNewsCacheKey(data.asOf, now);
    const hit = cache.get(cacheKey);
    if (hit && now - hit.at < NEWS_CACHE_TTL_MS) return hit.snapshot;

    const { fetchAllSources } = await import("./news/sources.server");
    const { normalizeArticles } = await import("./news/normalize");
    const { buildLiveNewsSnapshot } = await import("./news/build-snapshot");

    const raw = await fetchAllSources(data.asOf);
    let headlines = normalizeArticles(raw.articles, data.asOf);
    const events = maskNewsEventsForAsOf(
      raw.events.filter((e) => e.time <= data.asOf + 36 * 60 * 60 * 1000),
      data.asOf,
    );
    const errors = [...raw.errors];

    // Supabase News Archive: auto-persist live news & retrieve historical news for Time Machine
    const isLive = Math.abs(now - data.asOf) <= LIVE_BUCKET_WINDOW_MS;
    try {
      const { archiveNewsArticles, fetchArchivedNews } = await import("./news/archive.server");
      if (isLive && headlines.length > 0) {
        void archiveNewsArticles(headlines);
      } else if (headlines.length === 0 || !isLive) {
        const archived = await fetchArchivedNews(data.asOf, 24);
        if (archived.length > 0) {
          const seen = new Set(headlines.map((h) => h.id));
          const combined = [...headlines];
          for (const item of archived) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              combined.push(item);
            }
          }
          headlines = combined.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 24);
        }
      }
    } catch {
      // Archive is best-effort; failures do not affect live snapshot
    }

    let interpretation: NewsSnapshot["interpretation"] = null;
    if (headlines.length > 0) {
      const key = headlines
        .map((h) => h.id)
        .concat(events.filter((e) => e.time <= data.asOf).map((e) => e.id))
        .join("|");
      if (aiCache.has(key)) {
        interpretation = aiCache.get(key) ?? null;
      } else {
        try {
          const { interpretNews } = await import("./news/interpret.server");
          interpretation = await interpretNews({ headlines, events, asOf: data.asOf });
          aiCache.set(key, interpretation);
          if (aiCache.size > 40) {
            const oldest = aiCache.keys().next().value;
            if (oldest) aiCache.delete(oldest);
          }
        } catch (e) {
          errors.push(`AI: ${(e as Error).message}`);
          recordMetric("ai_fallback", { reason: "news_interpretation_failure" });
        }
      }
    }

    const snapshot = buildLiveNewsSnapshot({
      asOf: data.asOf,
      headlines,
      events,
      interpretation,
      fetchedAt: raw.fetchedAt,
      providers: raw.providers,
      providerErrors: errors,
      providerHealth: raw.providerHealth,
    });

    // Partial/failed reads remain useful to the caller but must be retried
    // next time instead of poisoning the cache for the full TTL.
    if (isSuccessfulNewsSnapshot(snapshot)) {
      cache.set(cacheKey, { at: now, snapshot });
      if (cache.size > 40) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
    }
    return snapshot;
  });

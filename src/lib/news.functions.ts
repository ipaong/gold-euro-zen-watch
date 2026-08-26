import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { NewsSnapshot } from "./types";

const Input = z.object({ asOf: z.number() });

/** 10-minute buckets: the client may re-render freely, we fetch at most once. */
const BUCKET_MS = 10 * 60 * 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  at: number;
  snapshot: NewsSnapshot;
}
const cache = new Map<number, CacheEntry>();
/** Keyed by a hash of the normalised news content: no content change, no AI call. */
const aiCache = new Map<string, NewsSnapshot["interpretation"]>();

/**
 * Phase 3: real news + macro → deterministic normalisation → AI interpretation.
 * The result feeds the existing news model (1 of 5 votes). Nothing here can
 * change the final signal.
 */
export const getNewsSnapshot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<NewsSnapshot> => {
    const bucket = Math.floor(data.asOf / BUCKET_MS) * BUCKET_MS;
    const hit = cache.get(bucket);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.snapshot;

    const { fetchAllSources } = await import("./news/sources.server");
    const { normalizeArticles } = await import("./news/normalize");
    const { buildLiveNewsSnapshot } = await import("./news/build-snapshot");

    const raw = await fetchAllSources(data.asOf);
    const headlines = normalizeArticles(raw.articles, data.asOf);
    const events = raw.events.filter((e) => e.time <= data.asOf + 36 * 60 * 60 * 1000);
    const errors = [...raw.errors];

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
          if (aiCache.size > 40) aiCache.delete(aiCache.keys().next().value as string);
        } catch (e) {
          errors.push(`AI: ${(e as Error).message}`);
        }
      }
    }

    const snapshot = buildLiveNewsSnapshot({
      asOf: data.asOf,
      headlines,
      events,
      interpretation,
      fetchedAt: Date.now(),
      providers: raw.providers,
      providerErrors: errors,
    });

    cache.set(bucket, { at: Date.now(), snapshot });
    if (cache.size > 20) cache.delete(cache.keys().next().value as number);
    return snapshot;
  });

import type { EconomicEvent, NewsItem } from "../types";
import { classifyImpact, classifyTag, isRelevant } from "./keywords";

/** Raw shape every source fetcher produces before normalisation. */
export interface RawArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: number;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\u0e00-\u0e7f ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashId(prefix: string, key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}-${(h >>> 0).toString(36)}`;
}

/**
 * Filter to XAUEUR-relevant articles, drop duplicates (same URL or same
 * normalised title), tag them deterministically and sort newest first.
 */
export function normalizeArticles(raw: RawArticle[], asOf: number, limit = 24): NewsItem[] {
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const out: NewsItem[] = [];

  const sorted = [...raw].sort((a, b) => b.publishedAt - a.publishedAt);
  for (const a of sorted) {
    if (!a.title || !a.url) continue;
    // Time Machine: never expose an article published after the analysis time.
    if (!Number.isFinite(a.publishedAt) || a.publishedAt > asOf) continue;
    if (!isRelevant(a.title)) continue;

    const key = normalizeTitle(a.title);
    if (!key || key.length < 12) continue;
    if (seenUrl.has(a.url) || seenTitle.has(key)) continue;
    seenUrl.add(a.url);
    seenTitle.add(key);

    out.push({
      id: hashId("nw", `${a.source}|${key}`),
      publishedAt: a.publishedAt,
      title: a.title.trim(),
      source: a.source,
      url: a.url,
      tag: classifyTag(a.title),
      impact: classifyImpact(a.title),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Time Machine guard for macro releases: hide the actual until release time. */
export function maskEvents(events: EconomicEvent[], asOf: number): EconomicEvent[] {
  return events
    .map((e) => {
      const released = e.time <= asOf;
      return { ...e, released, actual: released ? e.actual : null };
    })
    .sort((a, b) => a.time - b.time);
}

export { hashId };

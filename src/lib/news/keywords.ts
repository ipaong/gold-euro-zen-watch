import type { Impact, NewsItem } from "../types";

/**
 * Deterministic relevance filter + tagger for live headlines.
 * The AI never invents headlines; this layer only decides which of the
 * fetched articles are about XAUEUR at all, and gives each a rough tag so
 * the app still works when the AI is unavailable.
 */

const GOLD_UP = [
  "gold rises",
  "gold jumps",
  "gold climbs",
  "gold rallies",
  "gold hits record",
  "safe haven",
  "safe-haven",
  "rate cut",
  "dovish",
  "geopolitical tension",
  "war",
  "conflict",
  "escalation",
  "sanctions",
  "recession fear",
  "yields fall",
  "dollar weakens",
  "inflation surges",
];

const GOLD_DOWN = [
  "gold falls",
  "gold slips",
  "gold drops",
  "gold retreats",
  "gold eases",
  "rate hike",
  "hawkish",
  "yields rise",
  "yields climb",
  "dollar strengthens",
  "strong dollar",
  "risk appetite",
  "ceasefire",
  "peace deal",
  "inflation cools",
];

const EUR_UP = [
  "euro rises",
  "euro strengthens",
  "euro gains",
  "ecb hawkish",
  "ecb holds",
  "eurozone growth",
  "euro area growth",
  "hicp rises",
  "german economy improves",
];

const EUR_DOWN = [
  "euro falls",
  "euro weakens",
  "euro slips",
  "ecb cuts",
  "ecb dovish",
  "eurozone slowdown",
  "euro area contraction",
  "german recession",
  "eurozone inflation cools",
];

const RELEVANT = [
  "gold",
  "xau",
  "bullion",
  "precious metal",
  "federal reserve",
  "fed ",
  "fomc",
  "powell",
  "interest rate",
  "rate cut",
  "rate hike",
  "inflation",
  "cpi",
  "pce",
  "treasury yield",
  "yields",
  "dollar",
  "ecb",
  "euro",
  "eurozone",
  "euro area",
  "hicp",
  "lagarde",
  "geopolit",
  "war",
  "conflict",
  "sanctions",
  "safe haven",
  "safe-haven",
];

const HIGH_IMPACT = [
  "fomc",
  "federal reserve",
  "powell",
  "ecb",
  "lagarde",
  "cpi",
  "inflation",
  "rate decision",
  "nonfarm",
  "payrolls",
  "war",
  "attack",
  "sanctions",
  "record high",
];

const MEDIUM_IMPACT = ["yield", "dollar", "gold", "euro", "growth", "gdp", "unemployment"];

function has(text: string, words: string[]): number {
  let hits = 0;
  for (const w of words) if (text.includes(w)) hits++;
  return hits;
}

export function isRelevant(title: string): boolean {
  return has(title.toLowerCase(), RELEVANT) > 0;
}

export function classifyTag(title: string): NewsItem["tag"] {
  const t = title.toLowerCase();
  const scores: Record<NewsItem["tag"], number> = {
    gold_up: has(t, GOLD_UP),
    gold_down: has(t, GOLD_DOWN),
    eur_up: has(t, EUR_UP),
    eur_down: has(t, EUR_DOWN),
  };
  let best: NewsItem["tag"] = "gold_up";
  let bestScore = -1;
  (Object.keys(scores) as NewsItem["tag"][]).forEach((k) => {
    if (scores[k] > bestScore) {
      bestScore = scores[k];
      best = k;
    }
  });
  if (bestScore <= 0) {
    // No directional wording: treat gold-centric news as mildly supportive of
    // gold and EUR-centric news as mildly supportive of EUR, nothing stronger.
    if (t.includes("ecb") || t.includes("euro")) return "eur_up";
    return "gold_up";
  }
  return best;
}

export function classifyImpact(title: string): Impact {
  const t = title.toLowerCase();
  if (has(t, HIGH_IMPACT) > 0) return "high";
  if (has(t, MEDIUM_IMPACT) > 0) return "medium";
  return "low";
}

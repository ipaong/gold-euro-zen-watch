import type {
  Direction,
  EconomicEvent,
  EurBias,
  GoldBias,
  Impact,
  NewsInterpretation,
  NewsItem,
  NewsSnapshot,
  RiskLevel,
} from "../types";
import { maskEvents } from "./normalize";
import { recordMetric } from "../observability";

const FRESH_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Deterministic tag-weighted reading, used when AI is unavailable. */
export function ruleBias(headlines: NewsItem[]): {
  goldBias: GoldBias;
  eurBias: EurBias;
  netBias: Direction;
  netStrength: number;
} {
  const impactWeight: Record<Impact, number> = { high: 1, medium: 0.6, low: 0.3 };
  let gold = 0;
  let eur = 0;
  headlines.forEach((n, i) => {
    const recency = Math.max(0.25, 1 - i * 0.08);
    const w = impactWeight[n.impact] * recency;
    if (n.tag === "gold_up") gold += w;
    if (n.tag === "gold_down") gold -= w;
    if (n.tag === "eur_up") eur += w;
    if (n.tag === "eur_down") eur -= w;
  });
  const goldBias: GoldBias = gold > 1.2 ? "bullish" : gold < -1.2 ? "bearish" : "neutral";
  const eurBias: EurBias = eur > 1.2 ? "strong" : eur < -1.2 ? "weak" : "neutral";
  const net = gold - eur;
  return {
    goldBias,
    eurBias,
    netBias: net > 1 ? "BUY" : net < -1 ? "SELL" : "WAIT",
    netStrength: Math.min(1, Math.abs(net) / 3),
  };
}

export interface LiveSnapshotInput {
  asOf: number;
  headlines: NewsItem[];
  events: EconomicEvent[];
  interpretation: NewsInterpretation | null;
  fetchedAt: number;
  providers: string[];
  providerErrors: string[];
  providerHealth?: NewsSnapshot["providerHealth"];
}

/**
 * Builds the NewsSnapshot the rest of the engine already understands.
 * The AI interpretation (when present) only sets the bias fields — the
 * deterministic news model and the quality gate still decide everything else.
 */
export function buildLiveNewsSnapshot(input: LiveSnapshotInput): NewsSnapshot {
  const { asOf, headlines, interpretation } = input;
  const events = maskEvents(input.events, asOf).filter((e) => e.time <= asOf + 36 * 60 * 60 * 1000);
  const recent = events
    .filter((e) => e.released)
    .slice(-6)
    .reverse();
  const upcoming = events.filter((e) => !e.released).slice(0, 8);
  const requiredProviderFailed = (input.providerHealth ?? []).some(
    (provider) => provider.status === "error" && !provider.optional,
  );
  const providerFailed = (input.providerErrors ?? []).length > 0;
  const fallbackReason = providerFailed
    ? `แหล่งข้อมูลหรือขั้นตอนบางรายใช้งานไม่ได้: ${input.providerErrors.join(" · ")}`
    : !interpretation && headlines.length > 0
      ? "AI ตีความข่าวไม่ได้ จึงใช้กติกาแบบ deterministic แทน"
      : undefined;

  const rules = ruleBias(headlines);
  const goldBias = interpretation?.goldBias ?? rules.goldBias;
  const eurBias = interpretation?.eurBias ?? rules.eurBias;
  const netBias = interpretation?.xaueurBias ?? rules.netBias;
  const netStrength = interpretation
    ? Math.max(0, Math.min(1, interpretation.confidence / 100))
    : rules.netStrength;

  const newest = headlines[0]?.publishedAt ?? 0;
  const stale = requiredProviderFailed || headlines.length === 0 || asOf - newest > FRESH_WINDOW_MS;
  if (stale) {
    recordMetric("stale_news", {
      providerFailures: requiredProviderFailed,
      headlineCount: headlines.length,
    });
  }

  const nextHigh = upcoming.find((e) => e.impact === "high") ?? null;
  const minutesToHighImpact = nextHigh ? Math.round((nextHigh.time - asOf) / 60000) : null;

  // No official free "scheduled release" feed is used, so calendar risk is
  // derived from how much fresh high-impact coverage just landed.
  const hotHigh = headlines.filter(
    (h) => h.impact === "high" && asOf - h.publishedAt <= 2 * 60 * 60 * 1000,
  ).length;
  let riskLevel: RiskLevel = "low";
  if (minutesToHighImpact !== null && minutesToHighImpact <= 30) riskLevel = "high";
  else if (hotHigh >= 3) riskLevel = "high";
  else if (hotHigh >= 1 || (minutesToHighImpact !== null && minutesToHighImpact <= 120))
    riskLevel = "medium";

  return {
    asOf,
    available: headlines.length > 0 || recent.length > 0 || upcoming.length > 0,
    demo: false,
    // A stale or required-provider-degraded snapshot must not be presented as LIVE.
    live: !stale,
    stale,
    fetchedAt: input.fetchedAt,
    providers: input.providers,
    providerErrors: input.providerErrors,
    ...(input.providerHealth ? { providerHealth: input.providerHealth } : {}),
    ...(fallbackReason ? { fallbackReason } : {}),
    interpretation,
    headlines,
    goldBias,
    eurBias,
    netBias,
    netStrength,
    upcoming,
    recent,
    minutesToHighImpact,
    nextHighImpact: nextHigh,
    riskLevel,
  };
}

import demo from "../../data/demo-news.json";
import type { EconomicEvent, EurBias, GoldBias, Impact, NewsItem, NewsSnapshot, RiskLevel } from "../types";
import type { NewsProvider } from "./provider";

interface RawEvent {
  id: string;
  time: number;
  currency: string;
  impact: string;
  name: string;
  previous: string;
  forecast: string;
  actual: string;
}

const rawNews = demo.news as NewsItem[];
const rawEvents = demo.events as RawEvent[];

const LOOK_AHEAD_DEFAULT = 36 * 60 * 60 * 1000;

function maskEvent(e: RawEvent, asOf: number): EconomicEvent {
  const released = e.time <= asOf;
  return {
    id: e.id,
    time: e.time,
    currency: e.currency as "USD" | "EUR",
    impact: e.impact as Impact,
    name: e.name,
    previous: e.previous,
    forecast: e.forecast,
    // No look-ahead: the actual number does not exist before the release time.
    actual: released ? e.actual : null,
    released,
  };
}

export const frozenNewsProvider: NewsProvider = {
  id: "frozen-demo-news",
  label: "ข่าวเดโม (ตรึงค่า)",
  demo: true,

  getNewsUpTo(timestamp, limit = 12) {
    const visible = rawNews.filter((n) => n.publishedAt <= timestamp);
    return visible.slice(-limit).reverse();
  },

  getEventsUpTo(timestamp, lookAheadMs = LOOK_AHEAD_DEFAULT) {
    return rawEvents
      .filter((e) => e.time <= timestamp + lookAheadMs)
      .map((e) => maskEvent(e, timestamp))
      .sort((a, b) => a.time - b.time);
  },

  buildSnapshot(timestamp) {
    const headlines = this.getNewsUpTo(timestamp, 10);
    const events = this.getEventsUpTo(timestamp);
    const recent = events.filter((e) => e.released).slice(-6).reverse();
    const upcoming = events.filter((e) => !e.released).slice(0, 8);

    // Weight recent headlines: newer + higher impact count more.
    let gold = 0;
    let eur = 0;
    const impactWeight: Record<Impact, number> = { high: 1, medium: 0.6, low: 0.3 };
    headlines.forEach((n, i) => {
      const recency = Math.max(0.25, 1 - i * 0.12);
      const w = impactWeight[n.impact] * recency;
      if (n.tag === "gold_up") gold += w;
      if (n.tag === "gold_down") gold -= w;
      if (n.tag === "eur_up") eur += w;
      if (n.tag === "eur_down") eur -= w;
    });

    const goldBias: GoldBias = gold > 0.6 ? "bullish" : gold < -0.6 ? "bearish" : "neutral";
    const eurBias: EurBias = eur > 0.6 ? "strong" : eur < -0.6 ? "weak" : "neutral";

    // XAUEUR = gold priced in EUR: bullish gold and/or weak EUR pushes it up.
    const net = gold - eur;
    const netStrength = Math.min(1, Math.abs(net) / 2.2);
    const netBias = net > 0.5 ? "BUY" : net < -0.5 ? "SELL" : "WAIT";

    const nextHigh = upcoming.find((e) => e.impact === "high") ?? null;
    const minutesToHighImpact = nextHigh ? Math.round((nextHigh.time - timestamp) / 60000) : null;

    let riskLevel: RiskLevel = "low";
    if (minutesToHighImpact !== null && minutesToHighImpact <= 30) riskLevel = "high";
    else if (minutesToHighImpact !== null && minutesToHighImpact <= 120) riskLevel = "medium";
    else if (upcoming.some((e) => e.impact === "medium" && e.time - timestamp <= 60 * 60 * 1000))
      riskLevel = "medium";

    return {
      asOf: timestamp,
      available: headlines.length > 0,
      demo: true,
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
    } satisfies NewsSnapshot;
  },
};

export const newsProvider = frozenNewsProvider;

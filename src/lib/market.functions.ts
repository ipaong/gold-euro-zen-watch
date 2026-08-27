import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { ProviderHealth } from "./types";
import { recordMetric } from "./observability";
import {
  normalizeProviderCandle,
  validateMarketDataFeed,
  type MarketDataFeed,
  type MarketDataValidation,
} from "./market/contract";
import { findEnabledMarketAsset, type MarketAsset } from "./market/assets";
import { GOLD_API_SOURCE, GOLD_API_VERSION } from "./market/goldapi";
import { evaluateGoldFeedReadiness } from "./market/readiness";
import { MIN_WARMUP_CANDLES } from "./market/provider";
import {
  parseYahooChartResponse,
  yahooRangeFor,
  YAHOO_CHART_ENDPOINT,
  YAHOO_SOURCE,
  YAHOO_VERSION,
  type YahooChartResponse,
} from "./market/yahoo";
import { feedFromXmRows, XM_MT5_SOURCE, XM_MT5_VERSION } from "./market/xm";

const Input = z.object({ requestedAt: z.number().finite().optional() });
const YahooInput = z.object({
  assetId: z.string().optional(),
  timeframe: z.enum(["1m", "5m", "15m", "1h", "1d"]).optional(),
  requestedAt: z.number().finite().optional(),
});
const MARKET_READ_LIMIT = 600;
const YAHOO_REQUEST_TIMEOUT_MS = 8_000;
const YAHOO_CACHE_MS = 60_000;

export interface MarketFeedResult {
  feed: MarketDataFeed | null;
  validation: MarketDataValidation | null;
  health: ProviderHealth;
  /** Number of closed source candles available, including an incomplete warmup set. */
  candleCount: number;
  requiredCandles: number;
  fallbackReason?: string;
}

interface MarketCandleRow {
  source: unknown;
  version: unknown;
  symbol: unknown;
  timeframe: unknown;
  bucket_start: unknown;
  open: unknown;
  high: unknown;
  low: unknown;
  close: unknown;
  last_sample_at: unknown;
  is_closed: unknown;
}

function providerHealth(
  id: string,
  version: string,
  status: ProviderHealth["status"],
  fetchedAt: number,
  error?: string,
): ProviderHealth {
  return {
    id,
    version,
    status,
    fetchedAt,
    optional: false,
    ...(error ? { error } : {}),
  };
}

function safeError(error: unknown, fallback = "ไม่สามารถอ่านข้อมูลตลาดได้"): string {
  const message = error instanceof Error && error.message.trim() ? error.message : fallback;
  return message.slice(0, 240);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("row ไม่ใช่ object");
  return value as Record<string, unknown>;
}

function asPositiveNumber(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} ไม่ใช่จำนวนบวก`);
  return parsed;
}

function asUtcMs(value: unknown, field: string): number {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} ไม่มีค่า`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`${field} ไม่ใช่ timestamp ที่ถูกต้อง`);
  return parsed;
}

function takeLastCandles(feed: MarketDataFeed, limit = MARKET_READ_LIMIT): MarketDataFeed {
  if (feed.candles.length <= limit) return feed;
  return { ...feed, candles: feed.candles.slice(-limit) };
}

export function resultFromValidatedFeed(
  feed: MarketDataFeed,
  now: number,
  requiredCandles = MIN_WARMUP_CANDLES,
  fallbackAction = "จึงยังใช้ DEMO fallback",
): MarketFeedResult {
  const validation = validateMarketDataFeed(feed, now);
  if (!validation.valid) {
    const reason = `${feed.displayName} ไม่ผ่าน validation: ${validation.errors.slice(0, 3).join("; ")}`;
    recordMetric("provider_failure", { provider: feed.source, reason });
    return {
      feed: null,
      validation,
      health: providerHealth(feed.source, "1.0.0", "error", feed.fetchedAt || now, reason),
      candleCount: feed.candles.length,
      requiredCandles,
      fallbackReason: reason,
    };
  }

  const readiness = evaluateGoldFeedReadiness(feed.candles.length, validation, requiredCandles);
  if (readiness.mode === "fallback") {
    recordMetric("provider_failure", { provider: feed.source, reason: readiness.reason });
    const reason = `${readiness.reason} ${fallbackAction}`;
    return {
      feed: null,
      validation,
      health: providerHealth(feed.source, "1.0.0", "error", feed.fetchedAt || now, reason),
      candleCount: feed.candles.length,
      requiredCandles,
      fallbackReason: reason,
    };
  }
  if (readiness.mode === "warming") {
    return {
      feed: null,
      validation,
      health: providerHealth(
        feed.source,
        "1.0.0",
        "empty",
        feed.fetchedAt || now,
        readiness.reason,
      ),
      candleCount: feed.candles.length,
      requiredCandles,
      fallbackReason: readiness.reason,
    };
  }

  return {
    feed,
    validation,
    health: providerHealth(feed.source, "1.0.0", "ok", feed.fetchedAt || now),
    candleCount: feed.candles.length,
    requiredCandles,
  };
}

interface MarketCandleQuery {
  select(columns: string): MarketCandleQuery;
  eq(column: string, value: string | boolean): MarketCandleQuery;
  order(
    column: string,
    options: { ascending: boolean },
  ): {
    limit(count: number): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
  };
}

const fromMarketCandles = (supabase: unknown, table = "market_candles") =>
  // The generated client intentionally predates these forward-only tables.
  // Keep the cast local instead of editing src/integrations/supabase/types.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase as any).from(table) as MarketCandleQuery;

function parseCandleRow(raw: unknown) {
  const row = asRecord(raw) as unknown as MarketCandleRow;
  if (row.source !== GOLD_API_SOURCE || row.version !== GOLD_API_VERSION) {
    throw new Error("Supabase candle source/version ไม่ตรงกับ Gold API contract");
  }
  if (row.symbol !== "XAUEUR" || row.timeframe !== "M15" || row.is_closed !== true) {
    throw new Error("Supabase ส่ง candle ที่ไม่ใช่ XAUEUR M15 closed candle");
  }
  const time = asUtcMs(row.bucket_start, "bucket_start");
  const normalized = normalizeProviderCandle({
    time,
    open: asPositiveNumber(row.open, "open"),
    high: asPositiveNumber(row.high, "high"),
    low: asPositiveNumber(row.low, "low"),
    close: asPositiveNumber(row.close, "close"),
    complete: true,
    sourceSymbol: "XAU/EUR",
  });
  return { normalized, lastSampleAt: asUtcMs(row.last_sample_at, "last_sample_at") };
}

/**
 * Legacy Gold API read path. It remains available for historical migrations,
 * but the active dashboard now prefers the Yahoo provider below.
 */
export const getGoldApiMarketFeed = createServerFn({ method: "POST" })
  .validator((input: unknown) => Input.parse(input))
  .handler(async (): Promise<MarketFeedResult> => {
    const now = Date.now();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await fromMarketCandles(supabaseAdmin)
        .select(
          "source, version, symbol, timeframe, bucket_start, open, high, low, close, last_sample_at, is_closed",
        )
        .eq("source", GOLD_API_SOURCE)
        .eq("version", GOLD_API_VERSION)
        .eq("symbol", "XAUEUR")
        .eq("timeframe", "M15")
        .eq("is_closed", true)
        .order("bucket_start", { ascending: false })
        .limit(MARKET_READ_LIMIT);

      if (error) throw new Error(error.message);
      const parsed = (rows ?? [])
        .map(parseCandleRow)
        .sort((a, b) => a.normalized.t - b.normalized.t);
      const candles = parsed.map(({ normalized }) => normalized);
      const lastSampleAt = parsed.reduce((latest, row) => Math.max(latest, row.lastSampleAt), 0);
      const feed: MarketDataFeed = {
        symbol: "XAUEUR",
        providerSymbol: "XAU/EUR",
        displayName: "Gold Spot / Euro (Gold API)",
        timeframe: "M15",
        intervalMs: 15 * 60 * 1000,
        source: GOLD_API_SOURCE,
        sourceType: "live",
        delayed: false,
        demo: false,
        fetchedAt: lastSampleAt || now,
        candles,
      };
      return resultFromValidatedFeed(feed, now);
    } catch (error) {
      const reason = safeError(error, "ไม่สามารถอ่านข้อมูล Gold API จาก Supabase ได้");
      recordMetric("provider_failure", { provider: GOLD_API_SOURCE, reason });
      return {
        feed: null,
        validation: null,
        health: providerHealth(GOLD_API_SOURCE, GOLD_API_VERSION, "error", now, reason),
        candleCount: 0,
        requiredCandles: MIN_WARMUP_CANDLES,
        fallbackReason: reason,
      };
    }
  });

/**
 * XM Live read path. It only returns candles written by the MT5 bridge. There
 * is intentionally no Yahoo or frozen-provider fallback inside this function:
 * selecting XM must never silently change the instrument or source.
 */
export const getXmMarketFeed = createServerFn({ method: "POST" })
  .validator((input: unknown) => Input.parse(input))
  .handler(async (): Promise<MarketFeedResult> => {
    // Freshness and future checks must use server time, never browser input.
    const now = Date.now();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await fromMarketCandles(
        supabaseAdmin,
        "xm_market_candles",
      )
        .select("source, version, symbol, timeframe, bucket_start, open, high, low, close, is_closed")
        .eq("source", XM_MT5_SOURCE)
        .eq("version", XM_MT5_VERSION)
        .eq("symbol", "GOLD")
        .eq("timeframe", "15m")
        .eq("is_closed", true)
        .order("bucket_start", { ascending: false })
        .limit(MARKET_READ_LIMIT);

      if (error) throw new Error(error.message);
      const feed = feedFromXmRows(rows ?? [], now);
      return resultFromValidatedFeed(feed, now, MIN_WARMUP_CANDLES, "จึงหยุดการวิเคราะห์");
    } catch (error) {
      const reason = safeError(error, "ไม่สามารถอ่านข้อมูล XM GOLD จาก Supabase ได้");
      recordMetric("provider_failure", { provider: XM_MT5_SOURCE, reason });
      return {
        feed: null,
        validation: null,
        health: providerHealth(XM_MT5_SOURCE, XM_MT5_VERSION, "error", now, reason),
        candleCount: 0,
        requiredCandles: MIN_WARMUP_CANDLES,
        fallbackReason: reason,
      };
    }
  });

type YahooCacheEntry = { expiresAt: number; feed: MarketDataFeed };
const yahooCache = new Map<string, YahooCacheEntry>();

export function buildYahooChartUrl(
  asset: MarketAsset,
  timeframe: Exclude<MarketAsset["defaultTimeframe"], "M15">,
): string {
  const url = new URL(`${YAHOO_CHART_ENDPOINT}/${encodeURIComponent(asset.providerSymbol)}`);
  url.search = new URLSearchParams({
    interval: timeframe,
    range: yahooRangeFor(timeframe),
    events: "div,splits",
  }).toString();
  return url.toString();
}

async function fetchYahooFeed(
  asset: MarketAsset,
  timeframe: Exclude<MarketAsset["defaultTimeframe"], "M15">,
  now: number,
): Promise<MarketDataFeed> {
  const key = `${asset.id}:${timeframe}`;
  const cached = yahooCache.get(key);
  if (cached && cached.expiresAt > now) return cached.feed;
  if (cached) yahooCache.delete(key);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YAHOO_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(buildYahooChartUrl(asset, timeframe), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (response.status === 429) throw new Error("Yahoo rate limit (429) — รอก่อนแล้วลองใหม่");
    if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
    const payload = (await response.json()) as YahooChartResponse;
    const feed = takeLastCandles(
      parseYahooChartResponse(payload, {
        symbol: asset.providerSymbol,
        displayName: asset.displayName,
        timeframe,
        fetchedAt: now,
      }),
    );
    yahooCache.set(key, { expiresAt: now + YAHOO_CACHE_MS, feed });
    return feed;
  } finally {
    clearTimeout(timeout);
  }
}

export function clearYahooMarketFeedCache(): void {
  yahooCache.clear();
}

/**
 * Active read-only provider route. Yahoo is deliberately queried only on the
 * server, and a failed/insufficient Yahoo response becomes an explicit DEMO
 * fallback rather than silently borrowing a different instrument.
 */
export const getYahooMarketFeed = createServerFn({ method: "POST" })
  .validator((input: unknown) => YahooInput.parse(input))
  .handler(async ({ data }): Promise<MarketFeedResult> => {
    const now = Date.now();
    const asset = findEnabledMarketAsset(data.assetId);
    if (!asset) {
      const reason = `asset ${data.assetId ?? "ว่าง"} ยังไม่เปิดใช้งานหรือยัง validate ไม่ครบ`;
      return {
        feed: null,
        validation: null,
        health: providerHealth(YAHOO_SOURCE, YAHOO_VERSION, "error", now, reason),
        candleCount: 0,
        requiredCandles: MIN_WARMUP_CANDLES,
        fallbackReason: reason,
      };
    }
    const timeframe = data.timeframe ?? asset.defaultTimeframe;
    if (!asset.supportedIntervals.includes(timeframe)) {
      const reason = `${asset.displayName} ไม่รองรับ timeframe ${timeframe}`;
      return {
        feed: null,
        validation: null,
        health: providerHealth(YAHOO_SOURCE, YAHOO_VERSION, "error", now, reason),
        candleCount: 0,
        requiredCandles: MIN_WARMUP_CANDLES,
        fallbackReason: reason,
      };
    }

    try {
      const feed = await fetchYahooFeed(asset, timeframe, now);
      const result = resultFromValidatedFeed(feed, now);
      return {
        ...result,
        health: { ...result.health, id: YAHOO_SOURCE, version: YAHOO_VERSION },
      };
    } catch (error) {
      const reason = safeError(error, "ไม่สามารถอ่านข้อมูล Yahoo Chart ได้");
      recordMetric("provider_failure", { provider: YAHOO_SOURCE, reason });
      return {
        feed: null,
        validation: null,
        health: providerHealth(YAHOO_SOURCE, YAHOO_VERSION, "error", now, reason),
        candleCount: 0,
        requiredCandles: MIN_WARMUP_CANDLES,
        fallbackReason: reason,
      };
    }
  });

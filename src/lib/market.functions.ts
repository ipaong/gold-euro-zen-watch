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
import { GOLD_API_SOURCE, GOLD_API_VERSION } from "./market/goldapi";
import { evaluateGoldFeedReadiness } from "./market/readiness";
import { MIN_WARMUP_CANDLES } from "./market/provider";

const Input = z.object({ requestedAt: z.number().finite().optional() });
const MARKET_READ_LIMIT = 600;

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
  status: ProviderHealth["status"],
  fetchedAt: number,
  error?: string,
): ProviderHealth {
  return {
    id: GOLD_API_SOURCE,
    version: GOLD_API_VERSION,
    status,
    fetchedAt,
    optional: false,
    ...(error ? { error } : {}),
  };
}

function safeError(error: unknown): string {
  const message = error instanceof Error && error.message.trim() ? error.message : "ไม่สามารถอ่านข้อมูล Gold API จาก Supabase ได้";
  return message.slice(0, 240);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("row ไม่ใช่ object");
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
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} ไม่ใช่ timestamp ที่ถูกต้อง`);
  return parsed;
}

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

const fromMarketCandles = (supabase: unknown) =>
  // The generated client intentionally predates this forward-only table.
  // Keep the cast local instead of editing src/integrations/supabase/types.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase as any).from("market_candles") as MarketCandleQuery;

/**
 * Read only closed candles that the Edge Function has already persisted. No
 * browser request ever calls Gold API directly and no provider secret enters
 * this result.
 */
export const getGoldApiMarketFeed = createServerFn({ method: "POST" })
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<MarketFeedResult> => {
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
      const parsed = (rows ?? []).map(parseCandleRow).sort((a, b) => a.normalized.t - b.normalized.t);
      const candles = parsed.map(({ normalized }) => normalized);
      const lastSampleAt = parsed.reduce(
        (latest, row) => Math.max(latest, row.lastSampleAt),
        0,
      );
      const feed: MarketDataFeed = {
        symbol: "XAUEUR",
        timeframe: "M15",
        source: GOLD_API_SOURCE,
        demo: false,
        fetchedAt: lastSampleAt,
        candles,
      };
      const validation: MarketDataValidation = candles.length
        ? validateMarketDataFeed(feed, now)
        : { valid: true, stale: false, errors: [], warnings: [] };
      if (!validation.valid) {
        const reason = `ข้อมูล Gold API ใน Supabase ไม่ผ่าน validation: ${validation.errors.slice(0, 3).join("; ")}`;
        recordMetric("provider_failure", { provider: GOLD_API_SOURCE, reason });
        return {
          feed: null,
          validation,
          health: providerHealth("error", lastSampleAt || now, reason),
          candleCount: candles.length,
          requiredCandles: MIN_WARMUP_CANDLES,
          fallbackReason: reason,
        };
      }

      const readiness = evaluateGoldFeedReadiness(candles.length, validation);
      if (readiness.mode === "fallback") {
        recordMetric("provider_failure", {
          provider: GOLD_API_SOURCE,
          reason: validation.stale ? "stale_feed" : "invalid_feed",
        });
        const reason = `${readiness.reason} จึงยังใช้ DEMO fallback`;
        return {
          feed: null,
          validation,
          health: providerHealth("error", lastSampleAt || now, reason),
          candleCount: candles.length,
          requiredCandles: MIN_WARMUP_CANDLES,
          fallbackReason: reason,
        };
      }

      if (readiness.mode === "warming") {
        return {
          feed: null,
          validation,
          health: providerHealth("empty", lastSampleAt || now, readiness.reason),
          candleCount: candles.length,
          requiredCandles: MIN_WARMUP_CANDLES,
          fallbackReason: readiness.reason,
        };
      }

      return {
        feed,
        validation,
        health: providerHealth("ok", lastSampleAt || now),
        candleCount: candles.length,
        requiredCandles: MIN_WARMUP_CANDLES,
      };
    } catch (error) {
      const reason = safeError(error);
      recordMetric("provider_failure", { provider: GOLD_API_SOURCE, reason });
      return {
        feed: null,
        validation: null,
        health: providerHealth("error", now, reason),
        candleCount: 0,
        requiredCandles: MIN_WARMUP_CANDLES,
        fallbackReason: reason,
      };
    }
  });

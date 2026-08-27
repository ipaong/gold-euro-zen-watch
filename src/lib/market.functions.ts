import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { ProviderHealth } from "./types";
import { recordMetric } from "./observability";
import {
  validateMarketDataFeed,
  type MarketDataFeed,
  type MarketDataValidation,
} from "./market/contract";
import { M15_MS, MIN_WARMUP_CANDLES } from "./market/provider";
import {
  parseTwelveDataTimeSeries,
  TWELVEDATA_INTERVAL,
  TWELVEDATA_SYMBOL,
} from "./market/twelvedata";

const Input = z.object({ requestedAt: z.number().finite().optional() });

export const TWELVEDATA_CACHE_TTL_MS = 60 * 1000;
const TWELVEDATA_TIMEOUT_MS = 8 * 1000;
const TWELVEDATA_PROVIDER_ID = "twelvedata-xau-eur";
const TWELVEDATA_VERSION = "1.0.0";

export interface MarketFeedResult {
  feed: MarketDataFeed | null;
  validation: MarketDataValidation | null;
  health: ProviderHealth;
  fallbackReason?: string;
}

interface CacheEntry {
  at: number;
  result: MarketFeedResult;
}

let cache: CacheEntry | null = null;

function health(status: ProviderHealth["status"], fetchedAt: number, error?: string): ProviderHealth {
  return {
    id: TWELVEDATA_PROVIDER_ID,
    version: TWELVEDATA_VERSION,
    status,
    fetchedAt,
    optional: false,
    ...(error ? { error } : {}),
  };
}

function safeError(error: unknown, secret?: string): string {
  const message = error instanceof Error && error.message.trim() ? error.message : "ไม่สามารถอ่านข้อมูล Twelve Data ได้";
  return message.replaceAll(secret ?? "\u0000", "[redacted]").slice(0, 240);
}

/**
 * Server-only market read. The API key is deliberately read from the server
 * environment and never included in a client bundle or returned in a result.
 */
export const getTwelveDataFeed = createServerFn({ method: "POST" })
  .validator((input: unknown) => Input.parse(input))
  .handler(async (): Promise<MarketFeedResult> => {
    const now = Date.now();
    if (cache && now - cache.at < TWELVEDATA_CACHE_TTL_MS) return cache.result;

    const apiKey = process.env["TWELVEDATA_API_KEY"]?.trim();
    if (!apiKey) {
      const reason = "ยังไม่ได้ตั้งค่า TWELVEDATA_API_KEY ใน server secrets";
      recordMetric("provider_failure", { provider: TWELVEDATA_PROVIDER_ID, reason: "missing_api_key" });
      const result: MarketFeedResult = {
        feed: null,
        validation: null,
        health: health("error", now, reason),
        fallbackReason: reason,
      };
      return result;
    }

    try {
      const query = new URLSearchParams({
        symbol: TWELVEDATA_SYMBOL,
        interval: TWELVEDATA_INTERVAL,
        timezone: "UTC",
        outputsize: "600",
        apikey: apiKey,
      });
      const response = await fetch(`https://api.twelvedata.com/time_series?${query}`, {
        headers: { accept: "application/json", "user-agent": "XAUEUR-Signal-Lab/1.0" },
        signal: AbortSignal.timeout(TWELVEDATA_TIMEOUT_MS),
      });
      const payload = (await response.json()) as Parameters<typeof parseTwelveDataTimeSeries>[0];
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const feed = parseTwelveDataTimeSeries(payload, now);
      if (feed.candles.length < MIN_WARMUP_CANDLES) {
        throw new Error(
          `ข้อมูล Twelve Data ย้อนหลังไม่พอ: ได้ ${feed.candles.length} แท่ง ต้องการอย่างน้อย ${MIN_WARMUP_CANDLES} แท่ง`,
        );
      }
      const baseValidation = validateMarketDataFeed(feed, now);
      if (!baseValidation.valid) {
        throw new Error(
          `ข้อมูล Twelve Data ไม่ผ่าน validation: ${baseValidation.errors.slice(0, 3).join("; ")}`,
        );
      }
      const lastCandle = feed.candles[feed.candles.length - 1];
      const candleAgeMs = lastCandle ? now - (lastCandle.t + M15_MS) : Infinity;
      const candleStale = candleAgeMs > 2 * M15_MS;
      const validation: MarketDataValidation = {
        ...baseValidation,
        stale: baseValidation.stale || candleStale,
        warnings: candleStale
          ? [...baseValidation.warnings, "แท่งล่าสุดเก่ากว่า 2 ช่วง M15"]
          : baseValidation.warnings,
      };
      const result: MarketFeedResult = {
        feed,
        validation,
        health: health("ok", now),
      };
      cache = { at: now, result };
      return result;
    } catch (error) {
      const reason = safeError(error, apiKey);
      recordMetric("provider_failure", { provider: TWELVEDATA_PROVIDER_ID, reason });
      return {
        feed: null,
        validation: null,
        health: health("error", now, reason),
        fallbackReason: reason,
      };
    }
  });

export function clearTwelveDataCache(): void {
  cache = null;
}

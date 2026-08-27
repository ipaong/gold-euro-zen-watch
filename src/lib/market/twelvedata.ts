import { M15_MS } from "./provider";
import {
  normalizeProviderCandle,
  validateMarketDataFeed,
  type MarketDataFeed,
} from "./contract";

export const TWELVEDATA_SYMBOL = "XAU/EUR" as const;
export const TWELVEDATA_INTERVAL = "15min" as const;
export const TWELVEDATA_SOURCE = "twelvedata" as const;

interface TwelveDataValue {
  datetime?: string;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  is_complete?: boolean;
  complete?: boolean;
}

export interface TwelveDataTimeSeriesResponse {
  status?: string;
  message?: string;
  code?: number;
  meta?: {
    symbol?: string;
    interval?: string;
  };
  values?: TwelveDataValue[];
}

function canonicalSymbol(symbol: string): string {
  return symbol.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function parseUtcDatetime(value: string): number {
  const trimmed = value.trim();
  const iso = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
  const timestamp = Date.parse(withZone);
  if (!Number.isFinite(timestamp)) throw new Error("datetime ไม่ใช่ UTC ที่ถูกต้อง");
  return timestamp;
}

function parsePrice(value: string | number | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("OHLC มีค่าไม่ถูกต้อง");
  return parsed;
}

function responseError(response: TwelveDataTimeSeriesResponse): string {
  const code = response.code ? ` (${response.code})` : "";
  return `Twelve Data ตอบกลับข้อผิดพลาด${code}: ${response.message ?? "ไม่ทราบสาเหตุ"}`;
}

/**
 * Convert Twelve Data's descending string-valued response into the app's
 * normalized contract. Twelve Data does not need to be trusted for the
 * current candle flag: a candle is closed only after its 15-minute interval
 * has ended in UTC.
 */
export function parseTwelveDataTimeSeries(
  response: TwelveDataTimeSeriesResponse,
  fetchedAt: number,
): MarketDataFeed {
  if (response.status === "error" || !Array.isArray(response.values)) {
    throw new Error(responseError(response));
  }

  const sourceSymbol = response.meta?.symbol?.trim() ?? "";
  if (canonicalSymbol(sourceSymbol) !== canonicalSymbol(TWELVEDATA_SYMBOL)) {
    throw new Error(`Twelve Data ส่ง symbol ไม่ตรง: ${sourceSymbol || "ว่าง"}`);
  }
  if (response.meta?.interval && response.meta.interval !== TWELVEDATA_INTERVAL) {
    throw new Error(`Twelve Data ส่ง interval ไม่ตรง: ${response.meta.interval}`);
  }
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) {
    throw new Error("เวลาที่รับข้อมูลไม่ถูกต้อง");
  }

  const parsed = response.values
    .map((row) => {
      const time = parseUtcDatetime(row.datetime ?? "");
      const completeFromProvider = row.is_complete ?? row.complete;
      const complete =
        typeof completeFromProvider === "boolean"
          ? completeFromProvider && time + M15_MS <= fetchedAt
          : time + M15_MS <= fetchedAt;
      return normalizeProviderCandle({
        time,
        open: parsePrice(row.open),
        high: parsePrice(row.high),
        low: parsePrice(row.low),
        close: parsePrice(row.close),
        complete,
        sourceSymbol,
      });
    })
    .filter((candle) => candle.closed)
    .sort((a, b) => a.t - b.t);

  const feed: MarketDataFeed = {
    symbol: "XAUEUR",
    providerSymbol: TWELVEDATA_SYMBOL,
    displayName: "Gold Spot / Euro (legacy Twelve Data)",
    timeframe: "M15",
    intervalMs: M15_MS,
    source: TWELVEDATA_SOURCE,
    sourceType: "delayed",
    delayed: true,
    demo: false,
    fetchedAt,
    candles: parsed,
  };
  const validation = validateMarketDataFeed(feed, fetchedAt);
  if (!validation.valid) {
    throw new Error(`ข้อมูล Twelve Data ไม่ผ่าน validation: ${validation.errors.slice(0, 3).join("; ")}`);
  }
  return feed;
}

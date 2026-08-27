import { normalizeProviderCandle, type MarketDataCandle, type MarketDataFeed } from "./contract";

export const XM_MT5_SOURCE = "xm-mt5" as const;
export const XM_MT5_VERSION = "1.0.0" as const;
export const XM_MT5_SYMBOL = "GOLD" as const;
export const XM_MT5_TIMEFRAME = "15m" as const;
export const XM_MT5_INTERVAL_MS = 15 * 60 * 1000;
export const XM_MT5_MAX_CANDLES = 600;

export interface XmBridgeCandle {
  time_seconds: number;
  open: number;
  high: number;
  low: number;
  close: number;
  complete: true;
  symbol: typeof XM_MT5_SYMBOL;
  timeframe: typeof XM_MT5_TIMEFRAME;
}

export interface XmBridgePayload {
  source: typeof XM_MT5_SOURCE;
  version: typeof XM_MT5_VERSION;
  symbol: typeof XM_MT5_SYMBOL;
  timeframe: typeof XM_MT5_TIMEFRAME;
  candles: XmBridgeCandle[];
}

export interface XmCandleRow {
  source: unknown;
  version: unknown;
  symbol: unknown;
  timeframe: unknown;
  bucket_start: unknown;
  open: unknown;
  high: unknown;
  low: unknown;
  close: unknown;
  is_closed: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("XM bridge payload candle ต้องเป็น object");
  }
  return value as Record<string, unknown>;
}

function positiveFinite(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} ต้องเป็นจำนวนบวก`);
  return parsed;
}

function integerTimestamp(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${field} ต้องเป็น Unix seconds จำนวนเต็ม`);
  return parsed;
}

function parseUtcTimestamp(value: unknown, field: string): number {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} ไม่มีค่า`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} ไม่ใช่ timestamp ที่ถูกต้อง`);
  return parsed;
}

function isAligned15m(timeMs: number): boolean {
  return timeMs % XM_MT5_INTERVAL_MS === 0;
}

function normalizeXmCandle(raw: unknown, now: number): XmBridgeCandle {
  const row = asRecord(raw);
  if (row["symbol"] !== XM_MT5_SYMBOL) throw new Error("XM bridge symbol ต้องเป็น GOLD");
  if (row["timeframe"] !== XM_MT5_TIMEFRAME) throw new Error("XM bridge timeframe ต้องเป็น 15m");
  if (row["complete"] !== true) throw new Error("XM bridge รับเฉพาะแท่งที่ปิดแล้ว");

  const timeSeconds = integerTimestamp(row["time_seconds"], "time_seconds");
  const timeMs = timeSeconds * 1000;
  if (!isAligned15m(timeMs)) throw new Error("XM bridge candle ต้อง align กับ UTC 15 นาที");
  if (timeMs > now + 60 * 1000) throw new Error("XM bridge candle อยู่ในอนาคตเกิน tolerance");

  const open = positiveFinite(row["open"], "open");
  const high = positiveFinite(row["high"], "high");
  const low = positiveFinite(row["low"], "low");
  const close = positiveFinite(row["close"], "close");
  if (high < Math.max(open, close)) throw new Error("XM bridge high ต่ำกว่า open/close");
  if (low > Math.min(open, close)) throw new Error("XM bridge low สูงกว่า open/close");

  return {
    time_seconds: timeSeconds,
    open,
    high,
    low,
    close,
    complete: true,
    symbol: XM_MT5_SYMBOL,
    timeframe: XM_MT5_TIMEFRAME,
  };
}

/**
 * Validate the bridge envelope before it reaches Supabase or analysis. The
 * bridge must send ascending, unique, UTC-aligned closed bars only.
 */
export function parseXmBridgePayload(raw: unknown, now = Date.now()): XmBridgePayload {
  const payload = asRecord(raw);
  if (payload["source"] !== XM_MT5_SOURCE) throw new Error("XM bridge source ไม่ตรง contract");
  if (payload["version"] !== XM_MT5_VERSION) throw new Error("XM bridge version ไม่ตรง contract");
  if (payload["symbol"] !== XM_MT5_SYMBOL) throw new Error("XM bridge symbol ต้องเป็น GOLD");
  if (payload["timeframe"] !== XM_MT5_TIMEFRAME) throw new Error("XM bridge timeframe ต้องเป็น 15m");
  if (!Array.isArray(payload["candles"])) throw new Error("XM bridge candles ต้องเป็น array");
  const rawCandles = payload["candles"];
  if (rawCandles.length === 0) throw new Error("XM bridge ต้องมี candle อย่างน้อย 1 แท่ง");
  if (rawCandles.length > XM_MT5_MAX_CANDLES) {
    throw new Error(`XM bridge ส่งได้ไม่เกิน ${XM_MT5_MAX_CANDLES} แท่ง`);
  }

  const candles = rawCandles.map((candle) => normalizeXmCandle(candle, now));
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1]!;
    const current = candles[index]!;
    if (current.time_seconds <= previous.time_seconds) {
      throw new Error("XM bridge candles ต้องเรียงเวลาเพิ่มขึ้นและห้ามซ้ำ");
    }
  }
  return {
    source: XM_MT5_SOURCE,
    version: XM_MT5_VERSION,
    symbol: XM_MT5_SYMBOL,
    timeframe: XM_MT5_TIMEFRAME,
    candles,
  };
}

export function parseXmCandleRow(raw: unknown): MarketDataCandle {
  const row = asRecord(raw) as unknown as XmCandleRow;
  if (row["source"] !== XM_MT5_SOURCE || row["version"] !== XM_MT5_VERSION) {
    throw new Error("Supabase candle source/version ไม่ตรงกับ XM MT5 contract");
  }
  if (row["symbol"] !== XM_MT5_SYMBOL || row["timeframe"] !== XM_MT5_TIMEFRAME || row["is_closed"] !== true) {
    throw new Error("Supabase ส่ง candle ที่ไม่ใช่ GOLD 15m closed candle");
  }
  const time = parseUtcTimestamp(row["bucket_start"], "bucket_start");
  if (!isAligned15m(time)) throw new Error("Supabase XM bucket ไม่ align กับ UTC 15 นาที");
  return normalizeProviderCandle({
    time,
    open: positiveFinite(row["open"], "open"),
    high: positiveFinite(row["high"], "high"),
    low: positiveFinite(row["low"], "low"),
    close: positiveFinite(row["close"], "close"),
    complete: true,
    sourceSymbol: XM_MT5_SYMBOL,
  });
}

export function feedFromXmRows(rows: unknown[], now = Date.now()): MarketDataFeed {
  const candles = rows.map(parseXmCandleRow).sort((a, b) => a.t - b.t);
  if (candles.length === 0) throw new Error("Supabase ยังไม่มี XM GOLD closed candles");
  return {
    symbol: XM_MT5_SYMBOL,
    providerSymbol: XM_MT5_SYMBOL,
    displayName: "XM GOLD (MT5 bridge)",
    timeframe: XM_MT5_TIMEFRAME,
    intervalMs: XM_MT5_INTERVAL_MS,
    source: XM_MT5_SOURCE,
    sourceType: "live",
    delayed: false,
    demo: false,
    fetchedAt: candles[candles.length - 1]?.t ?? now,
    candles,
  };
}

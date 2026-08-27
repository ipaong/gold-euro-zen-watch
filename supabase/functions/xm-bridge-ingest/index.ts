import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOURCE = "xm-mt5";
const VERSION = "1.0.0";
const SYMBOL = "GOLD";
const TIMEFRAME = "15m";
const INTERVAL_SECONDS = 15 * 60;
const MAX_CANDLES = 600;
const FUTURE_TOLERANCE_MS = 60 * 1000;
const MAX_BODY_BYTES = 1_000_000;
const SECRET_HEADER = "x-xm-bridge-secret";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error && error.message.trim() ? error.message : "bridge error";
  return message.slice(0, 240);
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function positiveFinite(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive finite number`);
  }
  return value;
}

function parsePayload(raw: unknown, now: number) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("bridge payload must be an object");
  }
  const payload = raw as Record<string, unknown>;
  if (payload.source !== SOURCE) throw new Error("bridge source must be xm-mt5");
  if (payload.version !== VERSION) throw new Error("bridge version is unsupported");
  if (payload.symbol !== SYMBOL) throw new Error("bridge symbol must be GOLD");
  if (payload.timeframe !== TIMEFRAME) throw new Error("bridge timeframe must be 15m");
  if (!Array.isArray(payload.candles)) throw new Error("bridge candles must be an array");
  if (payload.candles.length < 1 || payload.candles.length > MAX_CANDLES) {
    throw new Error(`bridge candle batch must contain 1 to ${MAX_CANDLES} candles`);
  }

  const candles = payload.candles.map((rawCandle) => {
    if (!rawCandle || typeof rawCandle !== "object" || Array.isArray(rawCandle)) {
      throw new Error("bridge candle must be an object");
    }
    const candle = rawCandle as Record<string, unknown>;
    if (candle.symbol !== SYMBOL || candle.timeframe !== TIMEFRAME) {
      throw new Error("bridge candle symbol/timeframe mismatch");
    }
    if (candle.complete !== true) throw new Error("bridge accepts closed candles only");
    if (typeof candle.time_seconds !== "number" || !Number.isInteger(candle.time_seconds)) {
      throw new Error("bridge time_seconds must be an integer");
    }
    if (candle.time_seconds <= 0 || candle.time_seconds % INTERVAL_SECONDS !== 0) {
      throw new Error("bridge timestamp must align to a UTC 15 minute bucket");
    }
    const timeMs = candle.time_seconds * 1000;
    if (timeMs > now + FUTURE_TOLERANCE_MS) throw new Error("bridge candle is too far in the future");
    const open = positiveFinite(candle.open, "open");
    const high = positiveFinite(candle.high, "high");
    const low = positiveFinite(candle.low, "low");
    const close = positiveFinite(candle.close, "close");
    if (high < Math.max(open, close) || low > Math.min(open, close)) {
      throw new Error("bridge candle OHLC geometry is invalid");
    }
    return {
      time_seconds: candle.time_seconds,
      open,
      high,
      low,
      close,
      complete: true,
    };
  });

  for (let index = 1; index < candles.length; index += 1) {
    if (candles[index].time_seconds <= candles[index - 1].time_seconds) {
      throw new Error("bridge candles must be ascending and unique");
    }
  }
  return candles;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const configuredSecret = Deno.env.get("XM_BRIDGE_SECRET")?.trim();
  const suppliedSecret = request.headers.get(SECRET_HEADER)?.trim();
  if (!configuredSecret || !suppliedSecret || !(await constantTimeEqual(suppliedSecret, configuredSecret))) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  const now = Date.now();
  try {
    const payload = JSON.parse(rawBody) as unknown;
    const candles = parsePayload(payload, now);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "bridge_not_configured" }, 503);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabaseAdmin.rpc("ingest_xm_mt5_candles", {
      p_candles: candles,
      p_ingested_at: new Date(now).toISOString(),
    });
    if (error) throw new Error(`ingest RPC failed: ${error.message}`);

    return json({ ok: true, source: SOURCE, version: VERSION, symbol: SYMBOL, timeframe: TIMEFRAME, result: data });
  } catch (error) {
    console.error(JSON.stringify({ event: "xm_bridge_ingest_error", source: SOURCE, error: safeMessage(error) }));
    return json({ ok: false, error: safeMessage(error) }, 422);
  }
});

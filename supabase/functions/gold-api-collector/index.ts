import { createClient } from "npm:@supabase/supabase-js@2";
import { constantTimeEqual, getSupabaseAdminKey } from "../_shared/runtime.ts";

const GOLD_API_ENDPOINT = "https://api.gold-api.com/price/XAU/EUR";
const GOLD_API_SOURCE = "gold-api-xau-eur";
const GOLD_API_VERSION = "1.0.0";
const GOLD_API_TIMEOUT_MS = 8_000;
const GOLD_API_MAX_AGE_MS = 5 * 60 * 1000;
const COLLECTOR_SECRET_HEADER = "x-gold-api-collector-secret";
const MIN_PROVIDER_CACHE_MS = 30_000;

let lastSuccessfulFetchAt = 0;
let lastSuccessfulSample: { price: number; updatedAt: string } | null = null;

interface GoldApiPriceResponse {
  symbol?: unknown;
  currency?: unknown;
  price?: unknown;
  updatedAt?: unknown;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function safeMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message.slice(0, 240) : "collector error";
}

function parseSample(payload: GoldApiPriceResponse, now: number) {
  if (payload.symbol !== "XAU") throw new Error("Gold API symbol ไม่ใช่ XAU");
  if (payload.currency !== "EUR") throw new Error("Gold API currency ไม่ใช่ EUR");
  if (typeof payload.price !== "number" || !Number.isFinite(payload.price) || payload.price <= 0) {
    throw new Error("Gold API price ต้องเป็นจำนวนบวก");
  }
  if (typeof payload.updatedAt !== "string" || !payload.updatedAt.trim()) {
    throw new Error("Gold API updatedAt ต้องเป็นข้อความ");
  }
  const updatedAt = payload.updatedAt.trim();
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(updatedAt)) {
    throw new Error("Gold API updatedAt ต้องระบุ timezone แบบ UTC หรือ offset");
  }
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) {
    throw new Error("Gold API updatedAt ไม่ใช่ timestamp ที่ถูกต้อง");
  }
  const ageMs = now - updatedAtMs;
  if (ageMs < -60_000) throw new Error("Gold API updatedAt อยู่ในอนาคตเกิน tolerance");
  if (ageMs > GOLD_API_MAX_AGE_MS) throw new Error("Gold API response เก่าเกิน 5 นาที");
  return { price: payload.price, updatedAt };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const configuredSecret = Deno.env.get("GOLD_API_COLLECTOR_SECRET")?.trim();
  const suppliedSecret = request.headers.get(COLLECTOR_SECRET_HEADER)?.trim();
  if (!configuredSecret || !suppliedSecret || !constantTimeEqual(suppliedSecret, configuredSecret)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const adminKey = getSupabaseAdminKey();
  if (!supabaseUrl || !adminKey) {
    return json({ ok: false, error: "collector_not_configured" }, 503);
  }

  const now = Date.now();
  if (lastSuccessfulSample && now - lastSuccessfulFetchAt < MIN_PROVIDER_CACHE_MS) {
    return json({
      ok: true,
      source: GOLD_API_SOURCE,
      version: GOLD_API_VERSION,
      cached: true,
      result: lastSuccessfulSample,
    });
  }

  try {
    const response = await fetch(GOLD_API_ENDPOINT, {
      headers: { accept: "application/json", "user-agent": "XAUEUR-Signal-Lab/1.0" },
      signal: AbortSignal.timeout(GOLD_API_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Gold API HTTP ${response.status}`);
    const payload = (await response.json()) as GoldApiPriceResponse;
    const sample = parseSample(payload, now);

    const supabaseAdmin = createClient(supabaseUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabaseAdmin.rpc("ingest_gold_api_price", {
      p_price: sample.price,
      p_updated_at: sample.updatedAt,
      p_ingested_at: new Date(now).toISOString(),
    });
    if (error) throw new Error(`ingest RPC: ${error.message}`);

    lastSuccessfulFetchAt = now;
    lastSuccessfulSample = sample;
    return json({ ok: true, source: GOLD_API_SOURCE, version: GOLD_API_VERSION, result: data });
  } catch (error) {
    console.error(JSON.stringify({ event: "gold_api_collector_error", source: GOLD_API_SOURCE, error: safeMessage(error) }));
    return json({ ok: false, error: safeMessage(error) }, 502);
  }
});

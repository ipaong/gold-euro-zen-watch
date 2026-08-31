import { createClient } from "npm:@supabase/supabase-js@2";

const SYMBOL = "GC=F";
const TIMEFRAME = "15m";
const INTERVAL_MS = 15 * 60 * 1000;
const SOURCE = "yahoo-finance";
const SECRET_HEADER = "x-yahoo-archive-secret";
const YAHOO_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=15m&range=1mo&events=div,splits";
const USER_AGENT = "Mozilla/5.0 (compatible; NerdGoldOracle/1.0)";
const TIMEOUT_MS = 15_000;
const BANGKOK = "Asia/Bangkok";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error && error.message.trim() ? error.message : "collector error";
  return message.slice(0, 240);
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
}

function isGoldWeekend(now = Date.now()): boolean {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: BANGKOK }).format(
    new Date(now),
  );
  return day === "Sat" || day === "Sun";
}

function positive(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} ไม่ใช่จำนวนบวก`);
  return parsed;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: { symbol?: string; dataGranularity?: string };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
        }>;
      };
    }> | null;
    error?: { code?: string; description?: string | null } | null;
  };
}

function parseYahoo(payload: YahooChartResponse, now: number) {
  const error = payload.chart?.error;
  if (error?.description) throw new Error(`Yahoo: ${error.description}`);
  const result = payload.chart?.result?.[0];
  if (!result) throw new Error("Yahoo ไม่ส่ง chart result");
  if (result.meta?.symbol && result.meta.symbol !== SYMBOL) {
    throw new Error(`Yahoo symbol เป็น ${result.meta.symbol} ไม่ใช่ ${SYMBOL}`);
  }
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!quote) throw new Error("Yahoo ไม่ส่ง OHLC");
  const rows: Array<{ t: number; o: number; h: number; l: number; c: number; source: string }> = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const openMs = timestamps[index]! * 1000;
    if (!Number.isFinite(openMs) || openMs <= 0) continue;
    if (openMs + INTERVAL_MS > now) continue;
    try {
      const o = positive(quote.open?.[index], "open");
      const h = positive(quote.high?.[index], "high");
      const l = positive(quote.low?.[index], "low");
      const c = positive(quote.close?.[index], "close");
      if (h < Math.max(o, c) || l > Math.min(o, c)) continue;
      rows.push({ t: openMs, o, h, l, c, source: SOURCE });
    } catch {
      continue;
    }
  }
  rows.sort((a, b) => a.t - b.t);
  const unique = new Map<number, (typeof rows)[number]>();
  for (const row of rows) unique.set(row.t, row);
  return [...unique.values()];
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const configuredSecret = Deno.env.get("YAHOO_ARCHIVE_SECRET")?.trim();
  const suppliedSecret = request.headers.get(SECRET_HEADER)?.trim();
  if (!configuredSecret || !suppliedSecret || !constantTimeEqual(suppliedSecret, configuredSecret)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_SECRET_KEY")?.trim();
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "collector_not_configured" }, 503);
  }

  const now = Date.now();
  if (isGoldWeekend(now)) {
    return json({
      ok: true,
      status: "closed",
      message: "ตลาดปิด (เสาร–อาทิตย์ เวลาไทย) — ไม่ดึง Yahoo และไม่เขียนคลัง",
    });
  }

  try {
    const response = await fetch(YAHOO_URL, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 429) throw new Error("Yahoo rate limit (429) — รอก่อนแล้วลองใหม่");
    if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
    const payload = (await response.json()) as YahooChartResponse;
    const candles = parseYahoo(payload, now);
    if (candles.length < 240) {
      throw new Error(`แท่งปิดไม่พอสำหรับคลัง (${candles.length}/240)`);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("ingest_yahoo_archive", { p_rows: candles });
    if (error) throw new Error(`ingest RPC: ${error.message}`);

    const result = (data ?? {}) as { appended?: number; total?: number };
    return json({
      ok: true,
      status: "ok",
      symbol: SYMBOL,
      timeframe: TIMEFRAME,
      fetched: candles.length,
      appended: result.appended ?? 0,
      total: result.total ?? candles.length,
      first: candles[0]!.t,
      last: candles[candles.length - 1]!.t,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "yahoo_archive_collector_error", error: safeMessage(error) }));
    return json({ ok: false, error: safeMessage(error) }, 502);
  }
});

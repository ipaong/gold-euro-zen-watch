import type { Candle, MarketSnapshot, Scenario } from "../types";

/**
 * Forecast engine.
 *
 * Direction and price levels come from the market state at that timestamp
 * (trend, momentum, ATR, volatility, support/resistance, regime).
 * Seeded randomness only adds small per-scenario variation, so the same
 * input always produces the same output. No LLM guesses prices here.
 *
 * It reads the snapshot as external data; it shares no logic with the frozen
 * demo dataset generator.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable seed from the analysis timestamp + price, so results are reproducible. */
function seedFor(s: MarketSnapshot, salt: number) {
  return (Math.floor(s.asOf / 60000) * 31 + Math.round(s.price * 100) * 7 + salt * 104729) >>> 0;
}

interface Template {
  id: Scenario["id"];
  name: string;
  /** Multiplier applied to the market bias for each of the 5 candles. */
  shape: number[];
  /** Extra volatility multiplier. */
  vol: number;
  baseWeight: number;
}

const TEMPLATES: Template[] = [
  { id: "A", name: "เทรนด์เดินต่อ", shape: [1, 1, 0.8, 1, 0.9], vol: 1, baseWeight: 26 },
  { id: "B", name: "เบรกเอาต์เร่งตัว", shape: [1.1, 1.5, 1.7, 1.4, 1.2], vol: 1.35, baseWeight: 18 },
  { id: "C", name: "ย่อก่อนไปต่อ", shape: [-0.9, -0.6, 0.7, 1.1, 1.2], vol: 1.05, baseWeight: 20 },
  { id: "D", name: "กลับตัวสวนทาง", shape: [-1, -1.2, -1.1, -0.6, -0.9], vol: 1.15, baseWeight: 18 },
  { id: "E", name: "ออกข้าง", shape: [0.25, -0.3, 0.2, -0.25, 0.1], vol: 0.7, baseWeight: 18 },
];

const M15 = 15 * 60 * 1000;

/** Expected per-candle drift in EUR, derived from real market state. */
function biasPerCandle(s: MarketSnapshot): number {
  const trendPart = s.trendScore * 0.32;
  const momentumPart = s.momentumScore * 0.26;
  const slopePart = Math.max(-0.2, Math.min(0.2, s.ema20Slope / (s.atr14 || 1) / 5));
  // Statistical pull back to the mean when price is stretched.
  const reversionPart = Math.max(-0.18, Math.min(0.18, -s.zScore * 0.06));
  const raw = trendPart + momentumPart + slopePart + reversionPart;
  const regimeDamp = s.regime === "ranging" ? 0.45 : s.regime === "volatile" ? 0.8 : 1;
  return raw * regimeDamp * (s.atr14 || 1) * 0.55;
}

function buildPath(
  s: MarketSnapshot,
  tpl: Template,
  horizon: number,
  bias: number,
): { candles: Candle[]; netMove: number } {
  const rnd = mulberry32(seedFor(s, tpl.id.charCodeAt(0)));
  const atr = s.atr14 || 1;
  const candles: Candle[] = [];
  let open = s.price;

  for (let i = 0; i < horizon; i++) {
    const shape = tpl.shape[i % tpl.shape.length]!;
    // Base drift from market state; when bias is tiny, use a small ATR floor so
    // the shape is still visible without inventing a direction.
    const magnitude = Math.max(Math.abs(bias), atr * 0.08);
    const dirSign = bias === 0 ? 1 : Math.sign(bias);
    let drift = shape * magnitude * dirSign;
    if (tpl.id === "E") drift = shape * atr * 0.18; // sideways: no directional bias

    // Small seeded variation only (never the main driver of direction).
    const noise = (rnd() - 0.5) * atr * 0.18 * tpl.vol;
    let close = open + drift + noise;

    // Key levels act as friction: half the move beyond them is absorbed.
    if (close > s.resistance && open <= s.resistance)
      close = s.resistance + (close - s.resistance) * (tpl.id === "B" ? 0.75 : 0.4);
    if (close < s.support && open >= s.support)
      close = s.support - (s.support - close) * (tpl.id === "B" ? 0.75 : 0.4);

    const wickUp = atr * (0.18 + rnd() * 0.22) * tpl.vol;
    const wickDown = atr * (0.18 + rnd() * 0.22) * tpl.vol;
    const h = Math.max(open, close) + wickUp;
    const l = Math.min(open, close) - wickDown;

    candles.push({
      t: s.lastCandleTime + M15 * (i + 1),
      o: +open.toFixed(2),
      h: +h.toFixed(2),
      l: +l.toFixed(2),
      c: +close.toFixed(2),
    });
    open = close;
  }

  return { candles, netMove: candles[candles.length - 1]!.c - s.price };
}

function directionOf(netMove: number, atr: number): Scenario["direction"] {
  const threshold = atr * 0.35;
  if (netMove > threshold) return "BUY";
  if (netMove < -threshold) return "SELL";
  return "WAIT";
}

/**
 * Scenario weights describe how the system sees the DISTRIBUTION of possible
 * futures — they are heuristic scores, not calibrated probabilities, and they
 * are not model votes.
 */
function weightFor(tpl: Template, s: MarketSnapshot, bias: number): number {
  const strength = Math.min(1, Math.abs(bias) / ((s.atr14 || 1) * 0.35));
  let w = tpl.baseWeight;
  switch (tpl.id) {
    case "A":
      w += strength * 14 + (s.regime === "trending_up" || s.regime === "trending_down" ? 6 : -6);
      break;
    case "B":
      w += strength * 8 + (s.atrRatio > 1.3 ? 8 : -4) + (s.regime === "volatile" ? 4 : 0);
      break;
    case "C":
      w += 6 - strength * 3 + (Math.abs(s.zScore) > 1.5 ? 6 : 0);
      break;
    case "D":
      w += (Math.abs(s.zScore) > 1.8 ? 10 : 0) + (s.regime === "ranging" ? 4 : -strength * 8);
      break;
    case "E":
      w += (s.regime === "ranging" ? 12 : -6) + (s.atrRatio < 0.85 ? 6 : 0) - strength * 6;
      break;
  }
  return Math.max(4, w);
}

export interface ForecastOutput {
  scenarios: Scenario[];
  /** Weight-blended path shown as the 5 forecast candles on the chart. */
  forecast: Candle[];
  /** 0..1 — how concentrated the scenario distribution is on one direction. */
  quality: number;
  bias: number;
}

export function runForecast(s: MarketSnapshot, horizon = 5): ForecastOutput {
  const bias = biasPerCandle(s);
  const atr = s.atr14 || 1;

  const built = TEMPLATES.map((tpl) => {
    const { candles, netMove } = buildPath(s, tpl, horizon, bias);
    return { tpl, candles, netMove, rawWeight: weightFor(tpl, s, bias) };
  });

  const total = built.reduce((a, b) => a + b.rawWeight, 0);
  const scenarios: Scenario[] = built.map((b) => {
    const arrows = b.candles.map((c, i) => {
      const prevClose = i === 0 ? s.price : b.candles[i - 1]!.c;
      const diff = c.c - prevClose;
      return Math.abs(diff) < atr * 0.08 ? "flat" : diff > 0 ? "up" : "down";
    });
    return {
      id: b.tpl.id,
      name: b.tpl.name,
      direction: directionOf(b.netMove, atr),
      weight: Math.round((b.rawWeight / total) * 100),
      candles: b.candles,
      arrows,
      netMove: +b.netMove.toFixed(2),
    } satisfies Scenario;
  });

  // Normalise rounding so weights sum to exactly 100.
  const sum = scenarios.reduce((a, x) => a + x.weight, 0);
  if (sum !== 100 && scenarios.length) {
    const top = scenarios.reduce((a, b) => (b.weight > a.weight ? b : a));
    top.weight += 100 - sum;
  }

  // Weighted blend = the displayed forecast candles.
  const forecast: Candle[] = [];
  for (let i = 0; i < horizon; i++) {
    let o = 0;
    let h = 0;
    let l = 0;
    let c = 0;
    for (const sc of scenarios) {
      const w = sc.weight / 100;
      const k = sc.candles[i]!;
      o += k.o * w;
      h += k.h * w;
      l += k.l * w;
      c += k.c * w;
    }
    forecast.push({
      t: s.lastCandleTime + M15 * (i + 1),
      o: +o.toFixed(2),
      h: +h.toFixed(2),
      l: +l.toFixed(2),
      c: +c.toFixed(2),
    });
  }

  const buyW = scenarios.filter((x) => x.direction === "BUY").reduce((a, b) => a + b.weight, 0);
  const sellW = scenarios.filter((x) => x.direction === "SELL").reduce((a, b) => a + b.weight, 0);
  const waitW = 100 - buyW - sellW;
  const quality = Math.max(buyW, sellW, waitW) / 100;

  return { scenarios, forecast, quality, bias };
}

// Shared domain types for XAUEUR Signal Lab (Phase 1 / demo data).

export type Direction = "BUY" | "SELL" | "WAIT";

export interface Candle {
  t: number; // candle open time, UTC ms
  o: number;
  h: number;
  l: number;
  c: number;
}

export type Regime = "trending_up" | "trending_down" | "ranging" | "volatile";

export interface MarketSnapshot {
  asOf: number;
  price: number;
  prevClose: number;
  changePct: number;
  candles: Candle[];
  lastCandleTime: number;
  ema20: number;
  ema50: number;
  ema200: number;
  ema20Slope: number;
  ema50Slope: number;
  rsi14: number;
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  macdHistPrev: number;
  atr14: number;
  atrPct: number;
  atrRatio: number; // current ATR vs 100-candle average ATR
  support: number;
  resistance: number;
  swingHigh: number;
  swingLow: number;
  higherHighs: boolean;
  lowerLows: boolean;
  consecutiveBull: number;
  consecutiveBear: number;
  bodyStrength: number; // 0..1 average body / range of last 5
  zScore: number; // price vs 50-candle mean, in sigma
  trendScore: number; // -1..1
  momentumScore: number; // -1..1
  regime: Regime;
}

export type Impact = "high" | "medium" | "low";

export interface NewsItem {
  id: string;
  publishedAt: number;
  title: string;
  source: string;
  /** Original article link (live sources only). */
  url?: string;
  tag: "gold_up" | "gold_down" | "eur_up" | "eur_down";
  impact: Impact;
}

export interface EconomicEvent {
  id: string;
  time: number;
  currency: "USD" | "EUR";
  impact: Impact;
  name: string;
  previous: string;
  forecast: string;
  /** null until the release time has passed (no look-ahead). */
  actual: string | null;
  released: boolean;
}

export type GoldBias = "bullish" | "neutral" | "bearish";
export type EurBias = "strong" | "neutral" | "weak";
export type RiskLevel = "low" | "medium" | "high";

export interface NewsSnapshot {
  asOf: number;
  available: boolean;
  demo: boolean;
  headlines: NewsItem[];
  goldBias: GoldBias;
  eurBias: EurBias;
  netBias: Direction;
  netStrength: number; // 0..1
  upcoming: EconomicEvent[];
  recent: EconomicEvent[];
  minutesToHighImpact: number | null;
  nextHighImpact: EconomicEvent | null;
  riskLevel: RiskLevel;
}

export type ModelId = "trend" | "momentum" | "technical" | "news" | "volatility";

export interface ModelVote {
  id: ModelId;
  name: string;
  direction: Direction;
  confidence: number; // 0..100
  summary: string;
  factors: string[];
  risks: string[];
  unavailable: boolean;
}

export interface EnsembleResult {
  direction: Direction;
  confidence: number;
  summary: string;
  bullish: string[];
  bearish: string[];
  risks: string[];
}

export interface Scenario {
  id: "A" | "B" | "C" | "D" | "E";
  name: string;
  direction: Direction;
  weight: number; // heuristic scenario weight, %
  candles: Candle[];
  arrows: ("up" | "down" | "flat")[];
  netMove: number;
}

export interface GateCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface Consensus {
  direction: Direction;
  rawDirection: Direction;
  agree: number;
  total: number;
  confidence: number;
  buyVotes: number;
  sellVotes: number;
  waitVotes: number;
  checks: GateCheck[];
  blocked: boolean;
  reason: string;
}

export interface TradePlan {
  direction: Direction;
  price: number;
  support: number;
  resistance: number;
  invalidation: number;
  atr: number;
  risk: RiskLevel;
}

export interface Score {
  scoredAt: number;
  directionCorrect: boolean | null;
  actualDirection: Direction;
  closeError: number;
  mae: number;
  highError: number;
  lowError: number;
  candleDirHits: number;
  candleDirTotal: number;
  hypotheticalMove: number; // EUR move in the signal direction over the 5 candles
}

export type PredictionMode = "live" | "time_machine" | "seed";

/** Phase 2B: Lovable AI reads the structured snapshot and explains it in Thai. */
export interface AiExplanation {
  /** Why the final signal is what it is. */
  signal: string;
  /** What the news/calendar situation means right now. */
  news: string;
  /** What the quality gate is doing (and what would unlock a signal). */
  gate: string;
  /** "ai" = written by Lovable AI, "template" = deterministic fallback. */
  source: "ai" | "template";
  generatedAt: number;
}

export interface Prediction {
  id: string;
  asOf: number; // simulated "now"
  createdAt: number; // real clock when the record was made
  mode: PredictionMode;
  demo: boolean;
  symbol: "XAUEUR";
  timeframe: "M15";
  horizon: number;
  price: number;
  models: ModelVote[];
  ensemble: EnsembleResult;
  consensus: Consensus;
  scenarios: Scenario[];
  forecast: Candle[];
  plan: TradePlan;
  narrative: Narrative;
  newsRisk: RiskLevel;
  goldBias: GoldBias;
  eurBias: EurBias;
  actual: Candle[] | null;
  score: Score | null;
  locked: boolean;
  ai?: AiExplanation | null;
}


export interface Narrative {
  whatsHappening: string;
  why: string[];
  invalidate: string[];
}

export interface AppSettings {
  confidenceThreshold: number;
  minAgreement: number;
  newsAvoidMinutes: number;
  horizon: number;
}

export interface AnalysisResult {
  snapshot: MarketSnapshot;
  news: NewsSnapshot;
  models: ModelVote[];
  ensemble: EnsembleResult;
  scenarios: Scenario[];
  forecast: Candle[];
  consensus: Consensus;
  plan: TradePlan;
  narrative: Narrative;
}

export class InsufficientDataError extends Error {
  constructor(message = "ข้อมูลไม่เพียงพอสำหรับการวิเคราะห์") {
    super(message);
    this.name = "InsufficientDataError";
  }
}

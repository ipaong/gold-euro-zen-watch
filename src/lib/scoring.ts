import type {
  Candle,
  Direction,
  ModelScore,
  ModelVote,
  Prediction,
  Score,
  ScoredModelId,
} from "./types";

/**
 * Scoring contract version. Bump this only when the formula or readiness rule
 * changes; old locked results remain readable and are never recalculated.
 */
export const SCORE_VERSION = "1.0.0";
export const MIN_SAMPLE_SIZE = 10;

export type ScoreWindow = "20" | "50" | "100" | "all";

export const SCORE_WINDOWS: readonly { value: ScoreWindow; label: string; limit: number | null }[] =
  [
    { value: "20", label: "ล่าสุด 20", limit: 20 },
    { value: "50", label: "ล่าสุด 50", limit: 50 },
    { value: "100", label: "ล่าสุด 100", limit: 100 },
    { value: "all", label: "ทั้งหมด", limit: null },
  ];

export interface CalibrationBucket {
  label: string;
  min: number;
  max: number;
  sample: number;
  directional: number;
  hits: number;
  accuracy: number | null;
}

export interface ModelStats {
  id: ScoredModelId;
  name: string;
  sample: number;
  unavailable: number;
  directional: number;
  hits: number;
  hitRate: number | null;
  buySample: number;
  buyHits: number;
  buyAccuracy: number | null;
  sellSample: number;
  sellHits: number;
  sellAccuracy: number | null;
  waitCount: number;
  waitFrequency: number | null;
  avgConfidence: number | null;
  calibration: CalibrationBucket[];
}

export interface Stats {
  total: number;
  scored: number;
  directional: number;
  hits: number;
  hitRate: number | null;
  avgMae: number | null;
  avgCloseError: number | null;
  candleHitRate: number | null;
  netMove: number;
  waitCount: number;
  scoreVersions: string[];
  mixedScoreVersions: boolean;
  modelStats: ModelStats[];
}

const CALIBRATION_RANGES = [
  { label: "0–49%", min: 0, max: 49 },
  { label: "50–69%", min: 50, max: 69 },
  { label: "70–84%", min: 70, max: 84 },
  { label: "85–100%", min: 85, max: 100 },
] as const;

function dirOf(from: number, to: number, atr: number): Direction {
  const th = atr * 0.35;
  if (to - from > th) return "BUY";
  if (from - to > th) return "SELL";
  return "WAIT";
}

/** The number of realised candles required before a prediction can be scored. */
export function requiredHorizon(p: Prediction): number {
  const configured = Number.isInteger(p.horizon) && p.horizon > 0 ? p.horizon : p.forecast.length;
  return Math.max(configured, p.forecast.length);
}

export function isHorizonReady(p: Prediction, actual: Candle[]): boolean {
  return p.forecast.length > 0 && actual.length >= requiredHorizon(p);
}

function modelScore(
  id: ScoredModelId,
  name: string,
  direction: Direction,
  confidence: number,
  unavailable: boolean,
  actualDirection: Direction,
): ModelScore {
  return {
    id,
    name,
    direction,
    confidence,
    unavailable,
    directionCorrect: unavailable || direction === "WAIT" ? null : direction === actualDirection,
  };
}

function scoreModels(p: Prediction, actualDirection: Direction): ModelScore[] {
  const modelScores = (p.models ?? []).map((model: ModelVote) =>
    modelScore(
      model.id,
      model.name,
      model.direction,
      model.confidence,
      model.unavailable,
      actualDirection,
    ),
  );
  modelScores.push(
    modelScore(
      "consensus",
      "Consensus",
      p.consensus.direction,
      p.consensus.confidence,
      false,
      actualDirection,
    ),
  );
  return modelScores;
}

/**
 * Compares a locked prediction with the complete realised horizon.
 * Only the first required horizon candles are scored, so extra provider data
 * cannot silently change an already-defined forecast window.
 */
export function scorePrediction(p: Prediction, actual: Candle[]): Score {
  if (p.forecast.length === 0)
    throw new Error("Cannot score a prediction without forecast candles");
  const n = requiredHorizon(p);
  if (actual.length < n) {
    throw new Error(`Cannot score before all ${n} actual candles are available`);
  }

  const realised = actual.slice(0, n);
  const forecast = p.forecast.slice(0, n);
  const atr = Math.abs(p.plan.atr) || 1;
  const lastActual = realised[n - 1]!;
  const lastForecast = forecast[n - 1]!;
  const actualDirection = dirOf(p.price, lastActual.c, atr);

  let mae = 0;
  let candleDirHits = 0;
  let highError = 0;
  let lowError = 0;
  for (let i = 0; i < n; i++) {
    const f = forecast[i]!;
    const a = realised[i]!;
    mae += Math.abs(f.c - a.c);
    highError += Math.abs(f.h - a.h);
    lowError += Math.abs(f.l - a.l);
    const prevF = i === 0 ? p.price : forecast[i - 1]!.c;
    const prevA = i === 0 ? p.price : realised[i - 1]!.c;
    if (Math.sign(f.c - prevF) === Math.sign(a.c - prevA)) candleDirHits++;
  }

  const directionCorrect =
    p.consensus.direction === "WAIT" ? null : p.consensus.direction === actualDirection;
  const move = lastActual.c - p.price;
  const hypotheticalMove =
    p.consensus.direction === "BUY" ? move : p.consensus.direction === "SELL" ? -move : 0;

  return {
    scoreVersion: SCORE_VERSION,
    modelScores: scoreModels(p, actualDirection),
    scoredAt: Date.now(),
    directionCorrect,
    actualDirection,
    closeError: +(lastForecast.c - lastActual.c).toFixed(2),
    mae: +(mae / n).toFixed(2),
    highError: +(highError / n).toFixed(2),
    lowError: +(lowError / n).toFixed(2),
    candleDirHits,
    candleDirTotal: n,
    hypotheticalMove: +hypotheticalMove.toFixed(2),
  };
}

export function selectPredictionWindow(preds: Prediction[], window: ScoreWindow): Prediction[] {
  const limit = SCORE_WINDOWS.find((option) => option.value === window)?.limit ?? null;
  const scoredFirst = [...preds].sort((a, b) => b.asOf - a.asOf);
  return limit === null ? scoredFirst : scoredFirst.slice(0, limit);
}

function legacyModelScores(p: Prediction): ModelScore[] {
  const actualDirection = p.score?.actualDirection ?? "WAIT";
  const modelScores = p.models.map((model) =>
    modelScore(
      model.id,
      model.name,
      model.direction,
      model.confidence,
      model.unavailable,
      actualDirection,
    ),
  );
  modelScores.push(
    modelScore(
      "consensus",
      "Consensus",
      p.consensus.direction,
      p.consensus.confidence,
      false,
      actualDirection,
    ),
  );
  return modelScores;
}

/** Reads new per-model results and safely supports legacy scores from before v1.0.0. */
export function getModelScores(p: Prediction): ModelScore[] {
  return p.score?.modelScores?.length ? p.score.modelScores : legacyModelScores(p);
}

function percent(numerator: number, denominator: number): number | null {
  return denominator ? Math.round((numerator / denominator) * 100) : null;
}

function average(values: number[]): number | null {
  return values.length
    ? +(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
    : null;
}

function makeModelStats(id: ScoredModelId, name: string, observations: ModelScore[]): ModelStats {
  const valid = observations.filter((observation) => !observation.unavailable);
  const directional = valid.filter((observation) => observation.direction !== "WAIT");
  const hits = directional.filter((observation) => observation.directionCorrect === true).length;
  const buys = valid.filter((observation) => observation.direction === "BUY");
  const sells = valid.filter((observation) => observation.direction === "SELL");
  const waits = valid.filter((observation) => observation.direction === "WAIT");
  const confidence = valid.map((observation) => observation.confidence);
  const calibration = CALIBRATION_RANGES.map((range) => {
    const bucket = directional.filter(
      (observation) => observation.confidence >= range.min && observation.confidence <= range.max,
    );
    const bucketHits = bucket.filter((observation) => observation.directionCorrect === true).length;
    return {
      ...range,
      sample: bucket.length,
      directional: bucket.length,
      hits: bucketHits,
      accuracy: percent(bucketHits, bucket.length),
    };
  });

  return {
    id,
    name,
    sample: valid.length,
    unavailable: observations.length - valid.length,
    directional: directional.length,
    hits,
    hitRate: percent(hits, directional.length),
    buySample: buys.length,
    buyHits: buys.filter((observation) => observation.directionCorrect === true).length,
    buyAccuracy: percent(
      buys.filter((observation) => observation.directionCorrect === true).length,
      buys.length,
    ),
    sellSample: sells.length,
    sellHits: sells.filter((observation) => observation.directionCorrect === true).length,
    sellAccuracy: percent(
      sells.filter((observation) => observation.directionCorrect === true).length,
      sells.length,
    ),
    waitCount: waits.length,
    waitFrequency: percent(waits.length, valid.length),
    avgConfidence: average(confidence),
    calibration,
  };
}

export function computeModelStats(preds: Prediction[]): ModelStats[] {
  const byId = new Map<ScoredModelId, { name: string; observations: ModelScore[] }>();
  for (const prediction of preds) {
    if (!prediction.score) continue;
    for (const observation of getModelScores(prediction)) {
      const entry = byId.get(observation.id) ?? { name: observation.name, observations: [] };
      entry.observations.push(observation);
      byId.set(observation.id, entry);
    }
  }

  const order: ScoredModelId[] = [
    "trend",
    "momentum",
    "technical",
    "news",
    "volatility",
    "consensus",
  ];
  return order
    .filter((id) => byId.has(id))
    .map((id) => {
      const entry = byId.get(id)!;
      return makeModelStats(id, entry.name, entry.observations);
    });
}

export function computeStats(preds: Prediction[]): Stats {
  const scored = preds.filter((p) => p.score);
  const directional = scored.filter((p) => p.score!.directionCorrect !== null);
  const hits = directional.filter((p) => p.score!.directionCorrect).length;
  const candleHits = scored.reduce((a, p) => a + p.score!.candleDirHits, 0);
  const candleTotal = scored.reduce((a, p) => a + p.score!.candleDirTotal, 0);
  const scoreVersions = [...new Set(scored.map((p) => p.score!.scoreVersion ?? "legacy"))];
  return {
    total: preds.length,
    scored: scored.length,
    directional: directional.length,
    hits,
    hitRate: percent(hits, directional.length),
    avgMae: scored.length
      ? +(scored.reduce((a, p) => a + p.score!.mae, 0) / scored.length).toFixed(2)
      : null,
    avgCloseError: scored.length
      ? +(scored.reduce((a, p) => a + Math.abs(p.score!.closeError), 0) / scored.length).toFixed(2)
      : null,
    candleHitRate: percent(candleHits, candleTotal),
    netMove: +scored.reduce((a, p) => a + p.score!.hypotheticalMove, 0).toFixed(2),
    waitCount: preds.filter((p) => p.consensus.direction === "WAIT").length,
    scoreVersions,
    mixedScoreVersions: scoreVersions.length > 1,
    modelStats: computeModelStats(preds),
  };
}

import { atr, emaSeries, rsi, stdev } from "./indicators";
import type { Candle, Direction, Regime } from "./types";

export const ADAPTIVE_REPLAY_VERSION = "3.0.0";

export type AdaptiveExpertId = "tape" | "trend" | "mean_reversion" | "breakout" | "analog";

export interface AdaptiveExpertAudit {
  probabilityUp: number;
  weight: number;
  inverted: boolean;
  globalSamples: number;
  regimeSamples: number;
  posteriorAccuracy: number;
}

export interface AdaptiveProjection {
  step: number;
  bear: number;
  base: number;
  bull: number;
}

export interface AdaptiveReplayDecision {
  version: typeof ADAPTIVE_REPLAY_VERSION;
  direction: Direction;
  probabilityUp: number;
  edge: number;
  confidence: number;
  regime: Regime;
  calibrated: boolean;
  sampleCount: number;
  directionalSample: number;
  directionalHits: number;
  accuracy: number | null;
  coverage: number | null;
  lastLearnedOutcomeTime: number | null;
  experts: Record<AdaptiveExpertId, AdaptiveExpertAudit>;
  analog: {
    neighborCount: number;
    effectiveSamples: number;
  };
  projection: AdaptiveProjection[];
}

export interface AdaptiveReplayOptions {
  asOf?: number;
  horizon?: number;
  minFeatureIndex?: number;
  minCalibrationSamples?: number;
  decay?: number;
  learningRate?: number;
}

interface Feature {
  index: number;
  atr: number;
  atrRatio: number;
  move1: number;
  move3: number;
  move5: number;
  move12: number;
  emaGap: number;
  emaSlope: number;
  rsi: number;
  zScore: number;
  breakout: number;
  bodyFlow: number;
  regime: Regime;
  vector: number[];
}

interface SkillState {
  samples: number;
  loss: number;
  inverseLoss: number;
  hits: number;
  inverseHits: number;
}

interface ExpertPrediction {
  probabilityUp: number;
  score: number;
}

interface AnalogNeighbor {
  index: number;
  distance: number;
  weight: number;
  score: number;
}

interface PendingPrediction {
  dueIndex: number;
  anchorIndex: number;
  regime: Regime;
  direction: Direction;
  experts: Record<AdaptiveExpertId, ExpertPrediction>;
}

const EXPERT_IDS: AdaptiveExpertId[] = ["tape", "trend", "mean_reversion", "breakout", "analog"];
const REGIMES: Regime[] = ["trending_up", "trending_down", "ranging", "volatile"];
const DEFAULT_MIN_FEATURE_INDEX = 60;
const DEFAULT_MIN_CALIBRATION_SAMPLES = 20;
const ANALOG_NEIGHBORS = 15;
const PRIOR_STRENGTH = 8;
const EXPERT_PRIOR_WEIGHT: Record<AdaptiveExpertId, number> = {
  tape: 1.05,
  trend: 1,
  mean_reversion: 0.8,
  breakout: 0.9,
  analog: 1.45,
};

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));
const round = (value: number, digits = 4) => +value.toFixed(digits);

function emptySkill(): SkillState {
  return { samples: 0, loss: 0, inverseLoss: 0, hits: 0, inverseHits: 0 };
}

function emptyExpertAudit(): Record<AdaptiveExpertId, AdaptiveExpertAudit> {
  return Object.fromEntries(
    EXPERT_IDS.map((id) => [
      id,
      {
        probabilityUp: 0.5,
        weight: 0.2,
        inverted: false,
        globalSamples: 0,
        regimeSamples: 0,
        posteriorAccuracy: 0.5,
      },
    ]),
  ) as Record<AdaptiveExpertId, AdaptiveExpertAudit>;
}

function probabilityFromScore(score: number): number {
  return clamp(0.5 + clamp(score) * 0.44, 0.04, 0.96);
}

function directionFromProbability(probabilityUp: number, regime: Regime): Direction {
  const margin = regime === "ranging" ? 0.12 : regime === "volatile" ? 0.14 : 0.09;
  if (probabilityUp > 0.5 + margin) return "BUY";
  if (probabilityUp < 0.5 - margin) return "SELL";
  return "WAIT";
}

function actualDirection(move: number, atrValue: number): Direction {
  const threshold = Math.max(Math.abs(atrValue), Number.EPSILON) * 0.35;
  if (move > threshold) return "BUY";
  if (move < -threshold) return "SELL";
  return "WAIT";
}

function actualProbability(direction: Direction): number {
  return direction === "BUY" ? 1 : direction === "SELL" ? 0 : 0.5;
}

function percentile(values: { value: number; weight: number }[], quantile: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return sorted[Math.floor((sorted.length - 1) * quantile)]!.value;
  const target = total * quantile;
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= target) return item.value;
  }
  return sorted[sorted.length - 1]!.value;
}

function buildFeatures(candles: Candle[]): Feature[] {
  const closes = candles.map((candle) => candle.c);
  const ema20 = emaSeries(closes, 20);
  const ema50 = emaSeries(closes, 50);
  const atrs = candles.map((_, index) => {
    const slice = candles.slice(Math.max(0, index - 79), index + 1);
    return Math.max(atr(slice, 14) || 0, Number.EPSILON);
  });

  return candles.map((candle, index) => {
    const atrValue = atrs[index]!;
    const close = candle.c;
    const move = (bars: number) => {
      const anchor = closes[index - bars];
      return anchor === undefined ? 0 : (close - anchor) / atrValue;
    };
    const recentAtr = atrs.slice(Math.max(0, index - 59), index);
    const atrAverage = recentAtr.length
      ? recentAtr.reduce((sum, value) => sum + value, 0) / recentAtr.length
      : atrValue;
    const atrRatio = atrAverage > 0 ? atrValue / atrAverage : 1;
    const fast = ema20[index] ?? close;
    const slow = ema50[index] ?? close;
    const priorFast = ema20[Math.max(0, index - 5)] ?? fast;
    const emaGap = (fast - slow) / (atrValue * 2);
    const emaSlope = (fast - priorFast) / atrValue;
    const prefix = closes.slice(0, index + 1);
    const rsiValue = prefix.length > 15 ? rsi(prefix, 14) : 50;
    const window50 = closes.slice(Math.max(0, index - 49), index + 1);
    const mean = window50.reduce((sum, value) => sum + value, 0) / Math.max(1, window50.length);
    const zScore = (close - mean) / Math.max(stdev(window50) || 0, Number.EPSILON);
    const prior20 = candles.slice(Math.max(0, index - 20), index);
    const priorHigh = prior20.length ? Math.max(...prior20.map((item) => item.h)) : candle.h;
    const priorLow = prior20.length ? Math.min(...prior20.map((item) => item.l)) : candle.l;
    const breakout =
      close > priorHigh
        ? (close - priorHigh) / atrValue
        : close < priorLow
          ? (close - priorLow) / atrValue
          : ((close - (priorHigh + priorLow) / 2) / Math.max(priorHigh - priorLow, atrValue)) * 0.5;
    const recentBodies = candles.slice(Math.max(0, index - 4), index + 1);
    const bodyFlow =
      recentBodies.reduce((sum, item) => {
        const range = Math.max(item.h - item.l, Number.EPSILON);
        return sum + (item.c - item.o) / range;
      }, 0) / Math.max(1, recentBodies.length);

    let regime: Regime = "ranging";
    if (atrRatio >= 1.55) regime = "volatile";
    else if (emaGap >= 0.18 && emaSlope >= 0.08) regime = "trending_up";
    else if (emaGap <= -0.18 && emaSlope <= -0.08) regime = "trending_down";

    const move1 = move(1);
    const move3 = move(3);
    const move5 = move(5);
    const move12 = move(12);
    const vector = [
      move1,
      move3,
      move5,
      move12,
      emaGap,
      emaSlope,
      (rsiValue - 50) / 25,
      zScore / 2,
      breakout,
      bodyFlow,
      clamp(atrRatio - 1),
    ].map((value) => clamp(value, -3, 3));

    return {
      index,
      atr: atrValue,
      atrRatio,
      move1,
      move3,
      move5,
      move12,
      emaGap,
      emaSlope,
      rsi: rsiValue,
      zScore,
      breakout,
      bodyFlow,
      regime,
      vector,
    };
  });
}

function findAnalogs(
  candles: Candle[],
  features: Feature[],
  targetIndex: number,
  horizon: number,
  minFeatureIndex: number,
): AnalogNeighbor[] {
  const target = features[targetIndex]!;
  const candidates: AnalogNeighbor[] = [];
  for (let index = minFeatureIndex; index + horizon <= targetIndex; index++) {
    const candidate = features[index]!;
    let squaredDistance = 0;
    for (let part = 0; part < target.vector.length; part++) {
      squaredDistance += (target.vector[part]! - candidate.vector[part]!) ** 2;
    }
    const regimePenalty = candidate.regime === target.regime ? 0 : 0.8;
    const distance = Math.sqrt(squaredDistance + regimePenalty ** 2);
    const similarity = Math.exp(-(distance ** 2) / (2 * 2.4 ** 2));
    const recency = 2 ** (-(targetIndex - index) / 480);
    const regimeWeight = candidate.regime === target.regime ? 1 : 0.55;
    const move = candles[index + horizon]!.c - candles[index]!.c;
    const score = clamp(move / (candidate.atr * 1.5));
    candidates.push({ index, distance, weight: similarity * recency * regimeWeight, score });
  }
  return candidates.sort((a, b) => a.distance - b.distance).slice(0, ANALOG_NEIGHBORS);
}

function predictExperts(
  candles: Candle[],
  features: Feature[],
  targetIndex: number,
  horizon: number,
  minFeatureIndex: number,
): { experts: Record<AdaptiveExpertId, ExpertPrediction>; analogs: AnalogNeighbor[] } {
  const feature = features[targetIndex]!;
  const tapeScore = clamp(
    clamp(feature.move1 / 0.6) * 0.25 +
      clamp(feature.move3 / 1.05) * 0.35 +
      clamp(feature.move5 / 1.6) * 0.25 +
      clamp(feature.move12 / 2.4) * 0.15,
  );
  const trendScore = clamp(
    clamp(feature.emaGap) * 0.45 +
      clamp(feature.emaSlope / 0.8) * 0.35 +
      clamp(feature.move12 / 2.4) * 0.2,
  );
  const meanReversionScore = clamp(
    clamp(-feature.zScore / 2) * 0.52 +
      clamp(-(feature.rsi - 50) / 30) * 0.33 +
      clamp(-feature.move1 / 0.8) * 0.15,
  );
  const breakoutScore = clamp(
    clamp(feature.breakout / 0.8) * 0.55 +
      clamp(feature.bodyFlow) * 0.25 +
      clamp(feature.move3 / 1.2) * 0.2,
  );
  const analogs = findAnalogs(candles, features, targetIndex, horizon, minFeatureIndex);
  const analogWeight = analogs.reduce((sum, item) => sum + item.weight, 0);
  const analogScore = analogWeight
    ? analogs.reduce((sum, item) => sum + item.score * item.weight, 0) / analogWeight
    : 0;

  const scores: Record<AdaptiveExpertId, number> = {
    tape: tapeScore,
    trend: trendScore,
    mean_reversion: meanReversionScore,
    breakout: breakoutScore,
    analog: clamp(analogScore),
  };
  return {
    experts: Object.fromEntries(
      EXPERT_IDS.map((id) => [
        id,
        { score: scores[id], probabilityUp: probabilityFromScore(scores[id]) },
      ]),
    ) as Record<AdaptiveExpertId, ExpertPrediction>,
    analogs,
  };
}

function skillWeight(
  expertId: AdaptiveExpertId,
  global: SkillState,
  regime: SkillState,
  learningRate: number,
): { weight: number; accuracy: number; inverted: boolean } {
  const globalDirectLoss =
    (global.loss + PRIOR_STRENGTH * 0.25) / (global.samples + PRIOR_STRENGTH);
  const globalInverseLoss =
    (global.inverseLoss + PRIOR_STRENGTH * 0.25) / (global.samples + PRIOR_STRENGTH);
  const localDirectLoss =
    (regime.loss + PRIOR_STRENGTH * globalDirectLoss) / (regime.samples + PRIOR_STRENGTH);
  const localInverseLoss =
    (regime.inverseLoss + PRIOR_STRENGTH * globalInverseLoss) / (regime.samples + PRIOR_STRENGTH);
  const enoughOrientationEvidence = global.samples + regime.samples >= 12;
  const inverted = enoughOrientationEvidence && localInverseLoss + 0.008 < localDirectLoss;
  const selectedLoss = inverted ? localInverseLoss : localDirectLoss;
  const weight = clamp(
    EXPERT_PRIOR_WEIGHT[expertId] * Math.exp(learningRate * (0.25 - selectedLoss)),
    0.12,
    3,
  );
  const selectedHits = inverted
    ? regime.inverseHits + global.inverseHits
    : regime.hits + global.hits;
  const accuracy = (selectedHits + 4) / (regime.samples + global.samples + 8);
  return { weight, accuracy: clamp(accuracy, 0, 1), inverted };
}

function buildProjection(
  candles: Candle[],
  features: Feature[],
  targetIndex: number,
  horizon: number,
  analogs: AnalogNeighbor[],
): AdaptiveProjection[] {
  const current = candles[targetIndex]!.c;
  const currentAtr = features[targetIndex]!.atr;
  const projection: AdaptiveProjection[] = [];
  for (let step = 1; step <= horizon; step++) {
    const paths = analogs
      .filter((neighbor) => neighbor.index + step <= targetIndex)
      .map((neighbor) => ({
        value:
          (candles[neighbor.index + step]!.c - candles[neighbor.index]!.c) /
          features[neighbor.index]!.atr,
        weight: neighbor.weight,
      }));
    projection.push({
      step,
      bear: round(current + percentile(paths, 0.25) * currentAtr, 3),
      base: round(current + percentile(paths, 0.5) * currentAtr, 3),
      bull: round(current + percentile(paths, 0.75) * currentAtr, 3),
    });
  }
  return projection;
}

/**
 * Historical replay learner.
 *
 * At simulated candle i the learner first reveals only predictions whose
 * complete horizon has matured at i. It then predicts i+h using candles at or
 * before i. This delayed update queue is the core no-look-ahead invariant.
 */
export function runAdaptiveReplay(
  candlesInput: Candle[],
  options: AdaptiveReplayOptions = {},
): AdaptiveReplayDecision {
  const horizon = Math.max(1, Math.floor(options.horizon ?? 5));
  const minFeatureIndex = Math.max(
    50,
    Math.floor(options.minFeatureIndex ?? DEFAULT_MIN_FEATURE_INDEX),
  );
  const minCalibrationSamples = Math.max(
    8,
    Math.floor(options.minCalibrationSamples ?? DEFAULT_MIN_CALIBRATION_SAMPLES),
  );
  const decay = clamp(options.decay ?? 0.985, 0.9, 1);
  const learningRate = clamp(options.learningRate ?? 5, 0.5, 12);
  const asOf = options.asOf ?? Number.MAX_SAFE_INTEGER;
  const candles = [...candlesInput]
    .filter((candle) => candle.t <= asOf)
    .sort((a, b) => a.t - b.t)
    .filter((candle, index, source) => index === 0 || candle.t > source[index - 1]!.t);

  const empty: AdaptiveReplayDecision = {
    version: ADAPTIVE_REPLAY_VERSION,
    direction: "WAIT",
    probabilityUp: 0.5,
    edge: 0,
    confidence: 50,
    regime: "ranging",
    calibrated: false,
    sampleCount: 0,
    directionalSample: 0,
    directionalHits: 0,
    accuracy: null,
    coverage: null,
    lastLearnedOutcomeTime: null,
    experts: emptyExpertAudit(),
    analog: { neighborCount: 0, effectiveSamples: 0 },
    projection: [],
  };
  if (candles.length <= minFeatureIndex) return empty;

  const features = buildFeatures(candles);
  const global = Object.fromEntries(EXPERT_IDS.map((id) => [id, emptySkill()])) as Record<
    AdaptiveExpertId,
    SkillState
  >;
  const local = Object.fromEntries(
    EXPERT_IDS.map((id) => [
      id,
      Object.fromEntries(REGIMES.map((regime) => [regime, emptySkill()])),
    ]),
  ) as Record<AdaptiveExpertId, Record<Regime, SkillState>>;
  const pending = new Map<number, PendingPrediction[]>();
  let sampleCount = 0;
  let directionalSample = 0;
  let directionalHits = 0;
  let totalPredictions = 0;
  let lastLearnedOutcomeTime: number | null = null;
  let current: AdaptiveReplayDecision = empty;

  const updateSkill = (
    skill: SkillState,
    probabilityUp: number,
    actual: number,
    hit: boolean,
    inverseHit: boolean,
  ) => {
    skill.samples = skill.samples * decay + 1;
    skill.loss = skill.loss * decay + (probabilityUp - actual) ** 2;
    skill.inverseLoss = skill.inverseLoss * decay + (1 - probabilityUp - actual) ** 2;
    skill.hits = skill.hits * decay + (hit ? 1 : 0);
    skill.inverseHits = skill.inverseHits * decay + (inverseHit ? 1 : 0);
  };

  for (let index = minFeatureIndex; index < candles.length; index++) {
    const due = pending.get(index) ?? [];
    for (const record of due) {
      const realisedDirection = actualDirection(
        candles[index]!.c - candles[record.anchorIndex]!.c,
        features[record.anchorIndex]!.atr,
      );
      const target = actualProbability(realisedDirection);
      sampleCount++;
      lastLearnedOutcomeTime = candles[index]!.t;
      if (record.direction !== "WAIT") {
        directionalSample++;
        if (record.direction === realisedDirection) directionalHits++;
      }
      for (const id of EXPERT_IDS) {
        const prediction = record.experts[id];
        const predictedDirection = directionFromProbability(
          prediction.probabilityUp,
          record.regime,
        );
        const hit = predictedDirection !== "WAIT" && predictedDirection === realisedDirection;
        const inverseDirection =
          predictedDirection === "BUY" ? "SELL" : predictedDirection === "SELL" ? "BUY" : "WAIT";
        const inverseHit = inverseDirection !== "WAIT" && inverseDirection === realisedDirection;
        updateSkill(global[id], prediction.probabilityUp, target, hit, inverseHit);
        updateSkill(local[id][record.regime], prediction.probabilityUp, target, hit, inverseHit);
      }
    }

    const { experts, analogs } = predictExperts(candles, features, index, horizon, minFeatureIndex);
    const regime = features[index]!.regime;
    const rawWeights = Object.fromEntries(
      EXPERT_IDS.map((id) => [id, skillWeight(id, global[id], local[id][regime], learningRate)]),
    ) as Record<AdaptiveExpertId, { weight: number; accuracy: number; inverted: boolean }>;
    const totalWeight = EXPERT_IDS.reduce((sum, id) => sum + rawWeights[id].weight, 0);
    const probabilityUp = totalWeight
      ? EXPERT_IDS.reduce(
          (sum, id) =>
            sum +
            (rawWeights[id].inverted ? 1 - experts[id].probabilityUp : experts[id].probabilityUp) *
              rawWeights[id].weight,
          0,
        ) / totalWeight
      : 0.5;
    const direction = directionFromProbability(probabilityUp, regime);
    const edge = clamp((probabilityUp - 0.5) * 2);
    const calibrated = sampleCount >= minCalibrationSamples;
    const maturity = Math.min(1, sampleCount / minCalibrationSamples);
    const confidence = Math.round(clamp(50 + Math.abs(edge) * 38 + maturity * 8, 50, 92));
    const effectiveSamples = analogs.reduce((sum, item) => sum + item.weight, 0);
    const expertAudit = Object.fromEntries(
      EXPERT_IDS.map((id) => [
        id,
        {
          probabilityUp: round(
            rawWeights[id].inverted ? 1 - experts[id].probabilityUp : experts[id].probabilityUp,
          ),
          weight: round(rawWeights[id].weight / totalWeight),
          inverted: rawWeights[id].inverted,
          globalSamples: round(global[id].samples, 2),
          regimeSamples: round(local[id][regime].samples, 2),
          posteriorAccuracy: round(rawWeights[id].accuracy),
        },
      ]),
    ) as Record<AdaptiveExpertId, AdaptiveExpertAudit>;

    totalPredictions++;
    current = {
      version: ADAPTIVE_REPLAY_VERSION,
      direction,
      probabilityUp: round(probabilityUp),
      edge: round(edge),
      confidence,
      regime,
      calibrated,
      sampleCount,
      directionalSample,
      directionalHits,
      accuracy: directionalSample ? Math.round((directionalHits / directionalSample) * 100) : null,
      coverage: totalPredictions
        ? Math.round((directionalSample / Math.max(1, sampleCount)) * 100)
        : null,
      lastLearnedOutcomeTime,
      experts: expertAudit,
      analog: { neighborCount: analogs.length, effectiveSamples: round(effectiveSamples, 2) },
      projection: buildProjection(candles, features, index, horizon, analogs),
    };

    const dueIndex = index + horizon;
    if (dueIndex < candles.length) {
      const queue = pending.get(dueIndex) ?? [];
      queue.push({ dueIndex, anchorIndex: index, regime, direction, experts });
      pending.set(dueIndex, queue);
    }
  }

  return current;
}

import {
  runAdaptiveReplay,
  runAdaptiveReplayTrace,
  type AdaptiveExpertId,
  type AdaptiveReplayOptions,
  type AdaptiveReplayTracePoint,
} from "./adaptive-replay";
import { atr } from "./indicators";
import { MIN_WARMUP_CANDLES } from "./market/provider";
import type { Candle, Direction, Regime } from "./types";

export const WALK_FORWARD_EXPERIMENT_VERSION = "1.0.0";

export type WalkForwardMode = "anchored" | "rolling";
export type UtcSessionBucket = "utc_00_06" | "utc_06_12" | "utc_12_18" | "utc_18_24";

type ResearchAdaptiveOptions = Omit<AdaptiveReplayOptions, "asOf" | "horizon">;

export interface WalkForwardExperimentOptions {
  horizon?: number;
  foldCount?: number;
  mode?: WalkForwardMode;
  evaluationStartIndex?: number;
  rollingWindow?: number;
  shuffleSeed?: number;
  shiftedLabelBars?: number;
  sentinelChecks?: number;
  adaptive?: ResearchAdaptiveOptions;
}

export interface WalkForwardObservation {
  anchorIndex: number;
  asOf: number;
  regime: Regime;
  session: UtcSessionBucket;
  prediction: Direction;
  probabilityUp: number;
  actual: Direction;
}

export interface EvaluationMetrics {
  sample: number;
  directional: number;
  hits: number;
  accuracy: number | null;
  coverage: number | null;
  waits: number;
  severeOpposite: number;
  severeOppositeRate: number | null;
  softBrier: number | null;
}

export interface EvaluationBreakdown extends EvaluationMetrics {
  byRegime: Partial<Record<Regime, EvaluationMetrics>>;
  bySession: Partial<Record<UtcSessionBucket, EvaluationMetrics>>;
}

export interface ChronologicalFold {
  id: number;
  startAsOf: number;
  endAsOf: number;
  metrics: EvaluationBreakdown;
}

export interface NegativeControlReport {
  shuffledLabels: EvaluationMetrics;
  shiftedLabels: EvaluationMetrics;
  shiftedLabelBars: number;
  futureLeakChecks: number;
  futureLeakMismatches: number;
}

export interface WalkForwardExperimentReport {
  version: typeof WALK_FORWARD_EXPERIMENT_VERSION;
  mode: WalkForwardMode;
  horizon: number;
  foldCount: number;
  evaluationStartIndex: number;
  rollingWindow: number | null;
  observations: WalkForwardObservation[];
  aggregate: EvaluationBreakdown;
  folds: ChronologicalFold[];
  controls: NegativeControlReport;
}

export type AblationId =
  | "champion"
  | `without_${AdaptiveExpertId}`
  | "without_inversion"
  | "without_regime_skill"
  | "without_analog_recency";

export interface AblationResult {
  id: AblationId;
  metrics: EvaluationMetrics;
  accuracyDelta: number | null;
  coverageDelta: number | null;
  severeOppositeDelta: number;
  softBrierDelta: number | null;
}

export interface AdaptiveAblationReport {
  version: typeof WALK_FORWARD_EXPERIMENT_VERSION;
  trialCount: number;
  fixedBeforeEvaluation: true;
  variants: AblationResult[];
}

interface LabelledObservation extends WalkForwardObservation {
  scoredActual: Direction;
}

const EXPERT_IDS: AdaptiveExpertId[] = ["tape", "trend", "mean_reversion", "breakout", "analog"];

const ABLATION_VARIANTS: Array<{ id: AblationId; adaptive: ResearchAdaptiveOptions }> = [
  { id: "champion", adaptive: {} },
  ...EXPERT_IDS.map((expert) => ({
    id: `without_${expert}` as AblationId,
    adaptive: { disabledExperts: [expert] },
  })),
  { id: "without_inversion", adaptive: { enableInversion: false } },
  { id: "without_regime_skill", adaptive: { useRegimeSkill: false } },
  { id: "without_analog_recency", adaptive: { useAnalogRecency: false } },
];

const round = (value: number, digits = 4) => +value.toFixed(digits);

const percent = (value: number, total: number) => (total ? round((value / total) * 100, 2) : null);

function outcomeTarget(direction: Direction): number {
  return direction === "BUY" ? 1 : direction === "SELL" ? 0 : 0.5;
}

function opposite(a: Direction, b: Direction): boolean {
  return (a === "BUY" && b === "SELL") || (a === "SELL" && b === "BUY");
}

function actualDirection(candles: Candle[], anchorIndex: number, horizon: number): Direction {
  const anchor = candles[anchorIndex]!;
  const outcome = candles[anchorIndex + horizon]!;
  const atrValue = Math.max(
    atr(candles.slice(Math.max(0, anchorIndex - 79), anchorIndex + 1), 14) || 0,
    Number.EPSILON,
  );
  const move = outcome.c - anchor.c;
  const threshold = atrValue * 0.35;
  if (move > threshold) return "BUY";
  if (move < -threshold) return "SELL";
  return "WAIT";
}

function sessionBucket(timestamp: number): UtcSessionBucket {
  const hour = new Date(timestamp).getUTCHours();
  if (hour < 6) return "utc_00_06";
  if (hour < 12) return "utc_06_12";
  if (hour < 18) return "utc_12_18";
  return "utc_18_24";
}

function metricOf(observations: LabelledObservation[]): EvaluationMetrics {
  let directional = 0;
  let hits = 0;
  let waits = 0;
  let severeOpposite = 0;
  let brier = 0;

  for (const observation of observations) {
    if (observation.prediction === "WAIT") {
      waits++;
    } else {
      directional++;
      if (observation.prediction === observation.scoredActual) hits++;
      if (opposite(observation.prediction, observation.scoredActual)) severeOpposite++;
    }
    brier += (observation.probabilityUp - outcomeTarget(observation.scoredActual)) ** 2;
  }

  return {
    sample: observations.length,
    directional,
    hits,
    accuracy: percent(hits, directional),
    coverage: percent(directional, observations.length),
    waits,
    severeOpposite,
    severeOppositeRate: percent(severeOpposite, directional),
    softBrier: observations.length ? round(brier / observations.length) : null,
  };
}

function breakdownOf(observations: WalkForwardObservation[]): EvaluationBreakdown {
  const labelled = observations.map((observation) => ({
    ...observation,
    scoredActual: observation.actual,
  }));
  const byRegime: Partial<Record<Regime, EvaluationMetrics>> = {};
  const bySession: Partial<Record<UtcSessionBucket, EvaluationMetrics>> = {};

  for (const regime of ["trending_up", "trending_down", "ranging", "volatile"] as Regime[]) {
    const selected = labelled.filter((observation) => observation.regime === regime);
    if (selected.length) byRegime[regime] = metricOf(selected);
  }
  for (const session of [
    "utc_00_06",
    "utc_06_12",
    "utc_12_18",
    "utc_18_24",
  ] as UtcSessionBucket[]) {
    const selected = labelled.filter((observation) => observation.session === session);
    if (selected.length) bySession[session] = metricOf(selected);
  }

  return { ...metricOf(labelled), byRegime, bySession };
}

function normaliseCandles(candles: Candle[]): Candle[] {
  return [...candles]
    .sort((a, b) => a.t - b.t)
    .filter((candle, index, source) => index === 0 || candle.t > source[index - 1]!.t);
}

function traceObservation(
  trace: AdaptiveReplayTracePoint,
  candles: Candle[],
  anchorIndex: number,
  horizon: number,
): WalkForwardObservation {
  return {
    anchorIndex,
    asOf: candles[anchorIndex]!.t,
    regime: trace.regime,
    session: sessionBucket(candles[anchorIndex]!.t),
    prediction: trace.direction,
    probabilityUp: trace.probabilityUp,
    actual: actualDirection(candles, anchorIndex, horizon),
  };
}

function anchoredObservations(
  candles: Candle[],
  horizon: number,
  evaluationStartIndex: number,
  adaptive: ResearchAdaptiveOptions,
): WalkForwardObservation[] {
  const trace = runAdaptiveReplayTrace(candles, { ...adaptive, horizon });
  return trace
    .filter(
      (point) =>
        point.anchorIndex >= evaluationStartIndex && point.anchorIndex + horizon < candles.length,
    )
    .map((point) => traceObservation(point, candles, point.anchorIndex, horizon));
}

function rollingObservations(
  candles: Candle[],
  horizon: number,
  evaluationStartIndex: number,
  rollingWindow: number,
  adaptive: ResearchAdaptiveOptions,
): WalkForwardObservation[] {
  const observations: WalkForwardObservation[] = [];
  for (
    let anchorIndex = evaluationStartIndex;
    anchorIndex + horizon < candles.length;
    anchorIndex++
  ) {
    const start = Math.max(0, anchorIndex - rollingWindow + 1);
    const window = candles.slice(start, anchorIndex + 1);
    const decision = runAdaptiveReplay(window, { ...adaptive, horizon });
    observations.push({
      anchorIndex,
      asOf: candles[anchorIndex]!.t,
      regime: decision.regime,
      session: sessionBucket(candles[anchorIndex]!.t),
      prediction: decision.direction,
      probabilityUp: decision.probabilityUp,
      actual: actualDirection(candles, anchorIndex, horizon),
    });
  }
  return observations;
}

function splitFolds(
  observations: WalkForwardObservation[],
  requested: number,
): ChronologicalFold[] {
  if (!observations.length) return [];
  const count = Math.min(Math.max(1, Math.floor(requested)), observations.length);
  const baseSize = Math.floor(observations.length / count);
  const remainder = observations.length % count;
  const folds: ChronologicalFold[] = [];
  let cursor = 0;

  for (let index = 0; index < count; index++) {
    const size = baseSize + (index < remainder ? 1 : 0);
    const selected = observations.slice(cursor, cursor + size);
    folds.push({
      id: index + 1,
      startAsOf: selected[0]!.asOf,
      endAsOf: selected[selected.length - 1]!.asOf,
      metrics: breakdownOf(selected),
    });
    cursor += size;
  }
  return folds;
}

function shuffled<T>(values: T[], seed: number): T[] {
  const output = [...values];
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  for (let index = output.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [output[index], output[target]] = [output[target]!, output[index]!];
  }
  return output;
}

function scoreLabels(
  observations: WalkForwardObservation[],
  labels: Direction[],
): EvaluationMetrics {
  return metricOf(
    observations.slice(0, labels.length).map((observation, index) => ({
      ...observation,
      scoredActual: labels[index]!,
    })),
  );
}

function sentinelReport(
  candles: Candle[],
  observations: WalkForwardObservation[],
  horizon: number,
  requestedChecks: number,
  mode: WalkForwardMode,
  rollingWindow: number,
  adaptive: ResearchAdaptiveOptions,
): { checks: number; mismatches: number } {
  if (!observations.length || requestedChecks <= 0) return { checks: 0, mismatches: 0 };
  const count = Math.min(Math.max(1, Math.floor(requestedChecks)), observations.length);
  const positions = new Set<number>();
  for (let index = 0; index < count; index++) {
    positions.add(Math.round((index * (observations.length - 1)) / Math.max(1, count - 1)));
  }

  let mismatches = 0;
  for (const position of positions) {
    const observation = observations[position]!;
    const start = mode === "rolling" ? Math.max(0, observation.anchorIndex - rollingWindow + 1) : 0;
    const prefix = candles.slice(start, observation.anchorIndex + 1);
    const fullWindow = candles.slice(start);
    const prefixDecision = runAdaptiveReplay(prefix, { ...adaptive, horizon });
    const boundedFullDecision = runAdaptiveReplay(fullWindow, {
      ...adaptive,
      asOf: observation.asOf,
      horizon,
    });
    const prefixSignature = JSON.stringify({
      direction: prefixDecision.direction,
      probabilityUp: prefixDecision.probabilityUp,
      sampleCount: prefixDecision.sampleCount,
      regime: prefixDecision.regime,
      experts: prefixDecision.experts,
    });
    const fullSignature = JSON.stringify({
      direction: boundedFullDecision.direction,
      probabilityUp: boundedFullDecision.probabilityUp,
      sampleCount: boundedFullDecision.sampleCount,
      regime: boundedFullDecision.regime,
      experts: boundedFullDecision.experts,
    });
    if (prefixSignature !== fullSignature) mismatches++;
  }
  return { checks: positions.size, mismatches };
}

function collectObservations(
  candles: Candle[],
  options: Required<
    Pick<
      WalkForwardExperimentOptions,
      "horizon" | "mode" | "evaluationStartIndex" | "rollingWindow"
    >
  > & { adaptive: ResearchAdaptiveOptions },
): WalkForwardObservation[] {
  return options.mode === "rolling"
    ? rollingObservations(
        candles,
        options.horizon,
        options.evaluationStartIndex,
        options.rollingWindow,
        options.adaptive,
      )
    : anchoredObservations(
        candles,
        options.horizon,
        options.evaluationStartIndex,
        options.adaptive,
      );
}

export function runWalkForwardExperiment(
  candlesInput: Candle[],
  options: WalkForwardExperimentOptions = {},
): WalkForwardExperimentReport {
  const candles = normaliseCandles(candlesInput);
  const horizon = Math.max(1, Math.floor(options.horizon ?? 5));
  const mode = options.mode ?? "anchored";
  const evaluationStartIndex = Math.max(
    0,
    Math.floor(options.evaluationStartIndex ?? MIN_WARMUP_CANDLES - 1),
  );
  const rollingWindow = Math.max(70, Math.floor(options.rollingWindow ?? 240));
  const adaptive = options.adaptive ?? {};
  const observations = collectObservations(candles, {
    horizon,
    mode,
    evaluationStartIndex,
    rollingWindow,
    adaptive,
  });
  const shiftedLabelBars = Math.min(
    // Keep the control well beyond the five-candle outcome window so nearby,
    // overlapping trend labels do not masquerade as an independent control.
    Math.max(horizon + 1, Math.floor(options.shiftedLabelBars ?? horizon * 6 + 1)),
    Math.max(1, observations.length - 1),
  );
  const shuffledLabels = shuffled(
    observations.map((observation) => observation.actual),
    options.shuffleSeed ?? 0x5eed1234,
  );
  const shiftedLabels = observations
    .slice(shiftedLabelBars)
    .map((observation) => observation.actual);
  const sentinel = sentinelReport(
    candles,
    observations,
    horizon,
    options.sentinelChecks ?? 5,
    mode,
    rollingWindow,
    adaptive,
  );

  const folds = splitFolds(observations, options.foldCount ?? 4);

  return {
    version: WALK_FORWARD_EXPERIMENT_VERSION,
    mode,
    horizon,
    foldCount: folds.length,
    evaluationStartIndex,
    rollingWindow: mode === "rolling" ? rollingWindow : null,
    observations,
    aggregate: breakdownOf(observations),
    folds,
    controls: {
      shuffledLabels: scoreLabels(observations, shuffledLabels),
      shiftedLabels: scoreLabels(observations, shiftedLabels),
      shiftedLabelBars,
      futureLeakChecks: sentinel.checks,
      futureLeakMismatches: sentinel.mismatches,
    },
  };
}

/**
 * Fixed, pre-declared ablation matrix. It measures contribution; it must not
 * be used to select a winner on the same fixture that produced the report.
 */
export function runAdaptiveAblation(
  candlesInput: Candle[],
  options: Omit<WalkForwardExperimentOptions, "adaptive" | "mode"> = {},
): AdaptiveAblationReport {
  const candles = normaliseCandles(candlesInput);
  const horizon = Math.max(1, Math.floor(options.horizon ?? 5));
  const evaluationStartIndex = Math.max(
    0,
    Math.floor(options.evaluationStartIndex ?? MIN_WARMUP_CANDLES - 1),
  );
  const metrics = ABLATION_VARIANTS.map((variant) => ({
    id: variant.id,
    metrics: breakdownOf(
      anchoredObservations(candles, horizon, evaluationStartIndex, variant.adaptive),
    ),
  }));
  const champion = metrics[0]!.metrics;

  return {
    version: WALK_FORWARD_EXPERIMENT_VERSION,
    trialCount: metrics.length,
    fixedBeforeEvaluation: true,
    variants: metrics.map(({ id, metrics: result }) => ({
      id,
      metrics: result,
      accuracyDelta:
        result.accuracy === null || champion.accuracy === null
          ? null
          : round(result.accuracy - champion.accuracy, 2),
      coverageDelta:
        result.coverage === null || champion.coverage === null
          ? null
          : round(result.coverage - champion.coverage, 2),
      severeOppositeDelta: result.severeOpposite - champion.severeOpposite,
      softBrierDelta:
        result.softBrier === null || champion.softBrier === null
          ? null
          : round(result.softBrier - champion.softBrier),
    })),
  };
}

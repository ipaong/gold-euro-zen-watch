import { buildConsensus } from "./consensus";
import { runEnsemble } from "./ensemble";
import { runForecast } from "./forecast/engine";
import { buildChronologicalCalibration } from "./learning-calibration";
import { frozenMarketProvider } from "./market/frozen-provider";
import type { MarketDataProvider } from "./market/provider";
import { runVotingModels } from "./models";
import { buildNarrative, buildPlan } from "./narrative";
import { frozenNewsProvider } from "./news/frozen-news";
import { buildSnapshot } from "./snapshot";
import type { AnalysisResult, AppSettings, NewsSnapshot, Prediction } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  confidenceThreshold: 60,
  minAgreement: 3,
  newsAvoidMinutes: 30,
  horizon: 5,
};

/**
 * One-way pipeline:
 * snapshot + news → 5 voting models → ensemble (commentary) → forecast
 * → quality gate → final signal → narrative.
 *
 * `liveNews` is the real news snapshot (fetched + AI-interpreted on the
 * server). When it is missing we fall back to the frozen demo news so the
 * app still analyses instead of inventing anything.
 */
export function analyze(
  asOf: number,
  settings: AppSettings = DEFAULT_SETTINGS,
  liveNews?: NewsSnapshot | null,
  marketProvider: MarketDataProvider = frozenMarketProvider,
  learningHistory: Prediction[] = [],
): AnalysisResult {
  const snapshot = buildSnapshot(marketProvider, asOf);
  const news = liveNews ?? frozenNewsProvider.buildSnapshot(asOf);

  const models = runVotingModels(snapshot, news);
  const learning = buildChronologicalCalibration(
    learningHistory,
    asOf,
    snapshot.symbol,
    snapshot.timeframe,
    models,
  );
  const ensemble = runEnsemble(snapshot, news, models);
  const { scenarios, forecast, quality } = runForecast(snapshot, settings.horizon);

  const consensus = buildConsensus(snapshot, news, models, settings, quality, learning);
  const plan = buildPlan(snapshot, consensus, news.riskLevel);
  const narrative = buildNarrative(snapshot, news, models, ensemble, consensus, plan);

  return { snapshot, news, models, ensemble, scenarios, forecast, consensus, plan, narrative };
}

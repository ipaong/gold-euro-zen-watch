import { buildConsensus } from "./consensus";
import { runEnsemble } from "./ensemble";
import { runForecast } from "./forecast/engine";
import { frozenMarketProvider } from "./market/frozen-provider";
import { runVotingModels } from "./models";
import { buildNarrative, buildPlan } from "./narrative";
import { frozenNewsProvider } from "./news/frozen-news";
import { buildSnapshot } from "./snapshot";
import type { AnalysisResult, AppSettings } from "./types";

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
 */
export function analyze(asOf: number, settings: AppSettings = DEFAULT_SETTINGS): AnalysisResult {
  const snapshot = buildSnapshot(frozenMarketProvider, asOf);
  const news = frozenNewsProvider.buildSnapshot(asOf);

  const models = runVotingModels(snapshot, news);
  const ensemble = runEnsemble(snapshot, news, models);
  const { scenarios, forecast, quality } = runForecast(snapshot, settings.horizon);

  const consensus = buildConsensus(snapshot, news, models, settings, quality);
  const plan = buildPlan(snapshot, consensus, news.riskLevel);
  const narrative = buildNarrative(snapshot, news, models, ensemble, consensus, plan);

  return { snapshot, news, models, ensemble, scenarios, forecast, consensus, plan, narrative };
}

import type { MarketSnapshot, ModelVote, NewsSnapshot } from "../types";
import { momentumModel } from "./momentum";
import { newsModel } from "./news";
import { technicalModel } from "./technical";
import { trendModel } from "./trend";
import { volatilityModel } from "./volatility";

/**
 * Five supporting model cards. Direction Engine V2 owns the final five-candle
 * call; these remain independently scored diagnostics and explanations.
 */
export function runVotingModels(s: MarketSnapshot, n: NewsSnapshot): ModelVote[] {
  const models: ModelVote[] = [];
  const safe = (fn: () => ModelVote, id: ModelVote["id"], name: string): ModelVote => {
    try {
      return fn();
    } catch {
      return {
        id,
        name,
        direction: "WAIT",
        confidence: 0,
        summary: "โมเดลนี้ใช้งานไม่ได้ในขณะนี้",
        factors: [],
        risks: ["โมเดลคำนวณไม่สำเร็จ จึงไม่ถูกนับเป็นเสียงโหวต"],
        unavailable: true,
      };
    }
  };

  models.push(safe(() => trendModel(s), "trend", "เทรนด์"));
  models.push(safe(() => momentumModel(s), "momentum", "โมเมนตัม"));
  models.push(safe(() => technicalModel(s), "technical", "โครงสร้างราคา"));
  models.push(safe(() => newsModel(s, n), "news", "ข่าว & มหภาค"));
  models.push(safe(() => volatilityModel(s), "volatility", "ความผันผวน & สถิติ"));
  return models;
}

export { trendModel, momentumModel, technicalModel, newsModel, volatilityModel };

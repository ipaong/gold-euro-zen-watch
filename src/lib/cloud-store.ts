import { supabase } from "@/integrations/supabase/client";

import { DEFAULT_SETTINGS } from "./analysis";
import { getDeviceId } from "./device";
import {
  clearPredictions as clearLocalPredictions,
  loadPredictions as loadLocalPredictions,
} from "./storage";
import type { AiExplanation, AppSettings, Candle, Prediction, Score } from "./types";

/**
 * Phase 2A: Lovable Cloud is the source of truth for saved predictions.
 * The snapshot column is written once and never rewritten (a database trigger
 * enforces it), so a locked prediction is genuinely append-only now.
 */

const MIGRATED_KEY = "xaueur-lab:cloud-migrated:v1";

type SnapshotPayload = Omit<Prediction, "actual" | "score" | "ai">;

function toSnapshot(p: Prediction): SnapshotPayload {
  const { actual: _a, score: _s, ai: _ai, ...rest } = p;
  return rest;
}

type PredictionRow = {
  id: string;
  snapshot: unknown;
  ai_explanation: unknown;
};

type ResultRow = {
  prediction_id: string;
  actual: unknown;
  score: unknown;
};

function rowToPrediction(row: PredictionRow, result?: ResultRow): Prediction {
  const snapshot = row.snapshot as SnapshotPayload;
  return {
    ...snapshot,
    id: row.id,
    actual: (result?.actual as Candle[] | undefined) ?? null,
    score: (result?.score as Score | undefined) ?? null,
    ai: (row.ai_explanation as AiExplanation | null) ?? null,
    locked: true,
  };
}

export async function listPredictions(): Promise<Prediction[]> {
  const deviceId = getDeviceId();
  const [{ data: preds, error }, { data: results }] = await Promise.all([
    supabase
      .from("predictions")
      .select("id, snapshot, ai_explanation")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("prediction_results").select("prediction_id, actual, score").eq("device_id", deviceId),
  ]);
  if (error) throw error;
  const byId = new Map((results ?? []).map((r) => [r.prediction_id, r as ResultRow]));
  return (preds ?? []).map((row) => rowToPrediction(row as PredictionRow, byId.get(row.id)));
}

export async function savePrediction(p: Prediction): Promise<void> {
  const deviceId = getDeviceId();
  const { error } = await supabase.from("predictions").insert({
    id: p.id,
    device_id: deviceId,
    as_of: p.asOf,
    mode: p.mode,
    symbol: p.symbol,
    timeframe: p.timeframe,
    horizon: p.horizon,
    price: p.price,
    snapshot: toSnapshot(p) as never,
    ai_explanation: (p.ai ?? null) as never,
    locked: true,
  });
  if (error) throw error;
}

/** Only the reveal fields may be written after locking — one time only. */
export async function attachOutcome(id: string, actual: Candle[], score: Score): Promise<void> {
  const { error } = await supabase.from("prediction_results").insert({
    prediction_id: id,
    device_id: getDeviceId(),
    actual: actual as never,
    score: score as never,
  });
  if (error) throw error;
}

export async function deletePrediction(id: string): Promise<void> {
  const { error } = await supabase
    .from("predictions")
    .delete()
    .eq("id", id)
    .eq("device_id", getDeviceId());
  if (error) throw error;
}

export async function clearPredictions(): Promise<void> {
  const { error } = await supabase.from("predictions").delete().eq("device_id", getDeviceId());
  if (error) throw error;
}

export async function loadSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("settings")
    .eq("device_id", getDeviceId())
    .maybeSingle();
  if (error || !data) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(data.settings as Partial<AppSettings>) };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await supabase
    .from("app_settings")
    .upsert({ device_id: getDeviceId(), settings: s as never }, { onConflict: "device_id" });
}

/** One-time lift of anything already saved in this browser's localStorage. */
export async function migrateLocalPredictions(): Promise<number> {
  if (typeof window === "undefined" || !window.localStorage) return 0;
  if (window.localStorage.getItem(MIGRATED_KEY)) return 0;
  const local = loadLocalPredictions();
  window.localStorage.setItem(MIGRATED_KEY, String(Date.now()));
  if (!local.length) return 0;

  let moved = 0;
  for (const p of local) {
    try {
      await savePrediction(p);
      if (p.actual && p.score) await attachOutcome(p.id, p.actual, p.score);
      moved++;
    } catch {
      /* duplicate or bad row — skip it, the cloud copy wins */
    }
  }
  if (moved) clearLocalPredictions();
  return moved;
}

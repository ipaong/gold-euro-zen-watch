import { supabase } from "@/integrations/supabase/client";

import { DEFAULT_SETTINGS } from "./analysis";
import { getAnonymousUserId } from "./auth";
import { getDeviceId } from "./device";
import {
  clearPredictions as clearLocalPredictions,
  loadPredictions as loadLocalPredictions,
} from "./storage";
import type { AiExplanation, AppSettings, Candle, Prediction, Score } from "./types";

/**
 * Phase 0: Lovable Cloud is the source of truth for saved predictions.
 * Ownership and security are strictly governed by Supabase Auth user_id (via Anonymous Auth).
 * Legacy device_id is retained solely as non-security telemetry metadata.
 * The snapshot column is written once and never rewritten (enforced by DB trigger).
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

// Helper to query tables with columns added in the Phase 0 forward-only migration
// without violating readonly auto-generated types in src/integrations/supabase/types.ts
const fromTable = (table: "predictions" | "prediction_results" | "app_settings") =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase.from(table) as any);

export async function listPredictions(): Promise<Prediction[]> {
  const userId = await getAnonymousUserId();
  const [{ data: preds, error: predictionsError }, { data: results, error: resultsError }] =
    await Promise.all([
    fromTable("predictions")
      .select("id, snapshot, ai_explanation")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    fromTable("prediction_results")
      .select("prediction_id, actual, score")
      .eq("user_id", userId),
    ]);
  if (predictionsError) throw predictionsError;
  if (resultsError) throw resultsError;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map<string, ResultRow>((results ?? []).map((r: any) => [r.prediction_id, r as ResultRow]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (preds ?? []).map((row: any) => rowToPrediction(row as PredictionRow, byId.get(row.id)));
}

export async function savePrediction(p: Prediction): Promise<void> {
  const userId = await getAnonymousUserId();
  const { error } = await fromTable("predictions").insert({
    id: p.id,
    user_id: userId,
    device_id: getDeviceId(),
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
  const userId = await getAnonymousUserId();
  const { error } = await fromTable("prediction_results").insert({
    prediction_id: id,
    user_id: userId,
    device_id: getDeviceId(),
    actual: actual as never,
    score: score as never,
  });
  if (error) throw error;
}

export async function deletePrediction(id: string): Promise<void> {
  const userId = await getAnonymousUserId();
  const { error } = await fromTable("predictions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function clearPredictions(): Promise<void> {
  const userId = await getAnonymousUserId();
  const { error } = await fromTable("predictions").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function loadSettings(): Promise<AppSettings> {
  const userId = await getAnonymousUserId();
  const { data, error } = await fromTable("app_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(data.settings as Partial<AppSettings>) };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  const userId = await getAnonymousUserId();
  const { error } = await fromTable("app_settings").upsert(
    {
      user_id: userId,
      device_id: getDeviceId(),
      settings: s as never,
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

/** One-time lift of anything already saved in this browser's localStorage. */
export async function migrateLocalPredictions(): Promise<number> {
  if (typeof window === "undefined" || !window.localStorage) return 0;
  if (window.localStorage.getItem(MIGRATED_KEY)) return 0;
  const local = loadLocalPredictions();
  if (!local.length) {
    window.localStorage.setItem(MIGRATED_KEY, String(Date.now()));
    return 0;
  }

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
  // Never mark or clear a partial migration: a transient auth/network failure
  // must leave the browser copy available for a later retry.
  if (moved === local.length) {
    clearLocalPredictions();
    window.localStorage.setItem(MIGRATED_KEY, String(Date.now()));
  }
  return moved;
}

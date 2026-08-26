import { DEFAULT_SETTINGS } from "./analysis";
import type { AppSettings, Prediction } from "./types";

/**
 * Phase 1 persistence = localStorage only.
 * "Locked" here means the app never rewrites a saved prediction's forecast —
 * it is an app-level lock, not a cryptographic guarantee. Phase 2 moves this
 * to the database where it becomes truly append-only.
 */
const PRED_KEY = "xaueur-lab:predictions:v1";
const SETTINGS_KEY = "xaueur-lab:settings:v1";

function canUse() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadPredictions(): Prediction[] {
  if (!canUse()) return [];
  try {
    const raw = window.localStorage.getItem(PRED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Prediction[]) : [];
  } catch {
    return [];
  }
}

function persist(list: Prediction[]) {
  if (!canUse()) return;
  try {
    window.localStorage.setItem(PRED_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* storage full or blocked — ignore */
  }
}

export function savePrediction(p: Prediction): Prediction[] {
  const list = loadPredictions();
  if (list.some((x) => x.id === p.id)) return list;
  const next = [{ ...p, locked: true }, ...list];
  persist(next);
  return next;
}

/** Only the reveal fields may be written after locking. */
export function attachOutcome(
  id: string,
  actual: Prediction["actual"],
  score: Prediction["score"],
): Prediction[] {
  const list = loadPredictions().map((p) =>
    p.id === id && !p.score ? { ...p, actual, score } : p,
  );
  persist(list);
  return list;
}

export function deletePrediction(id: string): Prediction[] {
  const list = loadPredictions().filter((p) => p.id !== id);
  persist(list);
  return list;
}

export function clearPredictions(): Prediction[] {
  if (canUse()) window.localStorage.removeItem(PRED_KEY);
  return [];
}

export function loadSettings(): AppSettings {
  if (!canUse()) return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings) {
  if (!canUse()) return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function newPredictionId(asOf: number) {
  return `p_${asOf}_${Math.random().toString(36).slice(2, 8)}`;
}

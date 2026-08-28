export const DEFAULT_ACTUAL_ZOOM_LIMIT = 5;

/** Available windows always include all actual candles and the 5-candle score horizon. */
export function actualZoomLevels(actualCount: number): number[] {
  if (!Number.isFinite(actualCount) || actualCount <= 0) return [];
  const count = Math.floor(actualCount);
  return [...new Set([count, 60, 30, 15, 5].filter((value) => value > 0 && value <= count))].sort(
    (a, b) => b - a,
  );
}

/** Resolve a requested limit to a real zoom level for the current number of candles. */
export function resolveActualZoomLimit(actualCount: number, requestedLimit: number): number {
  const levels = actualZoomLevels(actualCount);
  if (!levels.length) return 0;
  const requested = Number.isFinite(requestedLimit) ? requestedLimit : actualCount;
  return levels.find((level) => level <= requested) ?? levels[levels.length - 1]!;
}

/** Fewer history candles keep the prediction boundary readable as actual candles are zoomed in. */
export function zoomedHistoryLimit(
  baseLimit: number,
  actualShown: number,
  actualTotal: number,
): number {
  const base = Math.max(1, Math.floor(baseLimit));
  if (actualTotal <= 5 || actualShown >= actualTotal) return base;
  if (actualShown > 30) return Math.min(base, 20);
  if (actualShown > 15) return Math.min(base, 16);
  if (actualShown > 5) return Math.min(base, 12);
  return Math.min(base, 10);
}

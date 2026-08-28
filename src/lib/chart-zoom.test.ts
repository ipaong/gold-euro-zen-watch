import { describe, expect, it } from "vitest";

import {
  actualZoomLevels,
  DEFAULT_ACTUAL_ZOOM_LIMIT,
  resolveActualZoomLimit,
  zoomedHistoryLimit,
} from "./chart-zoom";

describe("chart actual-candle zoom", () => {
  it("offers progressively tighter windows down to the five-candle score horizon", () => {
    expect(actualZoomLevels(96)).toEqual([96, 60, 30, 15, 5]);
    expect(actualZoomLevels(20)).toEqual([20, 15, 5]);
    expect(actualZoomLevels(4)).toEqual([4]);
  });

  it("starts with the exact five-candle scoring horizon", () => {
    expect(resolveActualZoomLimit(96, DEFAULT_ACTUAL_ZOOM_LIMIT)).toBe(5);
    expect(resolveActualZoomLimit(20, DEFAULT_ACTUAL_ZOOM_LIMIT)).toBe(5);
    expect(resolveActualZoomLimit(0, DEFAULT_ACTUAL_ZOOM_LIMIT)).toBe(0);
  });

  it("reserves more chart width for the reveal window while zooming in", () => {
    expect(zoomedHistoryLimit(22, 96, 96)).toBe(22);
    expect(zoomedHistoryLimit(22, 30, 96)).toBe(16);
    expect(zoomedHistoryLimit(22, 5, 96)).toBe(10);
  });
});

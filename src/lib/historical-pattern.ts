import { atr, emaSeries, macd, rsi } from "./indicators";
import type { Candle, Direction } from "./types";

const HORIZON = 5;
const NEIGHBORS = 9;
const EDGE_THRESHOLD = 0.15;
const CALIBRATION_WINDOW = 60;
const MIN_FEATURE_INDEX = 50;

export interface HistoricalPatternDecision {
  direction: Direction;
  rawDirection: Direction;
  edge: number;
  neighborCount: number;
  calibrationSample: number;
  directHits: number;
  inverseHits: number;
  inverted: boolean;
  calibrated: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function opposite(direction: Direction): Direction {
  return direction === "BUY" ? "SELL" : direction === "SELL" ? "BUY" : "WAIT";
}

function directionOf(move: number, atrValue: number): Direction {
  const threshold = Math.max(Math.abs(atrValue) || 0, Number.EPSILON) * 0.35;
  if (move > threshold) return "BUY";
  if (move < -threshold) return "SELL";
  return "WAIT";
}

/**
 * Chronological nearest-pattern learner. A past anchor is eligible only when
 * all five candles of its outcome were already known at the target instant.
 * Its direct/inverse orientation is itself calibrated on earlier predictions,
 * so an anti-correlated pattern model cannot silently keep betting backwards.
 */
export function runHistoricalPattern(candlesInput: Candle[]): HistoricalPatternDecision {
  const candles = [...candlesInput].sort((a, b) => a.t - b.t);
  const currentIndex = candles.length - 1;
  const empty: HistoricalPatternDecision = {
    direction: "WAIT",
    rawDirection: "WAIT",
    edge: 0,
    neighborCount: 0,
    calibrationSample: 0,
    directHits: 0,
    inverseHits: 0,
    inverted: false,
    calibrated: false,
  };
  if (currentIndex < MIN_FEATURE_INDEX + HORIZON + 10) return empty;

  const closes = candles.map((candle) => candle.c);
  const ema8 = emaSeries(closes, 8);
  const ema20 = emaSeries(closes, 20);
  const atrCache = new Map<number, number>();
  const featureCache = new Map<number, number[]>();

  const atrAt = (index: number) => {
    const cached = atrCache.get(index);
    if (cached !== undefined) return cached;
    const value = atr(candles.slice(Math.max(0, index - 119), index + 1), 14) || 1;
    atrCache.set(index, value);
    return value;
  };

  const featureAt = (index: number) => {
    const cached = featureCache.get(index);
    if (cached) return cached;
    const atrValue = atrAt(index);
    const prefix = closes.slice(0, index + 1);
    const momentum = macd(prefix);
    const feature = [
      (closes[index]! - closes[index - 1]!) / atrValue,
      (closes[index]! - closes[index - 3]!) / atrValue,
      (closes[index]! - closes[index - 5]!) / atrValue,
      (closes[index]! - closes[index - 12]!) / atrValue,
      ((ema8[index] ?? closes[index]!) - (ema8[index - 3] ?? closes[index]!)) / atrValue,
      ((ema20[index] ?? closes[index]!) - (ema20[index - 5] ?? closes[index]!)) / atrValue,
      (rsi(prefix, 14) - 50) / 25,
      momentum.hist / (atrValue * 0.5),
    ].map((value) => clamp(value, -3, 3));
    featureCache.set(index, feature);
    return feature;
  };

  const predictAt = (targetIndex: number) => {
    const current = featureAt(targetIndex);
    const neighbors: { distance: number; label: Direction }[] = [];
    for (let index = MIN_FEATURE_INDEX; index + HORIZON <= targetIndex; index++) {
      const feature = featureAt(index);
      let squaredDistance = 0;
      for (let part = 0; part < feature.length; part++) {
        squaredDistance += (feature[part]! - current[part]!) ** 2;
      }
      neighbors.push({
        distance: Math.sqrt(squaredDistance),
        label: directionOf(closes[index + HORIZON]! - closes[index]!, atrAt(index)),
      });
    }
    neighbors.sort((a, b) => a.distance - b.distance);
    const votes: Record<Direction, number> = { BUY: 0, SELL: 0, WAIT: 0 };
    const selected = neighbors.slice(0, NEIGHBORS);
    for (const neighbor of selected) {
      votes[neighbor.label] += 1 / (neighbor.distance + 0.2);
    }
    const total = votes.BUY + votes.SELL + votes.WAIT;
    const edge = total ? (votes.BUY - votes.SELL) / total : 0;
    const direction: Direction =
      edge > EDGE_THRESHOLD ? "BUY" : edge < -EDGE_THRESHOLD ? "SELL" : "WAIT";
    return { direction, edge, neighborCount: selected.length };
  };

  let calibrationSample = 0;
  let directHits = 0;
  let inverseHits = 0;
  const calibrationStart = Math.max(80, currentIndex - CALIBRATION_WINDOW);
  for (let index = calibrationStart; index + HORIZON <= currentIndex; index++) {
    const prediction = predictAt(index).direction;
    if (prediction === "WAIT") continue;
    const actual = directionOf(closes[index + HORIZON]! - closes[index]!, atrAt(index));
    calibrationSample++;
    if (prediction === actual) directHits++;
    if (opposite(prediction) === actual) inverseHits++;
  }

  const current = predictAt(currentIndex);
  const calibrated = calibrationSample >= 10;
  const inverted = calibrated && inverseHits > directHits + 2;
  const direction = inverted ? opposite(current.direction) : current.direction;

  return {
    direction,
    rawDirection: current.direction,
    edge: +(inverted ? -current.edge : current.edge).toFixed(4),
    neighborCount: current.neighborCount,
    calibrationSample,
    directHits,
    inverseHits,
    inverted,
    calibrated,
  };
}

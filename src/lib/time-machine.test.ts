import { describe, expect, it } from "vitest";

import { frozenMarketProvider } from "./market/frozen-provider";
import { frozenNewsProvider } from "./news/frozen-news";

describe("Time Machine data boundaries", () => {
  it("never returns market candles after asOf", () => {
    const latest = frozenMarketProvider.getLatestTime();
    const asOf = latest - 12 * 60 * 60 * 1000;
    const visible = frozenMarketProvider.getCandlesUpTo(asOf);
    const future = frozenMarketProvider.getCandlesAfter(asOf, 5);

    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((candle) => candle.t <= asOf)).toBe(true);
    expect(future.every((candle) => candle.t > asOf)).toBe(true);
  });

  it("hides an economic event actual until its release time", () => {
    const releasedEvents = frozenNewsProvider.getEventsUpTo(Number.MAX_SAFE_INTEGER);
    const event = releasedEvents[0];

    expect(event).toBeDefined();

    const beforeRelease = frozenNewsProvider
      .getEventsUpTo(event!.time - 1)
      .find((candidate) => candidate.id === event!.id);
    const atRelease = frozenNewsProvider
      .getEventsUpTo(event!.time)
      .find((candidate) => candidate.id === event!.id);

    expect(beforeRelease).toMatchObject({ actual: null, released: false });
    expect(atRelease?.released).toBe(true);
    expect(atRelease?.actual).not.toBeNull();
  });

  it("never returns a headline published after asOf", () => {
    const all = frozenNewsProvider.getNewsUpTo(Number.MAX_SAFE_INTEGER);
    const headline = all[0];

    expect(headline).toBeDefined();
    expect(
      frozenNewsProvider
        .getNewsUpTo(headline!.publishedAt - 1)
        .some((candidate) => candidate.id === headline!.id),
    ).toBe(false);
  });
});

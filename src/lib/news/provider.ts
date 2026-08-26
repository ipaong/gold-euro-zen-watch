import type { EconomicEvent, NewsItem, NewsSnapshot } from "../types";

/**
 * News/economic-calendar abstraction. Phase 1 ships a frozen demo provider.
 * Never fabricate live headlines: if a real provider is unavailable the
 * snapshot must report available=false and confidence must be reduced.
 */
export interface NewsProvider {
  readonly id: string;
  readonly label: string;
  readonly demo: boolean;
  /** Headlines published at or before the timestamp only. */
  getNewsUpTo(timestamp: number, limit?: number): NewsItem[];
  /**
   * Calendar events visible at the timestamp. Not-yet-released events keep
   * name/time/forecast/previous but `actual` stays null until release time.
   */
  getEventsUpTo(timestamp: number, lookAheadMs?: number): EconomicEvent[];
  buildSnapshot(timestamp: number): NewsSnapshot;
}

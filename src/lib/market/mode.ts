import type { MarketMode } from "../types";

export const MARKET_MODE_STORAGE_KEY = "market-lab:mode:v1";

export const MARKET_MODE_COPY: Record<MarketMode, {
  label: string;
  shortLabel: string;
  description: string;
  instrument: string;
  /** When true the mode button is disabled and shows a "กำลังพัฒนา" badge. */
  paused: boolean;
}> = {
  cloud: {
    label: "Cloud Mode",
    shortLabel: "Cloud · Yahoo",
    description: "ราคาทองคำตลาดโลก Gold Futures (GC=F) จาก Yahoo Finance",
    instrument: "GC=F · 15m",
    paused: false,
  },
  xm: {
    label: "XM Live Mode",
    shortLabel: "XM MT5",
    description: "เชื่อมต่อบัญชีเทรด MT5 — เร็วๆ นี้",
    instrument: "GOLD · M15",
    paused: true,
  },
};

export function parseMarketMode(value: unknown): MarketMode {
  // XM is paused; any stored "xm" preference is normalised to "cloud".
  if (value === "xm" && MARKET_MODE_COPY.xm.paused) return "cloud";
  return value === "xm" ? "xm" : "cloud";
}

export function loadMarketMode(storage: Pick<Storage, "getItem"> | null | undefined): MarketMode {
  return parseMarketMode(storage?.getItem(MARKET_MODE_STORAGE_KEY));
}

export function saveMarketMode(
  storage: Pick<Storage, "setItem"> | null | undefined,
  mode: MarketMode,
): void {
  storage?.setItem(MARKET_MODE_STORAGE_KEY, mode);
}

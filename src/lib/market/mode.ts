import type { MarketMode } from "../types";

export const MARKET_MODE_STORAGE_KEY = "market-lab:mode:v1";

export const MARKET_MODE_COPY: Record<MarketMode, {
  label: string;
  shortLabel: string;
  description: string;
  instrument: string;
}> = {
  cloud: {
    label: "Cloud Mode",
    shortLabel: "Cloud · Yahoo",
    description: "ดูเทรนด์ทองโลกจาก Yahoo แบบ delayed — ไม่ใช่ราคา XM โดยตรง",
    instrument: "GC=F · COMEX Gold Futures · 15m",
  },
  xm: {
    label: "XM Live Mode",
    shortLabel: "XM · MT5 bridge",
    description: "วิเคราะห์แท่ง GOLD จาก MT5/XM ของคุณ — ต้องเปิด MT5 และ bridge บน PC",
    instrument: "GOLD · XM MT5 · M15",
  },
};

export function parseMarketMode(value: unknown): MarketMode {
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

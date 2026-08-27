import type { MarketTimeframe } from "./provider";

export type AssetClass = "commodities" | "forex" | "indices" | "stocks" | "crypto";

export interface MarketAsset {
  id: string;
  symbol: string;
  displayName: string;
  assetClass: AssetClass;
  provider: "yahoo";
  providerSymbol: string;
  defaultTimeframe: Exclude<MarketTimeframe, "M15">;
  supportedIntervals: readonly Exclude<MarketTimeframe, "M15">[];
  dataLimitations: string;
  enabled: boolean;
}

/**
 * Keep the registry explicit. Only assets marked enabled are offered to the
 * analysis UI; planned tickers stay documented until a live response is
 * validated and a truthful frozen fixture exists for fallback.
 */
export const MARKET_ASSETS = {
  gold: {
    id: "gold",
    symbol: "GC=F",
    displayName: "Gold Futures (Yahoo proxy)",
    assetClass: "commodities",
    provider: "yahoo",
    providerSymbol: "GC=F",
    defaultTimeframe: "15m",
    supportedIntervals: ["15m"],
    dataLimitations:
      "Yahoo quote is delayed and represents COMEX gold futures, not XM XAUUSD/XAUEUR CFD. Other intervals remain disabled until their fallback fixtures are validated.",

    enabled: true,
  },
  silver: {
    id: "silver",
    symbol: "SI=F",
    displayName: "Silver Futures (Yahoo proxy)",
    assetClass: "commodities",
    provider: "yahoo",
    providerSymbol: "SI=F",
    defaultTimeframe: "15m",
    supportedIntervals: ["5m", "15m", "1h", "1d"],
    dataLimitations:
      "Yahoo quote is delayed; enable only after a live response and fixture are validated.",
    enabled: false,
  },
  crudeOil: {
    id: "crude-oil",
    symbol: "CL=F",
    displayName: "Crude Oil Futures (Yahoo proxy)",
    assetClass: "commodities",
    provider: "yahoo",
    providerSymbol: "CL=F",
    defaultTimeframe: "15m",
    supportedIntervals: ["5m", "15m", "1h", "1d"],
    dataLimitations:
      "Yahoo quote is delayed; enable only after a live response and fixture are validated.",
    enabled: false,
  },
  eurusd: {
    id: "eurusd",
    symbol: "EURUSD=X",
    displayName: "EUR/USD (Yahoo proxy)",
    assetClass: "forex",
    provider: "yahoo",
    providerSymbol: "EURUSD=X",
    defaultTimeframe: "15m",
    supportedIntervals: ["5m", "15m", "1h", "1d"],
    dataLimitations: "Yahoo quote may be delayed and is not the XM execution feed.",
    enabled: false,
  },
  gbpusd: {
    id: "gbpusd",
    symbol: "GBPUSD=X",
    displayName: "GBP/USD (Yahoo proxy)",
    assetClass: "forex",
    provider: "yahoo",
    providerSymbol: "GBPUSD=X",
    defaultTimeframe: "15m",
    supportedIntervals: ["5m", "15m", "1h", "1d"],
    dataLimitations: "Yahoo quote may be delayed and is not the XM execution feed.",
    enabled: false,
  },
  usdjpy: {
    id: "usdjpy",
    symbol: "USDJPY=X",
    displayName: "USD/JPY (Yahoo proxy)",
    assetClass: "forex",
    provider: "yahoo",
    providerSymbol: "USDJPY=X",
    defaultTimeframe: "15m",
    supportedIntervals: ["5m", "15m", "1h", "1d"],
    dataLimitations: "Yahoo quote may be delayed and is not the XM execution feed.",
    enabled: false,
  },
  audusd: {
    id: "audusd",
    symbol: "AUDUSD=X",
    displayName: "AUD/USD (Yahoo proxy)",
    assetClass: "forex",
    provider: "yahoo",
    providerSymbol: "AUDUSD=X",
    defaultTimeframe: "15m",
    supportedIntervals: ["5m", "15m", "1h", "1d"],
    dataLimitations: "Yahoo quote may be delayed and is not the XM execution feed.",
    enabled: false,
  },
  nvda: {
    id: "nvda",
    symbol: "NVDA",
    displayName: "NVIDIA (Yahoo)",
    assetClass: "stocks",
    provider: "yahoo",
    providerSymbol: "NVDA",
    defaultTimeframe: "1d",
    supportedIntervals: ["1h", "1d"],
    dataLimitations:
      "Equity session gaps are expected; quote latency and corporate actions need validation.",
    enabled: false,
  },
  tsla: {
    id: "tsla",
    symbol: "TSLA",
    displayName: "Tesla (Yahoo)",
    assetClass: "stocks",
    provider: "yahoo",
    providerSymbol: "TSLA",
    defaultTimeframe: "1d",
    supportedIntervals: ["1h", "1d"],
    dataLimitations:
      "Equity session gaps are expected; quote latency and corporate actions need validation.",
    enabled: false,
  },
  amd: {
    id: "amd",
    symbol: "AMD",
    displayName: "AMD (Yahoo)",
    assetClass: "stocks",
    provider: "yahoo",
    providerSymbol: "AMD",
    defaultTimeframe: "1d",
    supportedIntervals: ["1h", "1d"],
    dataLimitations:
      "Equity session gaps are expected; quote latency and corporate actions need validation.",
    enabled: false,
  },
  pltr: {
    id: "pltr",
    symbol: "PLTR",
    displayName: "Palantir (Yahoo)",
    assetClass: "stocks",
    provider: "yahoo",
    providerSymbol: "PLTR",
    defaultTimeframe: "1d",
    supportedIntervals: ["1h", "1d"],
    dataLimitations:
      "Equity session gaps are expected; quote latency and corporate actions need validation.",
    enabled: false,
  },
  aapl: {
    id: "aapl",
    symbol: "AAPL",
    displayName: "Apple (Yahoo)",
    assetClass: "stocks",
    provider: "yahoo",
    providerSymbol: "AAPL",
    defaultTimeframe: "1d",
    supportedIntervals: ["1h", "1d"],
    dataLimitations:
      "Equity session gaps are expected; quote latency and corporate actions need validation.",
    enabled: false,
  },
  msft: {
    id: "msft",
    symbol: "MSFT",
    displayName: "Microsoft (Yahoo)",
    assetClass: "stocks",
    provider: "yahoo",
    providerSymbol: "MSFT",
    defaultTimeframe: "1d",
    supportedIntervals: ["1h", "1d"],
    dataLimitations:
      "Equity session gaps are expected; quote latency and corporate actions need validation.",
    enabled: false,
  },
} as const satisfies Record<string, MarketAsset>;

export type MarketAssetId = keyof typeof MARKET_ASSETS;

export const ACTIVE_MARKET_ASSETS = Object.values(MARKET_ASSETS).filter(
  (asset) => asset.enabled,
) as MarketAsset[];

export function findEnabledMarketAsset(id: string | undefined): MarketAsset | null {
  if (!id) return MARKET_ASSETS.gold;
  const candidate = MARKET_ASSETS[id as MarketAssetId];
  return candidate?.enabled ? candidate : null;
}

/** UI convenience helper: unknown/omitted selection resolves to the safe default. */
export function getMarketAsset(id: string | undefined): MarketAsset {
  return findEnabledMarketAsset(id) ?? MARKET_ASSETS.gold;
}

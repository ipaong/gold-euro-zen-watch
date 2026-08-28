/**
 * Safe Buffer & Anti-Bust Calculator for Gold Futures / XAUUSD.
 *
 * Translates technical levels (Support, Resistance, Invalidation, ATR) into
 * plain-language capital management, swing tolerance, and position sizing.
 */

export type Currency = "USD" | "THB";

export interface SafeBufferInput {
  balance: number;
  currency: Currency;
  lotSize: number;
  currentPrice: number;
  invalidation: number;
  atr: number;
  thbRate?: number;
}

export type SafeBufferStatus = "safe" | "moderate" | "warning" | "danger";

export interface SafeBufferResult {
  balanceUsd: number;
  balanceThb: number;
  pointValueUsd: number;
  normalSwingUsd: number;
  normalSwingThb: number;
  invalidationDistance: number;
  maxLossUsd: number;
  maxLossThb: number;
  survivalMultiplier: number;
  minSafeBalanceUsd: number;
  minSafeBalanceThb: number;
  recommendedSafeBalanceUsd: number;
  recommendedSafeBalanceThb: number;
  status: SafeBufferStatus;
  statusTitle: string;
  statusMessage: string;
  badgeLabel: string;
}

export const DEFAULT_THB_RATE = 35.5;

export function calculateSafeBuffer({
  balance,
  currency,
  lotSize,
  currentPrice,
  invalidation,
  atr,
  thbRate = DEFAULT_THB_RATE,
}: SafeBufferInput): SafeBufferResult {
  const safeLot = Math.max(0.001, lotSize);
  const safeThbRate = Math.max(1, thbRate);
  const safeBalance = Math.max(0, balance);

  const balanceUsd = currency === "THB" ? safeBalance / safeThbRate : safeBalance;
  const balanceThb = currency === "THB" ? safeBalance : safeBalance * safeThbRate;

  // 1 Standard lot of Gold = 100 oz.
  // 0.01 lot = 1 oz ($1.00 move = $1.00 USD)
  const pointValueUsd = safeLot * 100;

  const validAtr = Math.max(0.1, atr);
  const normalSwingUsd = validAtr * pointValueUsd;
  const normalSwingThb = normalSwingUsd * safeThbRate;

  const invalidationDistance = Math.max(0.1, Math.abs(currentPrice - invalidation));
  const maxLossUsd = invalidationDistance * pointValueUsd;
  const maxLossThb = maxLossUsd * safeThbRate;

  const survivalMultiplier = maxLossUsd > 0 ? balanceUsd / maxLossUsd : 0;

  const minSafeBalanceUsd = Math.max(normalSwingUsd * 2, maxLossUsd * 2.5);
  const minSafeBalanceThb = minSafeBalanceUsd * safeThbRate;

  const recommendedSafeBalanceUsd = Math.max(normalSwingUsd * 5, maxLossUsd * 5);
  const recommendedSafeBalanceThb = recommendedSafeBalanceUsd * safeThbRate;

  let status: SafeBufferStatus;
  let statusTitle: string;
  let statusMessage: string;
  let badgeLabel: string;

  const balanceText =
    currency === "THB"
      ? `${Math.round(balanceThb).toLocaleString()} บาท`
      : `$${balanceUsd.toFixed(1)}`;
  const swingText =
    currency === "THB"
      ? `${Math.round(normalSwingThb).toLocaleString()} บาท`
      : `$${normalSwingUsd.toFixed(1)}`;
  const minSafeText =
    currency === "THB"
      ? `${Math.round(minSafeBalanceThb).toLocaleString()} บาท`
      : `$${minSafeBalanceUsd.toFixed(0)}`;

  if (balanceUsd < normalSwingUsd * 1.2) {
    status = "danger";
    statusTitle = "เสี่ยงพอร์ตแตกสูงมาก (เงินทุนบางเกินไป)";
    statusMessage = `เงินในพอร์ต (${balanceText}) น้อยกว่าแรงสะบัดปกติของทอง (±${swingText}) แค่ราคาสวิงในแท่งเดียวก็อาจถูกปิดออเดอร์ก่อนกราฟจะวิ่งถูกทาง แนะนำเพิ่มเงินทุนหรือลดขนาดไม้`;
    badgeLabel = "อันตราย · เสี่ยงพอร์ตแตก";
  } else if (survivalMultiplier < 2) {
    status = "warning";
    statusTitle = "ค่อนข้างตึงตัว (ทนแรงเหวี่ยงได้จำกัด)";
    statusMessage = `พอร์ตทนแรงแกว่งได้ประมาณ ${survivalMultiplier.toFixed(1)} เท่าของจุดยอมแพ้ หากราคาเหวี่ยงผิดทางพอร์ตจะยุบลงอย่างมีนัยสำคัญ ควรมีเงินอย่างน้อย ${minSafeText}`;
    badgeLabel = "ระวัง · ทนแรงเหวี่ยงได้น้อย";
  } else if (survivalMultiplier < 5) {
    status = "moderate";
    statusTitle = "พอร์ตสมดุล (พอดีตามแผนความเสี่ยง)";
    statusMessage = `พอร์ตทนแรงแกว่งได้ ${survivalMultiplier.toFixed(1)} เท่าของจุดยอมแพ้ อยู่ในเกณฑ์มาตรฐานที่รองรับการสวิงของตลาดก่อนวิ่งในเทรนด์ได้ดี`;
    badgeLabel = "สมดุล · ตามแผน";
  } else {
    status = "safe";
    statusTitle = "พอร์ตปลอดภัยสูง (เกราะหนา ทนแรงแกว่งสบาย)";
    statusMessage = `พอร์ตมีเงินสำรองรองรับแรงแกว่งได้ถึง ${survivalMultiplier.toFixed(1)} เท่า กราฟเหวี่ยงสะบัดตามธรรมชาติจะไม่ทำให้พอร์ตแตก มีโอกาสรอให้ราคาวิ่งตามเทรนด์เต็มที่`;
    badgeLabel = "ปลอดภัยมาก · Zen Safe";
  }

  return {
    balanceUsd,
    balanceThb,
    pointValueUsd,
    normalSwingUsd,
    normalSwingThb,
    invalidationDistance,
    maxLossUsd,
    maxLossThb,
    survivalMultiplier,
    minSafeBalanceUsd,
    minSafeBalanceThb,
    recommendedSafeBalanceUsd,
    recommendedSafeBalanceThb,
    status,
    statusTitle,
    statusMessage,
    badgeLabel,
  };
}

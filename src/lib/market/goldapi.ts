import { z } from "zod";

export const GOLD_API_ENDPOINT = "https://api.gold-api.com/price/XAU/EUR" as const;
export const GOLD_API_SOURCE = "gold-api-xau-eur" as const;
export const GOLD_API_VERSION = "1.0.0" as const;
export const GOLD_API_SYMBOL = "XAU" as const;
export const GOLD_API_CURRENCY = "EUR" as const;
export const GOLD_API_MAX_AGE_MS = 5 * 60 * 1000;

export function getM15BucketStartMs(timestampMs: number): number {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) throw new Error("timestamp ไม่ถูกต้อง");
  return Math.floor(timestampMs / (15 * 60 * 1000)) * 15 * 60 * 1000;
}

const GoldApiResponseSchema = z.object({
  symbol: z.literal(GOLD_API_SYMBOL),
  currency: z.literal(GOLD_API_CURRENCY),
  price: z.number().finite().positive(),
  updatedAt: z.string().min(1),
});

export interface GoldApiPrice {
  symbol: typeof GOLD_API_SYMBOL;
  currency: typeof GOLD_API_CURRENCY;
  price: number;
  updatedAt: string;
  updatedAtMs: number;
}

function errorMessage(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`).join("; ");
}

/** Parse only the provider fields required to form a price sample. */
export function parseGoldApiResponse(payload: unknown): GoldApiPrice {
  const parsed = GoldApiResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error(`Gold API response ไม่ผ่าน schema: ${errorMessage(parsed.error)}`);

  const updatedAt = parsed.data.updatedAt.trim();
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(updatedAt)) {
    throw new Error("Gold API updatedAt ต้องระบุ timezone แบบ UTC หรือ offset");
  }
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) {
    throw new Error("Gold API updatedAt ไม่ใช่ timestamp ที่ถูกต้อง");
  }

  return { ...parsed.data, updatedAt, updatedAtMs };
}

/** Reject future or stale samples before they reach the database. */
export function assertGoldApiFreshness(
  sample: Pick<GoldApiPrice, "updatedAtMs">,
  now = Date.now(),
  maxAgeMs = GOLD_API_MAX_AGE_MS,
): void {
  if (!Number.isFinite(now) || now <= 0) throw new Error("เวลาที่รับข้อมูลไม่ถูกต้อง");
  const ageMs = now - sample.updatedAtMs;
  if (ageMs < -60 * 1000) throw new Error("Gold API updatedAt อยู่ในอนาคตเกิน tolerance");
  if (ageMs > maxAgeMs) {
    throw new Error(`Gold API response เก่าเกิน ${Math.round(maxAgeMs / 60000)} นาที`);
  }
}

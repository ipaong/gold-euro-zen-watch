const priceFmt = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtPrice(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return priceFmt.format(v);
}

export function fmtEur(v: number): string {
  return `€${fmtPrice(v)}`;
}

export function fmtPct(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

/** All internal timestamps are UTC ms; display in Asia/Bangkok. */
export function fmtTime(ms: number): string {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(ms));
}

export function fmtDateTime(ms: number): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(ms));
}

export function fmtDate(ms: number): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(ms));
}

export function fmtMinutes(mins: number): string {
  if (mins < 60) return `${mins} นาที`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
}

export const directionLabel = {
  BUY: "ซื้อ",
  SELL: "ขาย",
  WAIT: "รอ",
} as const;

export const impactLabel = {
  high: "สูง",
  medium: "กลาง",
  low: "ต่ำ",
} as const;

export const riskLabel = {
  low: "ต่ำ",
  medium: "กลาง",
  high: "สูง",
} as const;

export const goldBiasLabel = {
  bullish: "เอียงขึ้น",
  neutral: "เป็นกลาง",
  bearish: "เอียงลง",
} as const;

export const eurBiasLabel = {
  strong: "แข็งค่า",
  neutral: "เป็นกลาง",
  weak: "อ่อนค่า",
} as const;

export const regimeLabel = {
  trending_up: "เทรนด์ขาขึ้น",
  trending_down: "เทรนด์ขาลง",
  ranging: "แกว่งในกรอบ",
  volatile: "ผันผวนสูง",
} as const;

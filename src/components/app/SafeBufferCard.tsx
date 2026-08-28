import { useState } from "react";
import { AlertTriangle, CheckCircle2, DollarSign, HelpCircle, Info, Shield, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fmtPrice } from "@/lib/format";
import {
  calculateSafeBuffer,
  type Currency,
  type SafeBufferResult,
} from "@/lib/risk-calculator";
import type { TradePlan } from "@/lib/types";

const USD_PRESETS = [50, 100, 300, 500, 1000];
const THB_PRESETS = [1000, 3500, 10000, 20000, 35000];
const LOT_PRESETS = [0.01, 0.02, 0.05, 0.1];

export function SafeBufferCard({
  plan,
  currentPrice,
}: {
  plan: TradePlan;
  currentPrice: number;
}) {
  const [activeTab, setActiveTab] = useState<"calculator" | "levels">("calculator");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [balance, setBalance] = useState<number>(100);
  const [lotSize, setLotSize] = useState<number>(0.01);

  const result: SafeBufferResult = calculateSafeBuffer({
    balance,
    currency,
    lotSize,
    currentPrice,
    invalidation: plan.invalidation,
    atr: plan.atr,
  });

  const presets = currency === "USD" ? USD_PRESETS : THB_PRESETS;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs" aria-label="ระดับราคาและการคำนวณความเสี่ยง">
      {/* Header with Tab Switch */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-gold" aria-hidden />
          <div>
            <h2 className="font-semibold text-sm">
              {activeTab === "calculator" ? "คำนวณเงินกันพอร์ตแตก & วางแผนขนาดไม้" : "ระดับราคาอ้างอิง (GC=F)"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {activeTab === "calculator"
                ? "คำนวณเงินทุนขั้นต่ำ เพื่อให้พอร์ตทนแรงเหวี่ยงของทองรอบนี้ได้"
                : "ฉบับภาษาคนเข้าใจง่าย ไม่ต้องงงกับศัพท์เทคนิค"}
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-0.5 text-xs">
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              activeTab === "calculator"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("calculator")}
          >
            🛡️ คำนวณเงินทุน
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              activeTab === "levels"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("levels")}
          >
            📖 ระดับราคาเข้าใจง่าย
          </button>
        </div>
      </div>

      {activeTab === "calculator" ? (
        <div className="mt-4 space-y-4">
          {/* Controls: Capital & Lot Size */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Input 1: Balance */}
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-gold" aria-hidden />
                  เงินทุนในพอร์ตของคุณ
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                      currency === "USD" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => {
                      setCurrency("USD");
                      setBalance(100);
                    }}
                  >
                    $ USD
                  </button>
                  <button
                    type="button"
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                      currency === "THB" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => {
                      setCurrency("THB");
                      setBalance(3500);
                    }}
                  >
                    ฿ บาท
                  </button>
                </div>
              </div>

              {/* Quick chips */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {presets.map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant={balance === amount ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setBalance(amount)}
                  >
                    {currency === "USD" ? `$${amount}` : `${amount.toLocaleString()}฿`}
                  </Button>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">หรือระบุ:</span>
                <input
                  type="number"
                  min="1"
                  step="10"
                  value={balance}
                  onChange={(e) => setBalance(Math.max(1, Number(e.target.value) || 1))}
                  className="h-7 w-28 rounded-md border border-border bg-background px-2 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  aria-label="ระบุเงินทุนในพอร์ต"
                />
                <span className="text-xs text-muted-foreground">
                  {currency === "USD" ? `(~${result.balanceThb.toFixed(0)} บาท)` : `(~${result.balanceUsd.toFixed(1)}$)`}
                </span>
              </div>
            </div>

            {/* Input 2: Lot Size */}
            <div className="rounded-lg bg-muted/40 p-3">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-gold" aria-hidden />
                ขนาดออเดอร์ (Lot Size)
              </span>

              {/* Quick lot chips */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {LOT_PRESETS.map((lot) => (
                  <Button
                    key={lot}
                    type="button"
                    variant={lotSize === lot ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setLotSize(lot)}
                  >
                    {lot} lot {lot === 0.01 ? "(แนะนำ)" : ""}
                  </Button>
                ))}
              </div>

              <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                * 0.01 lot คือขนาดเล็กสุด ปลอดภัยสุดสำหรับการทดสอบ (ราคาทองขยับ $1 = พอร์ตเปลี่ยน $1 หรือ ~35.5 บาท)
              </p>
            </div>
          </div>

          {/* Dynamic Status & Anti-Bust Banner */}
          <div
            className={`rounded-lg border p-3.5 transition-colors ${
              result.status === "safe"
                ? "border-bull/30 bg-bull-soft/25 text-foreground"
                : result.status === "moderate"
                  ? "border-gold/30 bg-accent/25 text-foreground"
                  : result.status === "warning"
                    ? "border-wait/40 bg-wait-soft/30 text-foreground"
                    : "border-bear/40 bg-bear-soft/30 text-foreground"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                {result.status === "safe" ? (
                  <ShieldCheck className="h-4 w-4 text-bull" aria-hidden />
                ) : result.status === "moderate" ? (
                  <CheckCircle2 className="h-4 w-4 text-gold" aria-hidden />
                ) : result.status === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-wait" aria-hidden />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-bear" aria-hidden />
                )}
                <span>{result.statusTitle}</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  result.status === "safe"
                    ? "bg-bull-soft text-bull"
                    : result.status === "moderate"
                      ? "bg-secondary text-foreground"
                      : result.status === "warning"
                        ? "bg-wait-soft text-wait"
                        : "bg-bear-soft text-bear"
                }`}
              >
                {result.badgeLabel}
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.statusMessage}</p>

            {/* Survival Multiplier Meter */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground shrink-0">เกราะทนแรงเหวี่ยง:</span>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    result.status === "safe"
                      ? "bg-bull"
                      : result.status === "moderate"
                        ? "bg-gold"
                        : result.status === "warning"
                          ? "bg-wait"
                          : "bg-bear"
                  }`}
                  style={{ width: `${Math.min(100, (result.survivalMultiplier / 10) * 100)}%` }}
                />
              </div>
              <span className="tabular text-xs font-semibold shrink-0">
                {result.survivalMultiplier.toFixed(1)}x เท่า
              </span>
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {/* Metric 1: ATR Swing */}
            <div className="rounded-lg bg-muted/40 p-3">
              <span className="text-[11px] text-muted-foreground block">
                แรงแกว่งปกติใน 1 แท่ง (15m)
              </span>
              <p className="mt-1 text-sm font-semibold tabular text-foreground">
                ±${result.normalSwingUsd.toFixed(2)}{" "}
                <span className="text-[11px] font-normal text-muted-foreground">
                  (~{result.normalSwingThb.toFixed(0)} ฿)
                </span>
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                สะบัดตามธรรมชาติของ ATR ({plan.atr.toFixed(2)} จุด)
              </p>
            </div>

            {/* Metric 2: Max Loss at Invalidation */}
            <div className="rounded-lg bg-muted/40 p-3">
              <span className="text-[11px] text-muted-foreground block">
                ถ้าคิดผิด เสียไม่เกิน (Stop Loss)
              </span>
              <p className="mt-1 text-sm font-semibold tabular text-bear">
                -${result.maxLossUsd.toFixed(2)}{" "}
                <span className="text-[11px] font-normal text-muted-foreground">
                  (~{result.maxLossThb.toFixed(0)} ฿)
                </span>
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                ระยะยอมแพ้ {result.invalidationDistance.toFixed(2)} จุด
              </p>
            </div>

            {/* Metric 3: Minimum Safe Balance */}
            <div className="rounded-lg bg-muted/40 p-3">
              <span className="text-[11px] text-muted-foreground block">
                เงินทุนขั้นต่ำที่แนะนำ
              </span>
              <p className="mt-1 text-sm font-semibold tabular text-bull">
                ${result.minSafeBalanceUsd.toFixed(0)}{" "}
                <span className="text-[11px] font-normal text-muted-foreground">
                  (~{result.minSafeBalanceThb.toFixed(0)} ฿)
                </span>
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                มีติดพอร์ตไว้ จะไม่โดนปิดออเดอร์ก่อนเทรนด์วิ่ง
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Tab 2: ระดับราคาฉบับภาษาคนเข้าใจง่าย */
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-bull" aria-hidden />
                แนวรับ (Support)
              </span>
              <span className="tabular text-sm font-semibold text-bull">{fmtPrice(plan.support)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              <strong>พื้นล่างที่ราคาไม่ค่อยหลุด:</strong> ถ้าร่วงลงมาถึงแถวนี้ มักมีแรงซื้อรอช้อนกลับขึ้นไป ไม่ควรเปิดขายไล่ราคาที่จุดนี้
            </p>
          </div>

          <div className="rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-bear" aria-hidden />
                แนวต้าน (Resistance)
              </span>
              <span className="tabular text-sm font-semibold text-bear">{fmtPrice(plan.resistance)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              <strong>เพดานบนที่ราคาขึ้นไปติด:</strong> ถ้าขึ้นชนแถวนี้ มักมีแรงขายเททำกำไรกดลงมา ไม่ควรเปิดซื้อไล่ราคาที่ยอดนี้
            </p>
          </div>

          <div className="rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-gold" aria-hidden />
                จุดที่ถือว่าคิดผิด (Invalidation)
              </span>
              <span className="tabular text-sm font-semibold text-foreground">{fmtPrice(plan.invalidation)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              <strong>จุดตัดขาดทุน (Stop Loss):</strong> ถ้ากราฟหลุดราคาจุดนี้ แปลว่าการทำนายรอบนี้ผิดทาง ให้ยอมแพ้ทันที ห้ามถือทน
            </p>
          </div>

          <div className="rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                ความผันผวน (ATR)
              </span>
              <span className="tabular text-sm font-semibold text-foreground">{plan.atr.toFixed(2)} จุด</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              <strong>ระยะสะบัดตัวปกติ:</strong> ใน 1 แท่ง (15 นาที) ราคาทองแกว่งขึ้นลงประมาณ ±{plan.atr.toFixed(2)}$ เป็นธรรมชาติ อย่าเพิ่งตกใจ
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Coins, HelpCircle, Info, Shield, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fmtPrice } from "@/lib/format";
import {
  calculateSafeBuffer,
  type SafeBufferResult,
} from "@/lib/risk-calculator";
import type { TradePlan } from "@/lib/types";

const THB_PRESETS = [500, 1000, 3000, 5000, 10000, 30000];
const LOT_PRESETS = [0.01, 0.02, 0.05, 0.1];

export function SafeBufferCard({
  plan,
  currentPrice,
}: {
  plan: TradePlan;
  currentPrice: number;
}) {
  const [activeTab, setActiveTab] = useState<"calculator" | "levels">("calculator");
  const [balance, setBalance] = useState<number>(3000);
  const [lotSize, setLotSize] = useState<number>(0.01);

  const result: SafeBufferResult = calculateSafeBuffer({
    balance,
    currency: "THB",
    lotSize,
    currentPrice,
    invalidation: plan.invalidation,
    atr: plan.atr,
  });

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs" aria-label="ระดับราคาและการคำนวณความเสี่ยง">
      {/* Header with Tab Switch */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-gold" aria-hidden />
          <div>
            <h2 className="font-semibold text-sm">
              {activeTab === "calculator" ? "คำนวณเงินกันพอร์ตแตก (หน่วยบาท)" : "ระดับราคาอ้างอิง (GC=F)"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {activeTab === "calculator"
                ? "คำนวณเป็นเงินบาทชัดเจน รู้ล่วงหน้าว่าต้องมีเงินเท่าไหร่ถึงจะไม่โดนล้างพอร์ต"
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
          {/* Controls: Capital (THB) & Lot Size */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Input 1: Balance in THB */}
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-gold" aria-hidden />
                  เงินทุนในพอร์ตของคุณ (บาท)
                </span>
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                  หน่วย: บาท ฿
                </span>
              </div>

              {/* Quick chips in THB */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {THB_PRESETS.map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant={balance === amount ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setBalance(amount)}
                  >
                    {amount.toLocaleString()} บาท
                  </Button>
                ))}
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">หรือระบุเอง:</span>
                <div className="relative inline-flex items-center">
                  <input
                    type="number"
                    min="100"
                    step="500"
                    value={balance}
                    onChange={(e) => setBalance(Math.max(1, Number(e.target.value) || 1))}
                    className="h-7 w-28 rounded-md border border-border bg-background px-2 pr-7 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    aria-label="ระบุเงินทุนในพอร์ตเป็นบาท"
                  />
                  <span className="absolute right-2 text-[11px] font-medium text-muted-foreground pointer-events-none">
                    ฿
                  </span>
                </div>
                <span className="text-xs font-semibold text-foreground">
                  {balance.toLocaleString()} บาท
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

              <p className="mt-2.5 text-[11px] text-muted-foreground leading-relaxed">
                * ขนาด 0.01 lot คือขนาดเล็กสุด ปลอดภัยสุดสำหรับการทดสอบ (ราคาทองขยับ 1 ดอลลาร์ = พอร์ตขยับประมาณ 35.5 บาท)
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

          {/* 3 Metric Cards (100% Thai Baht) */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {/* Metric 1: ATR Swing in THB */}
            <div className="rounded-lg bg-muted/40 p-3">
              <span className="text-[11px] text-muted-foreground block">
                แรงแกว่งปกติใน 1 แท่ง (15 นาที)
              </span>
              <p className="mt-1 text-base font-bold tabular text-foreground">
                ±{Math.round(result.normalSwingThb).toLocaleString()} บาท
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                ระยะสะบัดตามธรรมชาติของทอง ({plan.atr.toFixed(2)} จุด)
              </p>
            </div>

            {/* Metric 2: Max Loss in THB */}
            <div className="rounded-lg bg-muted/40 p-3">
              <span className="text-[11px] text-muted-foreground block">
                ถ้าคิดผิด เสียไม่เกิน (Stop Loss)
              </span>
              <p className="mt-1 text-base font-bold tabular text-bear">
                -{Math.round(result.maxLossThb).toLocaleString()} บาท
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                เมื่อราคาแตะจุดยอมแพ้ ({fmtPrice(plan.invalidation)})
              </p>
            </div>

            {/* Metric 3: Minimum Safe Balance in THB */}
            <div className="rounded-lg bg-muted/40 p-3">
              <span className="text-[11px] text-muted-foreground block">
                เงินทุนขั้นต่ำที่แนะนำ
              </span>
              <p className="mt-1 text-base font-bold tabular text-bull">
                {Math.round(result.minSafeBalanceThb).toLocaleString()} บาท
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                มีติดพอร์ตไว้ จะไม่โดนล้างพอร์ตก่อนเทรนด์วิ่ง
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

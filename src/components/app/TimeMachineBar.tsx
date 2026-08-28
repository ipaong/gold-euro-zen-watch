import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Sparkles,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { fmtDateTime } from "@/lib/format";

/** Number of M15 candles in common jump intervals. */
const CANDLES_PER_HOUR = 4;
const CANDLES_PER_DAY = 4 * 24;

export function TimeMachineBar({
  enabled,
  onToggle,
  pendingIndex,
  maxIndex,
  pendingAsOf,
  committedAsOf,
  onPendingIndexChange,
  onFetchData,
  isFetchingData,
  dataFetched,
  onPredict,
  isPredicted,
  candleCount,
  newsCount,
  usingLive = false,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  pendingIndex: number;
  maxIndex: number;
  pendingAsOf: number;
  committedAsOf: number;
  onPendingIndexChange: (i: number) => void;
  onFetchData: () => void;
  isFetchingData: boolean;
  dataFetched: boolean;
  onPredict: () => void;
  isPredicted: boolean;
  candleCount?: number;
  newsCount?: number;
  usingLive?: boolean;
}) {
  const jumpBack = (candles: number) =>
    onPendingIndexChange(Math.max(0, pendingIndex - candles));
  const jumpForward = (candles: number) =>
    onPendingIndexChange(Math.min(maxIndex, pendingIndex + candles));

  const isTimeChanged = pendingAsOf !== committedAsOf;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs" aria-label="โหมดย้อนเวลา">
      <div className="flex items-center gap-2">
        {enabled ? (
          <Clock className="h-4 w-4 text-gold" aria-hidden />
        ) : (
          <Zap className="h-4 w-4 text-gold" aria-hidden />
        )}
        <div className="min-w-0">
          <h2 className="font-semibold text-sm">
            {enabled ? "โหมดย้อนเวลา (Time Machine Simulator)" : "โหมดวิเคราะห์เรียลไทม์"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {enabled
              ? "จำลองย้อนเวลา 3 ขั้นตอน: 1. ปรับวัน ➔ 2. ดึงข้อมูล ➔ 3. ทำนาย"
              : usingLive
                ? "วิเคราะห์จากราคาปิดล่าสุดของ GC=F"
                : "ข้อมูลตัวอย่างล่าสุด"}
          </p>
        </div>
        <Switch
          className="ml-auto shrink-0"
          checked={enabled}
          onCheckedChange={onToggle}
          aria-label="เปิดหรือปิดโหมดย้อนเวลา"
        />
      </div>

      {enabled ? (
        <div className="mt-3 space-y-3 pt-3 border-t border-border/60">
          {/* 1. ปรับวัน/เวลา */}
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Calendar className="h-3.5 w-3.5 text-gold" aria-hidden />
                1. เลือกวัน & เวลาเป้าหมาย
              </span>
              {isTimeChanged ? (
                <span className="rounded-full bg-wait-soft px-2 py-0.5 text-[10px] font-medium text-wait">
                  รอยืนยันเวลา
                </span>
              ) : dataFetched ? (
                <span className="rounded-full bg-bull-soft px-2 py-0.5 text-[10px] font-medium text-bull">
                  ข้อมูลพร้อม ✓
                </span>
              ) : null}
            </div>

            <p className="mt-1.5 tabular text-sm font-semibold text-foreground">
              {fmtDateTime(pendingAsOf)}{" "}
              <span className="text-[11px] font-normal text-muted-foreground">(เวลาไทย)</span>
            </p>

            <div className="mt-3 space-y-2">
              <Slider
                value={[pendingIndex]}
                min={0}
                max={maxIndex}
                step={1}
                onValueChange={(v) => onPendingIndexChange(v[0] ?? pendingIndex)}
                aria-label="เลื่อนเพื่อเลือกเวลาในอดีต"
              />

              {/* Quick jump buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => jumpBack(CANDLES_PER_DAY)}
                  disabled={pendingIndex < CANDLES_PER_DAY}
                >
                  -1 วัน
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => jumpBack(CANDLES_PER_HOUR * 6)}
                  disabled={pendingIndex < CANDLES_PER_HOUR * 6}
                >
                  -6 ชม.
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => jumpBack(CANDLES_PER_HOUR)}
                  disabled={pendingIndex < CANDLES_PER_HOUR}
                >
                  -1 ชม.
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => jumpBack(1)}
                  disabled={pendingIndex <= 0}
                >
                  <ChevronLeft className="h-3 w-3 mr-0.5" /> 1 แท่ง
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => jumpForward(1)}
                  disabled={pendingIndex >= maxIndex}
                >
                  1 แท่ง <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px] ml-auto"
                  onClick={() => onPendingIndexChange(maxIndex)}
                  disabled={pendingIndex >= maxIndex}
                >
                  ล่าสุด
                </Button>
              </div>
            </div>
          </div>

          {/* 2. ดึงข่าว + กราฟ */}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant={isTimeChanged || !dataFetched ? "default" : "outline"}
              className="min-h-10 w-full font-medium"
              onClick={onFetchData}
              disabled={isFetchingData}
            >
              <Download className={`h-4 w-4 mr-2 ${isFetchingData ? "animate-bounce" : ""}`} />
              {isFetchingData
                ? "กำลังดึงกราฟและข่าว…"
                : isTimeChanged
                  ? "2. ดึงกราฟ + ข่าว (ณ เวลาที่เลือก)"
                  : "ดึงกราฟ + ข่าวอีกครั้ง"}
            </Button>

            {dataFetched && !isTimeChanged ? (
              <div className="flex flex-wrap items-center justify-between gap-1.5 px-1 text-[11px] text-muted-foreground">
                <span>
                  🟢 กราฟ: {candleCount ?? 0} แท่ง
                </span>
                <span>
                  🟢 ข่าว & ปฏิทิน: {newsCount ?? 0} รายการ
                </span>
                <span className="text-bull">
                  {isPredicted ? "ทำนายแล้ว ✓" : "พร้อมทำนาย"}
                </span>
              </div>
            ) : null}
          </div>

          {/* 3. ปุ่มทำนาย */}
          {dataFetched && !isTimeChanged && !isPredicted ? (
            <Button
              type="button"
              className="min-h-11 w-full bg-primary text-primary-foreground font-semibold shadow-sm"
              onClick={onPredict}
            >
              <Sparkles className="h-4 w-4 mr-2 text-gold" />
              3. เริ่มทำนาย 5 แท่งถัดไป
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

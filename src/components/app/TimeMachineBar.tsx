import { ChevronLeft, ChevronRight, Clock, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { fmtDateTime } from "@/lib/format";

export function TimeMachineBar({
  enabled,
  onToggle,
  index,
  maxIndex,
  asOf,
  onIndexChange,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  index: number;
  maxIndex: number;
  asOf: number;
  onIndexChange: (i: number) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        {enabled ? (
          <Clock className="h-4 w-4 text-gold" aria-hidden />
        ) : (
          <Zap className="h-4 w-4 text-gold" aria-hidden />
        )}
        <h2 className="font-semibold">{enabled ? "โหมดย้อนเวลา" : "โหมดล่าสุด"}</h2>
        <Switch
          className="ml-auto"
          checked={enabled}
          onCheckedChange={onToggle}
          aria-label="เปิดโหมดย้อนเวลา"
        />
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {enabled
          ? "ระบบจะเห็นข้อมูลเฉพาะที่เกิดก่อนเวลานี้เท่านั้น ทั้งราคาและข่าว (ผลข่าวจริงจะถูกซ่อนจนถึงเวลาประกาศ)"
          : "วิเคราะห์จากแท่งล่าสุดของชุดข้อมูลเดโม"}
      </p>

      <p className="mt-2 tabular text-sm font-semibold">{fmtDateTime(asOf)}</p>

      {enabled ? (
        <div className="mt-3 space-y-2">
          <Slider
            value={[index]}
            min={0}
            max={maxIndex}
            step={1}
            onValueChange={(v) => onIndexChange(v[0] ?? index)}
            aria-label="เลือกเวลาที่จะย้อนกลับไป"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onIndexChange(Math.max(0, index - 1))}
              disabled={index <= 0}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> ถอย 1 แท่ง
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onIndexChange(Math.min(maxIndex, index + 1))}
              disabled={index >= maxIndex}
            >
              เดินหน้า 1 แท่ง <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

import { Brain } from "lucide-react";

import { DirectionBadge } from "./DirectionBadge";
import { Progress } from "@/components/ui/progress";
import type { EnsembleResult } from "@/lib/types";

export function EnsemblePanel({ ensemble }: { ensemble: EnsembleResult }) {
  return (
    <section className="rounded-xl border border-dashed border-gold/60 bg-card p-4">
      <header className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-gold" aria-hidden />
        <h2 className="font-semibold">หัวหน้าทีม (Ensemble)</h2>
        <span className="ml-auto">
          <DirectionBadge direction={ensemble.direction} soft />
        </span>
      </header>
      <p className="mt-1 text-xs text-muted-foreground">
        เป็นบทวิเคราะห์ประกอบ ไม่ใช่เสียงโหวต และไม่มีสิทธิ์เปลี่ยนสัญญาณสุดท้าย
      </p>

      <div className="mt-2 flex items-center gap-2">
        <Progress value={ensemble.confidence} className="h-1.5 flex-1" />
        <span className="tabular text-xs text-muted-foreground">{ensemble.confidence}%</span>
      </div>

      <p className="mt-3 text-sm">{ensemble.summary}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Column title="ปัจจัยหนุนขึ้น" items={ensemble.bullish} tone="bull" />
        <Column title="ปัจจัยกดลง" items={ensemble.bearish} tone="bear" />
      </div>

      <div className="mt-3">
        <Column title="ความเสี่ยงที่ต้องระวัง" items={ensemble.risks} tone="wait" />
      </div>
    </section>
  );
}

function Column({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "bull" | "bear" | "wait";
}) {
  const dot = tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-gold";
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {items.length ? (
        <ul className="mt-1 space-y-1 text-sm">
          {items.map((i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className={dot}>
                •
              </span>
              <span>{i}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">— ไม่มี</p>
      )}
    </div>
  );
}

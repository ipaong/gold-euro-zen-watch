import { GitBranch, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { DirectionBadge } from "./DirectionBadge";
import { fmtPrice } from "@/lib/format";
import type { Scenario } from "@/lib/types";

export function ScenarioPanel({ scenarios }: { scenarios: Scenario[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-gold" aria-hidden />
        <h2 className="font-semibold">5 ฉากทัศน์อนาคต</h2>
      </header>
      <p className="mt-1 text-xs text-muted-foreground">
        คนละเรื่องกับ 5 โมเดลโหวต — นี่คือ “ทางที่ราคาอาจเดิน” 5 แบบ พร้อมน้ำหนักความเป็นไปได้
        (เป็นค่าประเมิน ไม่ใช่ความน่าจะเป็นจริง)
      </p>

      <ul className="mt-3 space-y-2">
        {scenarios.map((s) => (
          <li key={s.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-xs font-bold">
                {s.id}
              </span>
              <span className="font-medium">{s.name}</span>
              <span className="ml-auto tabular text-sm font-semibold">{s.weight}%</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <DirectionBadge direction={s.direction} soft />
              <span className="flex items-center gap-0.5">
                {s.arrows.map((a, i) => {
                  const Icon = a === "up" ? TrendingUp : a === "down" ? TrendingDown : Minus;
                  const tone =
                    a === "up" ? "text-bull" : a === "down" ? "text-bear" : "text-muted-foreground";
                  return <Icon key={i} className={`h-3.5 w-3.5 ${tone}`} aria-hidden />;
                })}
              </span>
              <span className="ml-auto tabular text-xs text-muted-foreground">
                {s.netMove >= 0 ? "+" : ""}
                {fmtPrice(s.netMove)} €
              </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${
                  s.direction === "BUY" ? "bg-bull" : s.direction === "SELL" ? "bg-bear" : "bg-wait"
                }`}
                style={{ width: `${s.weight}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

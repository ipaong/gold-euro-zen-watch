import { Check, ShieldCheck, X } from "lucide-react";

import { DirectionBadge } from "./DirectionBadge";
import type { Consensus } from "@/lib/types";

export function GatePanel({ consensus }: { consensus: Consensus }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-gold" aria-hidden />
        <h2 className="font-semibold">เกณฑ์คุณภาพ (ตัวตัดสินสัญญาณสุดท้าย)</h2>
      </header>
      <p className="mt-1 text-sm text-muted-foreground">
        นับเสียงจาก 5 โมเดลเท่านั้น — ถ้าข้อใดไม่ผ่าน สัญญาณสุดท้ายจะกลายเป็น “รอ” ทันที
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
        <span className="text-muted-foreground">ผลโหวตดิบ</span>
        <DirectionBadge direction={consensus.rawDirection} soft />
        <span className="ml-auto text-muted-foreground">สัญญาณสุดท้าย</span>
        <DirectionBadge direction={consensus.direction} />
      </div>

      <ul className="mt-3 space-y-2">
        {consensus.checks.map((c) => (
          <li key={c.id} className="flex gap-2 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                c.pass ? "bg-bull-soft text-bull" : "bg-bear-soft text-bear"
              }`}
            >
              {c.pass ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </span>
            <span>
              <span className="font-medium">{c.label}</span>
              <span className="block text-xs text-muted-foreground">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 rounded-lg bg-muted p-2.5 text-sm">{consensus.reason}</p>
    </section>
  );
}

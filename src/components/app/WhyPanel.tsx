import { HelpCircle } from "lucide-react";

import { DirectionBadge } from "./DirectionBadge";
import { directionLabel } from "@/lib/format";
import type { Consensus, EnsembleResult } from "@/lib/types";

/**
 * Explains the architecture in plain Thai: Direction Engine V3 is primary;
 * model votes and ensemble remain supporting context.
 */
export function WhyPanel({
  consensus,
  ensemble,
  activeVotes,
}: {
  consensus: Consensus;
  ensemble: EnsembleResult;
  activeVotes: number;
}) {
  const failed = consensus.checks.filter((c) => !c.pass);
  const title = consensus.blocked
    ? consensus.rawDirection === "WAIT"
      ? "ทำไมระบบยังไม่ให้สัญญาณ?"
      : `ทำไมระบบยังไม่ให้${directionLabel[consensus.rawDirection]}?`
    : `ทำไมระบบให้${directionLabel[consensus.direction]}?`;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-gold" aria-hidden />
        <h2 className="font-semibold">{title}</h2>
      </header>

      <ul className="mt-2 space-y-1.5 text-sm">
        <li className="flex gap-2">
          <span aria-hidden className="text-gold">
            •
          </span>
          <span>
            Direction Engine V3 มอง{directionLabel[consensus.rawDirection]}
            {consensus.engine ? ` · หลักฐานตรงทิศ ${consensus.engine.alignedEvidence} ชุด` : ""}
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-gold">
            •
          </span>
          <span>
            หัวหน้าทีม (Ensemble) มอง{directionLabel[ensemble.direction]} {ensemble.confidence}% —
            เป็นความเห็นประกอบเท่านั้น
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-gold">
            •
          </span>
          <span>
            {failed.length ? "แต่เกณฑ์คุณภาพยังไม่ผ่าน เพราะ:" : "และเกณฑ์คุณภาพผ่านครบทุกข้อ"}
          </span>
        </li>
      </ul>

      {failed.length ? (
        <ul className="mt-1.5 space-y-1 pl-5 text-sm text-muted-foreground">
          {failed.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span aria-hidden className="text-bear">
                ×
              </span>
              <span>
                {c.label} — {c.detail}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted p-2.5 text-sm">
        <span className="text-muted-foreground">ดังนั้นสัญญาณสุดท้าย =</span>
        <DirectionBadge direction={consensus.direction} />
        <span className="tabular text-muted-foreground">{consensus.confidence}%</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        เสียงโมเดลประกอบ: ซื้อ {consensus.buyVotes} · ขาย {consensus.sellVotes} · รอ{" "}
        {consensus.waitVotes}
        {` · ${activeVotes} โมเดลใช้งานได้`}
      </p>
    </section>
  );
}

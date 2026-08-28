import { AlertTriangle, Newspaper, Activity } from "lucide-react";

import { DirectionBadge } from "./DirectionBadge";
import { Progress } from "@/components/ui/progress";
import { directionLabel, fmtDateTime, fmtPct, fmtPrice, riskLabel } from "@/lib/format";
import type { Consensus, MarketSnapshot, NewsSnapshot } from "@/lib/types";

/**
 * First viewport: answers "ซื้อ/ขาย/รอ", how many models agree, how confident,
 * why, and what risk is in the way — nothing else.
 */
export function SignalHero({
  consensus,
  snapshot,
  news,
  activeVotes,
  asOf,
}: {
  consensus: Consensus;
  snapshot: MarketSnapshot;
  news: NewsSnapshot;
  activeVotes: number;
  asOf: number;
}) {
  const failed = consensus.checks.filter((c) => !c.pass);
  const leanText =
    consensus.rawDirection === "WAIT"
      ? `เสียงส่วนใหญ่ยังไม่ชี้ทาง (ซื้อ ${consensus.buyVotes} · ขาย ${consensus.sellVotes} · รอ ${consensus.waitVotes})`
      : `${consensus.agree}/${activeVotes} โมเดลเอนเอียง${directionLabel[consensus.rawDirection]}`;

  const volHigh = snapshot.atrRatio > 1.6;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">สัญญาณสุดท้ายตอนนี้</p>
          <div className="mt-1">
            <DirectionBadge direction={consensus.direction} size="lg" />
          </div>
          <p className="mt-2 text-sm font-medium">{leanText}</p>
          {consensus.blocked && consensus.rawDirection !== "WAIT" ? (
            <p className="text-sm text-muted-foreground">แต่ยังไม่ผ่านเกณฑ์คุณภาพ</p>
          ) : !consensus.blocked && failed.length ? (
            <p className="text-sm text-gold">หมอดูสายกล้า — มีคำเตือน {failed.length} ข้อ</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-xl font-bold leading-tight">{fmtPrice(snapshot.price)}</p>
          <p className={`tabular text-xs ${snapshot.changePct >= 0 ? "text-bull" : "text-bear"}`}>
            {fmtPct(snapshot.changePct)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">ความมั่นใจ</span>
        <Progress value={consensus.confidence} className="h-2 flex-1" />
        <span className="tabular text-sm font-semibold">{consensus.confidence}%</span>
      </div>

      <div className="mt-3 rounded-lg bg-muted p-3">
        <p className="text-xs font-semibold text-muted-foreground">
          {consensus.blocked
            ? "ทำไมยังบอกให้รอ"
            : failed.length
              ? "ฟันธงแบบหมอดูสายกล้า — คำเตือนที่ต้องรู้"
              : "ทำไมจึงยืนยันสัญญาณนี้"}
        </p>
        <ul className="mt-1 space-y-1 text-sm">
          {(failed.length ? failed : consensus.checks.slice(0, 2)).slice(0, 3).map((c) => (
            <li key={c.id} className="flex gap-2">
              <span aria-hidden className={failed.length ? "text-gold" : "text-bull"}>
                {failed.length ? "!" : "✓"}
              </span>
              <span>{c.detail}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <Chip
          icon={Newspaper}
          tone={news.riskLevel === "high" ? "warn" : "calm"}
          text={`ข่าวแรง: เสี่ยง${riskLabel[news.riskLevel]}`}
        />
        <Chip
          icon={Activity}
          tone={volHigh ? "warn" : "calm"}
          text={`ความผันผวน ${snapshot.atrRatio.toFixed(2)}× ปกติ`}
        />
        {activeVotes < 5 ? (
          <Chip icon={AlertTriangle} tone="warn" text={`ใช้ได้ ${activeVotes}/5 โมเดล`} />
        ) : null}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        เวลาที่ใช้วิเคราะห์ {fmtDateTime(asOf)}
      </p>
    </section>
  );
}

function Chip({
  icon: Icon,
  text,
  tone,
}: {
  icon: typeof Newspaper;
  text: string;
  tone: "warn" | "calm";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium ${
        tone === "warn" ? "bg-bear-soft text-bear" : "bg-secondary text-muted-foreground"
      }`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {text}
    </span>
  );
}

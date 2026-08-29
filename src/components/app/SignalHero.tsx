import { BrainCircuit, History, Newspaper } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { fmtDateTime, fmtPrice } from "@/lib/format";
import type { Consensus, Direction, MarketSnapshot, ModelVote, NewsSnapshot } from "@/lib/types";

const choices: { direction: Direction; symbol: string; label: string }[] = [
  { direction: "BUY", symbol: "▲", label: "ขึ้น" },
  { direction: "WAIT", symbol: "◆", label: "พัก" },
  { direction: "SELL", symbol: "▼", label: "ลง" },
];

/** Symbol-first result card for the Nerd Gold challenge. */
export function SignalHero({
  consensus,
  snapshot,
  news,
  models,
  asOf,
}: {
  consensus: Consensus;
  snapshot: MarketSnapshot;
  news: NewsSnapshot;
  models: ModelVote[];
  activeVotes: number;
  asOf: number;
}) {
  const selected = choices.find((choice) => choice.direction === consensus.direction)!;
  const failed = consensus.checks.filter((check) => !check.pass);
  const learning = consensus.learning;

  return (
    <section className="overflow-hidden rounded-2xl border border-gold/40 bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <BrainCircuit className="h-4 w-4 text-gold" aria-hidden />
        <h2 className="text-sm font-bold">ChatGPT Gold Oracle</h2>
        <span className="ml-auto tabular text-xs font-semibold">{fmtPrice(snapshot.price)}</span>
      </header>

      <div className="grid grid-cols-3 gap-2 p-3" aria-label="คำทายทิศทางทอง">
        {choices.map((choice) => {
          const active = choice.direction === consensus.direction;
          const tone =
            choice.direction === "BUY"
              ? "text-bull border-bull/40 bg-bull-soft"
              : choice.direction === "SELL"
                ? "text-bear border-bear/40 bg-bear-soft"
                : "text-wait border-wait/40 bg-wait-soft";
          return (
            <div
              key={choice.direction}
              className={`flex min-h-24 flex-col items-center justify-center rounded-xl border transition-all ${
                active ? `${tone} scale-[1.02] shadow-sm` : "border-transparent bg-muted/40 opacity-30"
              }`}
            >
              <span className="text-4xl font-black leading-none" aria-hidden>{choice.symbol}</span>
              <span className="mt-1 text-xs font-bold">{choice.label}</span>
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-muted-foreground">ฟันธง 5 แท่งถัดไป</p>
            <p className="text-xl font-black">
              {selected.symbol} {selected.label}
            </p>
          </div>
          <p className="tabular text-3xl font-black text-gold">{consensus.confidence}%</p>
        </div>
        <Progress value={consensus.confidence} className="mt-2 h-2" />

        <div className="mt-3 flex items-center gap-1.5" aria-label="เสียงโหวต 5 โมเดล">
          {models.map((model) => {
            const choice = choices.find((item) => item.direction === model.direction)!;
            return (
              <span
                key={model.id}
                title={`${model.name}: ${choice.label} ${model.confidence}%`}
                className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-1.5 text-sm font-black ${
                  model.direction === "BUY"
                    ? "border-bull/30 bg-bull-soft text-bull"
                    : model.direction === "SELL"
                      ? "border-bear/30 bg-bear-soft text-bear"
                      : "border-border bg-wait-soft text-wait"
                }`}
              >
                {choice.symbol}
              </span>
            );
          })}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {consensus.buyVotes}▲ {consensus.waitVotes}◆ {consensus.sellVotes}▼
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <span className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5">
            <Newspaper className="h-3 w-3 text-gold" aria-hidden />
            ข่าว {news.riskLevel === "high" ? "แรง" : news.riskLevel === "medium" ? "กลาง" : "นิ่ง"}
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5">
            <History className="h-3 w-3 text-gold" aria-hidden />
            {learning?.calibrated
              ? `เรียนจากอดีต ${learning.sampleCount} เกม`
              : `กำลังเก็บสถิติ ${learning?.sampleCount ?? 0} เกม`}
          </span>
        </div>

        <p className="mt-3 truncate text-xs text-muted-foreground">
          {failed[0]?.detail ?? consensus.reason}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">{fmtDateTime(asOf)} · ล็อกก่อนเปิดเฉลย</p>
      </div>
    </section>
  );
}

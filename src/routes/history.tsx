import { createFileRoute } from "@tanstack/react-router";
import { Eye, Lock, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { CandleChart } from "@/components/app/CandleChart";
import { DirectionBadge } from "@/components/app/DirectionBadge";
import { Button } from "@/components/ui/button";
import { fmtDateTime, fmtPrice, riskLabel } from "@/lib/format";
import { frozenMarketProvider } from "@/lib/market/frozen-provider";
import { scorePrediction, computeStats, type Stats } from "@/lib/scoring";
import { attachOutcome, clearPredictions, deletePrediction, loadPredictions } from "@/lib/storage";
import type { Prediction } from "@/lib/types";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "บันทึกผลพยากรณ์ — XAUEUR Signal Lab" },
      {
        name: "description",
        content:
          "เทียบคำพยากรณ์ที่ล็อกไว้กับแท่งเทียนที่เกิดขึ้นจริง ดูอัตราทายทิศถูก ค่าคลาดเคลื่อนเฉลี่ย และสถิติรวมของทุกครั้งที่บันทึก",
      },
      { property: "og:title", content: "บันทึกผลพยากรณ์ — XAUEUR Signal Lab" },
      {
        property: "og:description",
        content: "เทียบคำพยากรณ์ที่ล็อกไว้กับผลจริง พร้อมสถิติความแม่นยำ",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPreds(loadPredictions());
    setReady(true);
  }, []);

  const stats = computeStats(preds);

  function reveal(p: Prediction) {
    const actual = frozenMarketProvider.getCandlesAfter(p.asOf, p.horizon);
    if (actual.length < p.horizon) {
      toast.error("ยังเปิดผลไม่ได้", {
        description: "ชุดข้อมูลเดโมยังไม่มีแท่งถัดไปครบ 5 แท่งหลังเวลาที่พยากรณ์",
      });
      return;
    }
    const score = scorePrediction(p, actual);
    setPreds(attachOutcome(p.id, actual, score));
    toast.success(
      score.directionCorrect === null
        ? "เปิดผลแล้ว (สัญญาณเป็น “รอ” จึงไม่นับแพ้ชนะทิศทาง)"
        : score.directionCorrect
          ? "เปิดผลแล้ว — ทายทิศทางถูก"
          : "เปิดผลแล้ว — ทายทิศทางผิด",
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <h1 className="font-semibold">บันทึกผลพยากรณ์</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            ทุกครั้งที่บันทึก คำพยากรณ์จะถูกล็อกไว้ในเครื่องนี้ (localStorage) และแอปจะไม่แก้ไขค่าเดิม
            — เปิดผลจริงได้ครั้งเดียวเพื่อกันการแก้คำตอบย้อนหลัง
          </p>
          <StatsGrid stats={stats} />
          {preds.length ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => {
                setPreds(clearPredictions());
                toast.success("ล้างบันทึกทั้งหมดแล้ว");
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> ล้างบันทึกทั้งหมด
            </Button>
          ) : null}
        </section>

        {ready && !preds.length ? (
          <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีบันทึก — กลับไปแท็บวิเคราะห์แล้วกด “บันทึกคำพยากรณ์นี้”
          </p>
        ) : null}

        {preds.map((p) => (
          <PredictionCard
            key={p.id}
            prediction={p}
            onReveal={() => reveal(p)}
            onDelete={() => {
              setPreds(deletePrediction(p.id));
              toast.success("ลบรายการแล้ว");
            }}
          />
        ))}

        <Disclaimer />
      </div>
    </AppShell>
  );
}

function StatsGrid({ stats }: { stats: Stats }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
      <Cell label="บันทึกทั้งหมด" value={`${stats.total} ครั้ง`} />
      <Cell label="เปิดผลแล้ว" value={`${stats.scored} ครั้ง`} />
      <Cell
        label="ทายทิศถูก"
        value={stats.hitRate === null ? "—" : `${stats.hitRate}% (${stats.hits}/${stats.directional})`}
      />
      <Cell label="คลาดเคลื่อนเฉลี่ย" value={stats.avgMae === null ? "—" : `${fmtPrice(stats.avgMae)} €`} />
      <Cell
        label="ทายทิศรายแท่งถูก"
        value={stats.candleHitRate === null ? "—" : `${stats.candleHitRate}%`}
      />
      <Cell label="สัญญาณ “รอ”" value={`${stats.waitCount} ครั้ง`} />
    </dl>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular font-semibold">{value}</dd>
    </div>
  );
}

function PredictionCard({
  prediction: p,
  onReveal,
  onDelete,
}: {
  prediction: Prediction;
  onReveal: () => void;
  onDelete: () => void;
}) {
  const history = frozenMarketProvider.getCandlesUpTo(p.asOf, 40);
  const s = p.score;

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <header className="flex items-start gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{fmtDateTime(p.asOf)}</p>
          <p className="text-xs text-muted-foreground">
            ราคาตอนพยากรณ์ {fmtPrice(p.price)} · {p.mode === "time_machine" ? "ย้อนเวลา" : "ล่าสุด"} ·
            ความเสี่ยงข่าว {riskLabel[p.newsRisk]}
          </p>
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
          <DirectionBadge direction={p.consensus.direction} soft />
        </span>
      </header>

      <div className="mt-3">
        <CandleChart
          history={history}
          forecast={p.forecast}
          actual={p.actual}
          support={p.plan.support}
          resistance={p.plan.resistance}
        />
      </div>

      {p.actual ? (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground">
            เส้นประคือค่าที่พยากรณ์ไว้ · แท่งทึบด้านขวาคือของจริง
          </p>
        </div>
      ) : null}

      {s ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Cell
            label="ทิศทาง"
            value={
              s.directionCorrect === null
                ? "ไม่นับ (สัญญาณรอ)"
                : s.directionCorrect
                  ? "ถูก"
                  : "ผิด"
            }
          />
          <Cell label="ทิศทางจริง" value={s.actualDirection === "BUY" ? "ขึ้น" : s.actualDirection === "SELL" ? "ลง" : "ออกข้าง"} />
          <Cell label="คลาดเคลื่อนเฉลี่ย" value={`${fmtPrice(s.mae)} €`} />
          <Cell label="ทายทิศรายแท่ง" value={`${s.candleDirHits}/${s.candleDirTotal}`} />
        </dl>
      ) : null}

      <div className="mt-3 flex gap-2">
        {!s ? (
          <Button variant="outline" size="sm" className="flex-1" onClick={onReveal}>
            <Eye className="h-4 w-4" aria-hidden /> เปิดผลจริง
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label="ลบรายการนี้">
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-medium">ดูเหตุผลที่บันทึกไว้</summary>
        <p className="mt-2 text-sm">{p.narrative.whatsHappening}</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {p.narrative.why.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

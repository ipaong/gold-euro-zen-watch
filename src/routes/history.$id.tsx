import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye, Lock, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AiExplanationView } from "@/components/app/AiAnalystPanel";
import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { CandleChart } from "@/components/app/CandleChart";
import { DirectionBadge } from "@/components/app/DirectionBadge";
import { EnsemblePanel } from "@/components/app/EnsemblePanel";
import { GatePanel } from "@/components/app/GatePanel";
import { ModelVoteCard } from "@/components/app/ModelVoteCard";
import { ScenarioPanel } from "@/components/app/ScenarioPanel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { fmtDateTime, fmtPrice, riskLabel } from "@/lib/format";
import { frozenMarketProvider } from "@/lib/market/frozen-provider";
import { attachOutcome, deletePrediction, listPredictions } from "@/lib/cloud-store";
import { evaluateSettlement } from "@/lib/settlement";
import { recordMetric } from "@/lib/observability";
import type { Prediction } from "@/lib/types";

export const Route = createFileRoute("/history/$id")({
  head: () => ({
    meta: [
      { title: "รายละเอียดคำพยากรณ์ — XAUEUR Signal Lab" },
      {
        name: "description",
        content:
          "ดูรายละเอียดคำพยากรณ์ที่ล็อกไว้: เสียงโหวตของ 5 โมเดล เกณฑ์คุณภาพ ฉากทัศน์อนาคต และผลเทียบกับแท่งเทียนจริง",
      },
      { property: "og:title", content: "รายละเอียดคำพยากรณ์ — XAUEUR Signal Lab" },
      {
        property: "og:description",
        content: "เสียงโหวต 5 โมเดล เกณฑ์คุณภาพ และผลเทียบของจริงของคำพยากรณ์ที่ล็อกไว้",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DetailPage,
});

function DetailPage() {
  const { id } = Route.useParams();
  const [pred, setPred] = useState<Prediction | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const list = await listPredictions();
        setPred(list.find((p) => p.id === id) ?? null);
      } catch {
        toast.error("โหลดรายการจาก Cloud ไม่สำเร็จ");
      }
      setReady(true);
    })();
  }, [id]);

  async function reveal(p: Prediction) {
    if (!p.demo) {
      toast.info("คำพยากรณ์จาก Twelve Data ยังไม่เปิดการเทียบผลอัตโนมัติ", {
        description: "ระบบจะไม่ใช้ชุดข้อมูลเดโมมาเทียบกับคำพยากรณ์จากแหล่งข้อมูลจริง",
      });
      return;
    }
    const evaluation = evaluateSettlement(p, frozenMarketProvider);
    if (evaluation.status === "already_settled") {
      const list = await listPredictions();
      setPred(list.find((x) => x.id === p.id) ?? p);
      return;
    }
    if (evaluation.status === "not_ready" || !evaluation.score) {
      recordMetric("settlement_lag", {
        available: evaluation.available,
        required: evaluation.required,
      });
      toast.error("ยังเปิดผลไม่ได้", {
        description: `มีแท่งจริงแล้ว ${evaluation.available}/${evaluation.required} แท่งหลังเวลาที่พยากรณ์`,
      });
      return;
    }
    try {
      await attachOutcome(p.id, evaluation.actual, evaluation.score);
      recordMetric("settlement_completed", { source: "history_detail" });
      const list = await listPredictions();
      setPred(list.find((x) => x.id === p.id) ?? p);
    } catch {
      recordMetric("settlement_failure", { operation: "attach_outcome" });
      toast.error("บันทึกผลจริงไม่สำเร็จ");
      return;
    }
    toast.success(
      evaluation.score.directionCorrect === null
        ? "เปิดผลแล้ว (สัญญาณเป็น “รอ” จึงไม่นับแพ้ชนะทิศทาง)"
        : evaluation.score.directionCorrect
          ? "เปิดผลแล้ว — ทายทิศทางถูก"
          : "เปิดผลแล้ว — ทายทิศทางผิด",
    );
  }

  if (!ready) return <AppShell>{null}</AppShell>;

  if (!pred) {
    return (
      <AppShell>
        <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <h1 className="font-semibold">ไม่พบคำพยากรณ์นี้</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            อาจถูกลบไปแล้ว หรือบันทึกไว้จากอุปกรณ์อื่น
          </p>
          <Link
            to="/history"
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            กลับหน้าบันทึกผล
          </Link>
        </section>
      </AppShell>
    );
  }

  const p = pred;
  const history = frozenMarketProvider.getCandlesUpTo(p.asOf, 40);
  const s = p.score;
  const activeVotes = p.models.filter((m) => !m.unavailable).length;

  return (
    <AppShell live={!p.demo}>
      <div className="space-y-4">
        <Link
          to="/history"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> กลับหน้าบันทึกผล
        </Link>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold">{fmtDateTime(p.asOf)}</h1>
              <p className="text-xs text-muted-foreground">
                ราคาตอนพยากรณ์ €{fmtPrice(p.price)} ·{" "}
                {p.mode === "time_machine" ? "ย้อนเวลา" : "ล่าสุด"} · {p.demo ? "Demo" : "Twelve Data"} · ข่าวแรง{" "}
                {riskLabel[p.newsRisk]}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1">
              <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
              <DirectionBadge direction={p.consensus.direction} soft />
            </span>
          </div>

          <div className="mt-3">
            <CandleChart
              history={history}
              forecast={p.forecast}
              actual={p.actual}
              support={p.plan.support}
              resistance={p.plan.resistance}
            />
          </div>

          {s ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Cell
                label="ทายทิศทาง"
                value={
                  s.directionCorrect === null
                    ? "ไม่นับ (สัญญาณรอ)"
                    : s.directionCorrect
                      ? "ถูก"
                      : "ผิด"
                }
              />
              <Cell
                label="ราคาไปทางไหนจริง"
                value={
                  s.actualDirection === "BUY"
                    ? "ขึ้น"
                    : s.actualDirection === "SELL"
                      ? "ลง"
                      : "ออกข้าง"
                }
              />
              <Cell label="คลาดเคลื่อนเฉลี่ย" value={`€${fmtPrice(s.mae)}`} />
              <Cell label="ทายทิศรายแท่ง" value={`${s.candleDirHits}/${s.candleDirTotal}`} />
            </dl>
          ) : p.demo ? (
            <Button variant="outline" className="mt-3 w-full" onClick={() => void reveal(p)}>
              <Eye className="h-4 w-4" aria-hidden /> เปิดผลจริง (ทำได้ครั้งเดียว)
            </Button>
          ) : (
            <p className="mt-3 rounded-lg bg-wait-soft p-2.5 text-xs text-muted-foreground">
              คำพยากรณ์นี้มาจาก Twelve Data และยังไม่เปิดการ settlement ด้วยข้อมูลจริง
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">สรุปที่บันทึกไว้</h2>
          <p className="mt-2 text-sm">{p.narrative.whatsHappening}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {p.narrative.why.map((w) => (
              <li key={w} className="flex gap-2">
                <span aria-hidden className="text-gold">
                  •
                </span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </section>

        <Accordion type="single" collapsible className="space-y-2">
          <Item value="models" title={`เสียงโหวต 5 โมเดล (ใช้ได้ ${activeVotes}/5)`}>
            <div className="space-y-3">
              {p.models.map((m, i) => (
                <ModelVoteCard key={m.id} model={m} index={i + 1} />
              ))}
              <EnsemblePanel ensemble={p.ensemble} />
            </div>
          </Item>
          {p.ai ? (
            <Item value="ai" title="คำอธิบายของนักวิเคราะห์ AI (บันทึกไว้)">
              <AiExplanationView ai={p.ai} />
            </Item>
          ) : null}
          <Item value="gate" title="เกณฑ์คุณภาพตอนนั้น">
            <GatePanel consensus={p.consensus} />
          </Item>
          <Item value="scen" title="ฉากทัศน์อนาคตที่คิดไว้">
            <ScenarioPanel scenarios={p.scenarios} />
          </Item>
        </Accordion>

        <Button
          variant="ghost"
          className="w-full text-bear"
          onClick={() => {
            void (async () => {
              await deletePrediction(p.id);
              toast.success("ลบรายการแล้ว");
              setPred(null);
            })();
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden /> ลบรายการนี้
        </Button>

        <Disclaimer live={!p.demo} />
      </div>
    </AppShell>
  );
}

function Item({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="rounded-xl border border-border bg-card px-4">
      <AccordionTrigger className="text-left text-sm font-semibold">{title}</AccordionTrigger>
      <AccordionContent className="pb-4">{children}</AccordionContent>
    </AccordionItem>
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

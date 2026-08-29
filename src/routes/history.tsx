import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Eye, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { DirectionBadge } from "@/components/app/DirectionBadge";
import { Button } from "@/components/ui/button";
import { fmtDateTime, fmtPrice } from "@/lib/format";
import { frozenMarketProvider } from "@/lib/market/frozen-provider";
import { frozenYahooGoldProvider } from "@/lib/market/yahoo-frozen-provider";
import { attachOutcome, listPredictions, saveLearningFeedback } from "@/lib/cloud-store";
import { evaluateSettlement } from "@/lib/settlement";
import { recordMetric } from "@/lib/observability";
import type { Prediction } from "@/lib/types";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "บันทึกผลพยากรณ์ — Market Prediction Playground" },
      {
        name: "description",
        content:
          "รายการคำพยากรณ์ที่ล็อกไว้ เปิดดูรายละเอียดทีละรายการ และเทียบกับข้อมูลของ source เดิมได้ครั้งเดียวต่อรายการ",
      },
      { property: "og:title", content: "บันทึกผลพยากรณ์ — Market Prediction Playground" },
      {
        property: "og:description",
        content: "รายการคำพยากรณ์ที่ล็อกไว้ พร้อมเปิดผลจริงเทียบทีละรายการ",
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
  const hasLive = preds.some((prediction) => !prediction.demo);
  const hasXm = preds.some((prediction) => prediction.marketMode === "xm");
  const hasCloud = preds.some((prediction) => prediction.marketMode !== "xm");
  const historyMode = hasXm && !hasCloud ? "xm" : "cloud";

  useEffect(() => {
    void (async () => {
      try {
        setPreds(await listPredictions());
      } catch {
        toast.error("โหลดบันทึกจาก Cloud ไม่สำเร็จ");
      }
      setReady(true);
    })();
  }, []);

  async function reveal(p: Prediction) {
    if (p.marketMode === "xm") {
      toast.info("คำพยากรณ์จาก XM GOLD ยังไม่เปิดการ settlement", {
        description: "ระบบจะไม่ใช้ Yahoo GC=F หรือชุดข้อมูล XAUEUR มาเทียบแทน source ของ XM",
      });
      return;
    }
    if (!p.demo) {
      toast.info(`คำพยากรณ์จาก ${p.provider ?? "แหล่งข้อมูลจริง"} ยังไม่เปิดการเทียบผลอัตโนมัติ`, {
        description:
          "ระบบจะไม่ใช้ชุดข้อมูลเดโมหรือคนละ instrument มาเทียบกับคำพยากรณ์จากแหล่งข้อมูลจริง",
      });
      return;
    }
    const provider = p.symbol === "GC=F" ? frozenYahooGoldProvider : frozenMarketProvider;
    const evaluation = evaluateSettlement(p, provider);
    if (evaluation.status === "already_settled") {
      setPreds(await listPredictions());
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
      try {
        await saveLearningFeedback(p, evaluation.actual, evaluation.score);
      } catch {
        recordMetric("settlement_failure", { operation: "learning_feedback" });
      }
      recordMetric("settlement_completed", { source: "history" });
      setPreds(await listPredictions());
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

  return (
    <AppShell live={hasLive} marketMode={historyMode}>
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <h1 className="font-semibold">บันทึกผลพยากรณ์</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            คำพยากรณ์ทุกครั้งถูกล็อกไว้บน Lovable Cloud แอปจะไม่แก้ค่าเดิม
            และเปิดผลจริงได้ครั้งเดียว เพื่อกันการแก้คำตอบย้อนหลัง · ดูภาพรวมสถิติได้ที่แท็บ “สถิติ”
          </p>
        </section>

        {ready && !preds.length ? (
          <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm font-medium">ยังไม่มีบันทึก</p>
            <p className="mt-1 text-sm text-muted-foreground">
              ไปหน้าวิเคราะห์ แล้วกด “บันทึกคำพยากรณ์นี้” หนึ่งครั้ง รายการจะมาโผล่ที่นี่
            </p>
            <Link
              to="/"
              className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              ไปหน้าวิเคราะห์
            </Link>
          </section>
        ) : null}

        {preds.map((p) => (
          <article key={p.id} className="rounded-xl border border-border bg-card p-3">
            <Link
              to="/history/$id"
              params={{ id: p.id }}
              className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate text-sm font-semibold">{fmtDateTime(p.asOf)}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {p.symbol} {fmtPrice(p.price)} · ความมั่นใจ {p.consensus.confidence}% ·{" "}
                  {p.mode === "time_machine" ? "ย้อนเวลา" : "ล่าสุด"} ·{" "}
                  {p.demo
                    ? p.marketMode === "xm"
                      ? "XM · source snapshot"
                      : "DEMO"
                    : `${p.marketMode === "xm" ? "XM · MT5" : p.provider ?? "LIVE"} · ${p.dataStatus ?? "source"}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <DirectionBadge direction={p.consensus.direction} soft />
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </span>
            </Link>

            <div className="mt-2 flex items-center gap-2">
              {p.score ? (
                <p className="text-xs">
                  <span className="text-muted-foreground">ผลจริง: </span>
                  <span
                    className={
                      p.score.directionCorrect === null
                        ? "text-muted-foreground"
                        : p.score.directionCorrect
                          ? "font-semibold text-bull"
                          : "font-semibold text-bear"
                    }
                  >
                    {p.score.directionCorrect === null
                      ? "ไม่นับ (สัญญาณรอ)"
                      : p.score.directionCorrect
                        ? "ทายถูก"
                        : "ทายผิด"}
                  </span>
                  <span className="text-muted-foreground"> · คลาด €{fmtPrice(p.score.mae)}</span>
                </p>
              ) : p.demo && p.marketMode !== "xm" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => void reveal(p)}
                >
                  <Eye className="h-4 w-4" aria-hidden /> เปิดผลจริง
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {p.provider ?? "Live source"} · ยังไม่เปิดการ settlement ด้วยข้อมูล source เดิม
                </p>
              )}
            </div>
          </article>
        ))}

        {preds.length ? (
          <p className="px-2 text-center text-[11px] text-muted-foreground">
            ประวัติถูกเก็บแบบถาวรเพื่อให้ระบบเรียนรู้จากคำทำนายที่ถูกและผิด
          </p>
        ) : null}

        <Disclaimer live={hasLive} marketMode={historyMode} />
      </div>
    </AppShell>
  );
}

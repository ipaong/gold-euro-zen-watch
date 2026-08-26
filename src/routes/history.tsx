import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Eye, Lock, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { DirectionBadge } from "@/components/app/DirectionBadge";
import { Button } from "@/components/ui/button";
import { fmtDateTime, fmtPrice } from "@/lib/format";
import { frozenMarketProvider } from "@/lib/market/frozen-provider";
import { scorePrediction } from "@/lib/scoring";
import { attachOutcome, clearPredictions, listPredictions } from "@/lib/cloud-store";
import type { Prediction } from "@/lib/types";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "บันทึกผลพยากรณ์ — XAUEUR Signal Lab" },
      {
        name: "description",
        content:
          "รายการคำพยากรณ์ที่ล็อกไว้ในเครื่องนี้ เปิดดูรายละเอียดทีละรายการ และเทียบกับแท่งเทียนที่เกิดขึ้นจริงได้ครั้งเดียวต่อรายการ",
      },
      { property: "og:title", content: "บันทึกผลพยากรณ์ — XAUEUR Signal Lab" },
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
    const actual = frozenMarketProvider.getCandlesAfter(p.asOf, p.horizon);
    if (actual.length < p.horizon) {
      toast.error("ยังเปิดผลไม่ได้", {
        description: "ชุดข้อมูลเดโมยังไม่มีแท่งถัดไปครบ 5 แท่งหลังเวลาที่พยากรณ์",
      });
      return;
    }
    const score = scorePrediction(p, actual);
    try {
      await attachOutcome(p.id, actual, score);
      setPreds(await listPredictions());
    } catch {
      toast.error("บันทึกผลจริงไม่สำเร็จ");
      return;
    }
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
            คำพยากรณ์ทุกครั้งถูกล็อกไว้บน Lovable Cloud แอปจะไม่แก้ค่าเดิม และเปิดผลจริงได้ครั้งเดียว
            เพื่อกันการแก้คำตอบย้อนหลัง · ดูภาพรวมสถิติได้ที่แท็บ “สถิติ”
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
                  €{fmtPrice(p.price)} · ความมั่นใจ {p.consensus.confidence}% ·{" "}
                  {p.mode === "time_machine" ? "ย้อนเวลา" : "ล่าสุด"}
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
              ) : (
                <Button variant="outline" size="sm" className="flex-1" onClick={() => void reveal(p)}>
                  <Eye className="h-4 w-4" aria-hidden /> เปิดผลจริง
                </Button>
              )}
            </div>
          </article>
        ))}

        {preds.length ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-bear"
            onClick={() => {
              void (async () => {
                await clearPredictions();
                setPreds(await listPredictions());
                toast.success("ล้างบันทึกทั้งหมดแล้ว");
              })();
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> ล้างบันทึกทั้งหมด
          </Button>
        ) : null}

        <Disclaimer />
      </div>
    </AppShell>
  );
}

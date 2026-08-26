import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { DirectionBadge } from "@/components/app/DirectionBadge";
import { fmtDateTime, fmtPrice } from "@/lib/format";
import { computeStats } from "@/lib/scoring";
import { loadPredictions } from "@/lib/storage";
import type { Prediction } from "@/lib/types";

export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "สถิติความแม่นยำ — XAUEUR Signal Lab" },
      {
        name: "description",
        content:
          "สรุปผลงานของระบบจากคำพยากรณ์ที่คุณบันทึกไว้จริง อัตราทายทิศถูก ค่าคลาดเคลื่อนเฉลี่ย และความแม่นรายแท่ง โดยไม่มีตัวเลขสมมติ",
      },
      { property: "og:title", content: "สถิติความแม่นยำ — XAUEUR Signal Lab" },
      {
        property: "og:description",
        content: "อัตราทายทิศถูก ค่าคลาดเคลื่อนเฉลี่ย และความแม่นรายแท่งจากบันทึกจริง",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerformancePage,
});

function PerformancePage() {
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPreds(loadPredictions());
    setReady(true);
  }, []);

  const stats = computeStats(preds);
  const scored = preds.filter((p) => p.score);

  return (
    <AppShell>
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <header className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gold" aria-hidden />
            <h1 className="font-semibold">สถิติความแม่นยำ</h1>
          </header>
          <p className="mt-1 text-xs text-muted-foreground">
            ทุกตัวเลขคำนวณจากบันทึกของคุณเองที่เก็บไว้ในเครื่องนี้ ไม่มีค่าสมมติ
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Cell label="บันทึกทั้งหมด" value={`${stats.total} ครั้ง`} />
            <Cell label="เปิดผลแล้ว" value={`${stats.scored} ครั้ง`} />
            <Cell
              label="ทายทิศถูก"
              value={
                stats.hitRate === null
                  ? "—"
                  : `${stats.hitRate}% (${stats.hits}/${stats.directional})`
              }
            />
            <Cell
              label="คลาดเคลื่อนเฉลี่ย"
              value={stats.avgMae === null ? "—" : `€${fmtPrice(stats.avgMae)}`}
            />
            <Cell
              label="ทายทิศรายแท่งถูก"
              value={stats.candleHitRate === null ? "—" : `${stats.candleHitRate}%`}
            />
            <Cell label="สัญญาณ “รอ”" value={`${stats.waitCount} ครั้ง`} />
          </dl>
        </section>

        {ready && !preds.length ? (
          <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm font-medium">ยังไม่มีข้อมูลให้คิดสถิติ</p>
            <p className="mt-1 text-sm text-muted-foreground">
              ไปที่หน้าวิเคราะห์ กด “บันทึกคำพยากรณ์นี้” แล้วกลับมาเปิดผลจริงที่หน้าบันทึกผล
            </p>
            <Link
              to="/"
              className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              ไปหน้าวิเคราะห์
            </Link>
          </section>
        ) : null}

        {scored.length ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold">รายการที่เปิดผลแล้ว</h2>
            <ul className="mt-2 divide-y divide-border">
              {scored.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/history/$id"
                    params={{ id: p.id }}
                    className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {fmtDateTime(p.asOf)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        คลาดเคลื่อนเฉลี่ย €{fmtPrice(p.score!.mae)} · รายแท่ง{" "}
                        {p.score!.candleDirHits}/{p.score!.candleDirTotal}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <DirectionBadge direction={p.consensus.direction} soft />
                      <span
                        className={`text-xs font-semibold ${
                          p.score!.directionCorrect === null
                            ? "text-muted-foreground"
                            : p.score!.directionCorrect
                              ? "text-bull"
                              : "text-bear"
                        }`}
                      >
                        {p.score!.directionCorrect === null
                          ? "ไม่นับ"
                          : p.score!.directionCorrect
                            ? "ถูก"
                            : "ผิด"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Disclaimer />
      </div>
    </AppShell>
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

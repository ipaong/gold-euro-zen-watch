import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { DirectionBadge } from "@/components/app/DirectionBadge";
import { fmtDateTime, fmtPrice } from "@/lib/format";
import { listPredictions } from "@/lib/cloud-store";
import {
  computeStats,
  MIN_SAMPLE_SIZE,
  SCORE_WINDOWS,
  selectPredictionWindow,
} from "@/lib/scoring";
import { PILOT_PROTOCOL, summarizePilot } from "@/lib/pilot";
import { computeReplayAudit } from "@/lib/replay-audit";
import type { ModelStats, ScoreWindow } from "@/lib/scoring";
import type { Prediction } from "@/lib/types";

export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "สถิติความแม่นยำ — Market Prediction Playground" },
      {
        name: "description",
        content:
          "สรุปผลงานของระบบจากคำพยากรณ์ที่คุณบันทึกไว้จริง เปรียบเทียบ 5 โมเดลกับ Consensus พร้อมจำนวนตัวอย่างและคำเตือนเมื่อข้อมูลน้อย",
      },
      { property: "og:title", content: "สถิติความแม่นยำ — Market Prediction Playground" },
      {
        property: "og:description",
        content:
          "เปรียบเทียบ 5 โมเดลกับ Consensus จากผลที่เปิดเผยจริง โดยไม่อ้างความแม่นเกินข้อมูล",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerformancePage,
});

function PerformancePage() {
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [window, setWindow] = useState<ScoreWindow>("all");
  const [ready, setReady] = useState(false);
  const hasLive = preds.some((prediction) => !prediction.demo);

  useEffect(() => {
    void (async () => {
      try {
        setPreds(await listPredictions());
      } catch {
        /* keep empty stats when the cloud is unreachable */
      }
      setReady(true);
    })();
  }, []);

  const selected = useMemo(() => selectPredictionWindow(preds, window), [preds, window]);
  const stats = useMemo(() => computeStats(selected), [selected]);
  const replayAudit = useMemo(() => computeReplayAudit(selected), [selected]);
  const pilot = useMemo(() => summarizePilot(preds), [preds]);
  const scored = selected.filter((p) => p.score);
  const selectedWindowLabel =
    SCORE_WINDOWS.find((item) => item.value === window)?.label ?? "ทั้งหมด";

  return (
    <AppShell live={hasLive}>
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <header className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gold" aria-hidden />
            <h1 className="font-semibold">สถิติความแม่นยำ</h1>
          </header>
          <p className="mt-1 text-xs text-muted-foreground">
            ตัวเลขทั้งหมดคำนวณจากคำพยากรณ์ที่ล็อกและเปิดผลจริงแล้วของคุณเอง
            ไม่ใช่ผลจำลองหรือคำรับประกัน
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="ช่วงข้อมูลสถิติ">
            {SCORE_WINDOWS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={window === option.value}
                onClick={() => setWindow(option.value)}
                className={`min-h-10 rounded-lg border px-3 text-xs font-medium transition-colors ${
                  window === option.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>ช่วงที่เลือก: {selectedWindowLabel}</span>
            {stats.scoreVersions.length ? (
              <span>สัญญาคะแนน: {stats.scoreVersions.join(", ")}</span>
            ) : null}
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <Cell label="คำพยากรณ์ในช่วงนี้" value={`${stats.total} ครั้ง`} />
            <Cell label="เปิดผลแล้ว" value={`${stats.scored}/${stats.total}`} />
            <Cell
              label="ทายทิศถูก"
              value={
                stats.hitRate === null
                  ? "—"
                  : `${stats.hitRate}% (${stats.hits}/${stats.directional})`
              }
            />
            <Cell
              label="MAE ของราคาปิด"
              value={
                stats.avgMae === null
                  ? "—"
                  : `${fmtPrice(stats.avgMae)} price units (n=${stats.scored})`
              }
            />
            <Cell
              label="ทิศทางรายแท่ง"
              value={
                stats.candleHitRate === null
                  ? "—"
                  : `${stats.candleHitRate}% (${scored.reduce((sum, p) => sum + p.score!.candleDirHits, 0)}/${scored.reduce((sum, p) => sum + p.score!.candleDirTotal, 0)})`
              }
            />
            <Cell label="สัญญาณ WAIT" value={`${stats.waitCount}/${stats.total}`} />
          </dl>

          {stats.mixedScoreVersions ? (
            <p className="mt-3 rounded-lg border border-gold/30 bg-accent p-2 text-xs text-accent-foreground">
              ช่วงนี้มีผลจาก scoring หลายเวอร์ชันปะปนกัน จึงควรแยกพิจารณาก่อนเปรียบเทียบแนวโน้ม
            </p>
          ) : null}
          {stats.scored < MIN_SAMPLE_SIZE ? (
            <p className="mt-2 rounded-lg border border-gold/30 bg-accent p-2 text-xs text-accent-foreground">
              คำเตือน: มีผลที่เปิดเผยแล้วเพียง {stats.scored} ตัวอย่าง
              ค่านี้ยังไม่มากพอสำหรับสรุปความสามารถของระบบ (เกณฑ์แนะนำเบื้องต้นคือ {MIN_SAMPLE_SIZE}{" "}
              ตัวอย่าง)
            </p>
          ) : null}
        </section>

        <ReplayAuditPanel audit={replayAudit} />

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

        <PilotPanel summary={pilot} />

        {stats.modelStats.length ? <ModelScoreboard models={stats.modelStats} /> : null}

        {scored.length ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold">รายการที่เปิดผลแล้วในช่วงที่เลือก</h2>
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
                        {p.symbol} ·{" "}
                        {p.demo
                          ? "DEMO · frozen snapshot"
                          : `${p.provider ?? "source"} · ${p.dataStatus ?? "status"}`}{" "}
                        · MAE {fmtPrice(p.score!.mae)} units · รายแท่ง {p.score!.candleDirHits}/
                        {p.score!.candleDirTotal}
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

        <Disclaimer live={hasLive} />
      </div>
    </AppShell>
  );
}

function ReplayAuditPanel({ audit }: { audit: ReturnType<typeof computeReplayAudit> }) {
  const diagnosisLabel = {
    insufficient: "ข้อมูลยังไม่พอ",
    possible_inverse: "ควรตรวจบั๊กกลับทิศ",
    direct_better: "ทิศเดิมดีกว่ากลับทาง",
    mixed: "ผลยังผสมกัน",
  }[audit.diagnosis];

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold">Replay Accuracy Audit</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        ตรวจเฉพาะคำพยากรณ์ที่ล็อกและเปิดผลแล้ว เปรียบเทียบทิศเดิมกับการกลับ BUY/SELL
        โดยไม่แก้ผลย้อนหลัง และไม่นับ WAIT เป็นทายผิด
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Cell
          label="Coverage ที่ยอมทาย"
          value={
            audit.coverage === null
              ? "—"
              : `${audit.coverage}% (${audit.directional}/${audit.scored})`
          }
        />
        <Cell
          label="ทิศเดิม (คู่เทียบได้)"
          value={
            audit.directAccuracy === null
              ? "—"
              : `${audit.directAccuracy}% (${audit.directHits}/${audit.comparable})`
          }
        />
        <Cell
          label="Inverse BUY↔SELL"
          value={
            audit.inverseAccuracy === null
              ? "—"
              : `${audit.inverseAccuracy}% (${audit.inverseHits}/${audit.comparable})`
          }
        />
        <Cell
          label="Baseline ตาม 5 แท่งก่อนหน้า"
          value={
            audit.continuationAccuracy === null
              ? "—"
              : `${audit.continuationAccuracy}% (${audit.continuationHits}/${audit.continuationSample})`
          }
        />
        <Cell
          label="WAIT ที่ตลาดไปเป็นทิศ"
          value={`${audit.waitWithDirectionalOutcome}/${audit.waitCount}`}
        />
        <Cell label="ผลตรวจเบื้องต้น" value={diagnosisLabel} />
      </dl>
      <p
        className={`mt-3 rounded-lg border p-2.5 text-xs ${
          audit.diagnosis === "possible_inverse"
            ? "border-bear/30 bg-bear-soft text-bear"
            : "border-border bg-muted text-muted-foreground"
        }`}
      >
        {audit.note} ตัวเลข Inverse เป็นเครื่องตรวจบั๊ก ไม่ใช่คำสั่งให้กลับสัญญาณอัตโนมัติ
      </p>
    </section>
  );
}

function PilotPanel({ summary }: { summary: ReturnType<typeof summarizePilot> }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold">Controlled pilot protocol</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        protocol นี้ล็อกก่อนปรับโมเดล: tuning {PILOT_PROTOCOL.tuningPredictions} รายการ + evaluation{" "}
        {PILOT_PROTOCOL.evaluationPredictions} รายการ
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Cell label="Locked ทั้งหมด" value={`${summary.locked}/${PILOT_PROTOCOL.minimumLocked}`} />
        <Cell
          label="เปิดผลแล้ว"
          value={`${summary.scored} (${summary.settlementCompleteness ?? 0}%)`}
        />
        <Cell
          label="Evaluation ทายทิศถูก"
          value={
            summary.primaryMetric.estimate === null
              ? "—"
              : `${summary.primaryMetric.estimate}% (n=${summary.primaryMetric.sample})`
          }
        />
        <Cell
          label="ช่วง uncertainty 95%"
          value={
            summary.primaryMetric.lower === null
              ? "—"
              : `${summary.primaryMetric.lower}–${summary.primaryMetric.upper}%`
          }
        />
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Evaluation แยกตามลำดับเวลาและยังไม่ eligible จนกว่าจะครบขั้นต่ำ;
        ห้ามใช้ตัวเลขนี้อ้างผลกำไรหรือ probability ของ scenario
      </p>
      {summary.warnings.length ? (
        <ul className="mt-2 space-y-1 rounded-lg bg-wait-soft p-2.5 text-xs text-muted-foreground">
          {summary.warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs font-medium text-bull">
          Pilot พร้อมเข้าสู่การตัดสิน go/no-go ตาม protocol
        </p>
      )}
    </section>
  );
}

function ModelScoreboard({ models }: { models: ModelStats[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold">เปรียบเทียบรายโมเดล</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Consensus คือผลจาก Quality Gate ส่วน Ensemble เป็นความเห็นประกอบและไม่ถูกนับเป็นโมเดลโหวต
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <caption className="sr-only">สถิติรายโมเดลและ Consensus</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2 font-medium">โมเดล</th>
              <th className="px-2 py-2 font-medium">ตัวอย่าง</th>
              <th className="px-2 py-2 font-medium">ทิศถูก</th>
              <th className="px-2 py-2 font-medium">BUY</th>
              <th className="px-2 py-2 font-medium">SELL</th>
              <th className="px-2 py-2 font-medium">WAIT</th>
              <th className="px-2 py-2 font-medium">ความมั่นใจเฉลี่ย</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.id} className="border-b border-border/70 last:border-0">
                <th className="px-2 py-2 font-medium">{model.name}</th>
                <td className="px-2 py-2 tabular">{model.sample}</td>
                <td className="px-2 py-2 tabular">
                  {formatRate(model.hitRate)} ({model.hits}/{model.directional})
                </td>
                <td className="px-2 py-2 tabular">
                  {formatRate(model.buyAccuracy)} ({model.buyHits}/{model.buySample})
                </td>
                <td className="px-2 py-2 tabular">
                  {formatRate(model.sellAccuracy)} ({model.sellHits}/{model.sellSample})
                </td>
                <td className="px-2 py-2 tabular">
                  {formatRate(model.waitFrequency)} ({model.waitCount}/{model.sample})
                </td>
                <td className="px-2 py-2 tabular">
                  {model.avgConfidence === null ? "—" : `${model.avgConfidence}%`}
                  {model.unavailable ? ` · ใช้ไม่ได้ ${model.unavailable}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-2">
        <h3 className="text-sm font-medium">Confidence calibration</h3>
        <p className="text-xs text-muted-foreground">
          แต่ละช่วงแสดงจำนวนผลทิศทางที่ประเมินได้จริง ไม่ใช่การรับรองว่าความมั่นใจเป็น probability
          ที่ calibrate แล้ว
        </p>
        {models.map((model) => (
          <details key={model.id} className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">{model.name}</summary>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {model.calibration.map((bucket) => (
                <div key={bucket.label} className="rounded-md bg-muted p-2 text-xs">
                  <div className="text-muted-foreground">{bucket.label}</div>
                  <div className="mt-0.5 font-semibold">
                    {formatRate(bucket.accuracy)} ({bucket.hits}/{bucket.sample})
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function formatRate(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular font-semibold">{value}</dd>
    </div>
  );
}

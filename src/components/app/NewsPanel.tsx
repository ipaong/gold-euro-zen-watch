import { Newspaper } from "lucide-react";

import {
  eurBiasLabel,
  fmtDateTime,
  fmtMinutes,
  goldBiasLabel,
  impactLabel,
  riskLabel,
} from "@/lib/format";
import type { NewsSnapshot } from "@/lib/types";

const tagLabel = {
  gold_up: "ทอง +",
  gold_down: "ทอง −",
  eur_up: "ยูโร +",
  eur_down: "ยูโร −",
} as const;

export function NewsPanel({ news, loading }: { news: NewsSnapshot; loading?: boolean }) {
  const ai = news.interpretation ?? null;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Newspaper className="h-4 w-4 text-gold" aria-hidden />
        <h2 className="font-semibold">ข่าว & ปฏิทินเศรษฐกิจ</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
          {loading ? "กำลังดึงข่าวจริง…" : news.live ? "ข่าวจริง (LIVE)" : "ข่าวเดโม"}
        </span>
        {news.stale ? (
          <span className="rounded-full bg-wait-soft px-2 py-0.5 text-[11px] text-muted-foreground">
            ข่าวไม่สด
          </span>
        ) : null}
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          ความเสี่ยงข่าว: {riskLabel[news.riskLevel]}
        </span>
      </header>

      {!news.available ? (
        <p className="mt-3 rounded-lg bg-wait-soft p-2.5 text-sm text-muted-foreground">
          {loading
            ? "กำลังดึงข่าวจากแหล่งจริง…"
            : "ไม่มีข้อมูลข่าวในช่วงเวลานี้ ระบบจะไม่เดาข่าวเอง และลดความมั่นใจของโมเดลข่าวลง"}
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Stat label="ฝั่งทองคำ" value={goldBiasLabel[news.goldBias]} />
            <Stat label="ฝั่งยูโร" value={eurBiasLabel[news.eurBias]} />
          </div>

          {ai ? (
            <div className="mt-3 rounded-lg border border-border p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">AI อ่านข่าวให้</span>
                <span className="rounded bg-secondary px-1.5 text-xs">
                  XAUEUR: {ai.xaueurBias} · มั่นใจ {ai.confidence}%
                </span>
              </div>
              {ai.keyDrivers.length ? (
                <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                  {ai.keyDrivers.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : null}
              {ai.risks.length ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  ความเสี่ยง: {ai.risks.join(" · ")}
                </p>
              ) : null}
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                AI อ่านเฉพาะข่าวจริงในรายการนี้ ห้ามแต่งข่าวเอง และไม่มีสิทธิ์ตัดสินสัญญาณสุดท้าย
              </p>
            </div>
          ) : null}

          {news.providerErrors && news.providerErrors.length ? (
            <p className="mt-2 rounded-lg bg-wait-soft p-2 text-xs text-muted-foreground">
              บางแหล่งดึงไม่สำเร็จ: {news.providerErrors.join(" · ")}
            </p>
          ) : null}

          {news.nextHighImpact && news.minutesToHighImpact !== null ? (
            <p className="mt-3 rounded-lg bg-accent p-2.5 text-sm text-accent-foreground">
              ข่าวผลกระทบสูงถัดไป: <strong>{news.nextHighImpact.name}</strong> อีก{" "}
              {fmtMinutes(news.minutesToHighImpact)}
            </p>
          ) : null}


          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            ปฏิทินใกล้เวลานี้
          </h3>
          <ul className="mt-1 divide-y divide-border">
            {[...news.recent, ...news.upcoming].slice(0, 6).map((e) => (
              <li key={e.id} className="py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-secondary px-1.5 text-xs">{e.currency}</span>
                  <span className="truncate font-medium">{e.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {fmtDateTime(e.time)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>ผลกระทบ: {impactLabel[e.impact]}</span>
                  <span>คาด: {e.forecast}</span>
                  <span>ก่อนหน้า: {e.previous}</span>
                  <span className={e.released ? "text-foreground" : ""}>
                    จริง: {e.released && e.actual ? e.actual : "ยังไม่ประกาศ"}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            พาดหัวข่าวที่ใช้วิเคราะห์ (ข้อมูลเดโม)
          </h3>
          <ul className="mt-1 space-y-2">
            {news.headlines.slice(0, 6).map((h) => (
              <li key={h.id} className="text-sm">
                <div className="flex gap-2">
                  <span className="shrink-0 rounded bg-secondary px-1.5 text-xs">
                    {tagLabel[h.tag]}
                  </span>
                  <span>{h.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {h.source} · {fmtDateTime(h.publishedAt)} · ผลกระทบ {impactLabel[h.impact]}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-2.5">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

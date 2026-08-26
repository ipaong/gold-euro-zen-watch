import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, Check, Sliders } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { CandleChart } from "@/components/app/CandleChart";
import { DirectionBadge } from "@/components/app/DirectionBadge";
import { EnsemblePanel } from "@/components/app/EnsemblePanel";
import { GatePanel } from "@/components/app/GatePanel";
import { ModelVoteCard } from "@/components/app/ModelVoteCard";
import { NewsPanel } from "@/components/app/NewsPanel";
import { ScenarioPanel } from "@/components/app/ScenarioPanel";
import { TimeMachineBar } from "@/components/app/TimeMachineBar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyze } from "@/lib/analysis";
import { fmtDateTime, fmtPct, fmtPrice, regimeLabel, riskLabel } from "@/lib/format";
import { M15_MS, frozenMarketProvider } from "@/lib/market/frozen-provider";
import { MIN_WARMUP_CANDLES } from "@/lib/market/provider";
import { loadSettings, newPredictionId, savePrediction, saveSettings } from "@/lib/storage";
import type { AppSettings, Prediction } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "XAUEUR Signal Lab — ห้องทดลองพยากรณ์ทองคำ/ยูโร M15" },
      {
        name: "description",
        content:
          "วิเคราะห์ XAUEUR ราย 15 นาทีด้วย 5 โมเดลโหวต ฉากทัศน์อนาคต 5 แบบ และเกณฑ์คุณภาพที่ตัดสินสัญญาณสุดท้าย พร้อมโหมดย้อนเวลาแบบไม่แอบดูอนาคต",
      },
      { property: "og:title", content: "XAUEUR Signal Lab — ห้องทดลองพยากรณ์ทองคำ/ยูโร" },
      {
        property: "og:description",
        content: "5 โมเดลโหวต + ฉากทัศน์ 5 แบบ + เกณฑ์คุณภาพ บนข้อมูลเดโมที่ตรึงไว้",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LabPage,
});

function LabPage() {
  const earliest = frozenMarketProvider.getEarliestTime();
  const latest = frozenMarketProvider.getLatestTime();
  const firstAnalyzable = earliest + MIN_WARMUP_CANDLES * M15_MS;
  const maxIndex = Math.max(0, Math.round((latest - firstAnalyzable) / M15_MS));

  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [timeMachine, setTimeMachine] = useState(false);
  const [index, setIndex] = useState(maxIndex);
  const [saved, setSaved] = useState<string | null>(null);

  const asOf = timeMachine ? firstAnalyzable + index * M15_MS : latest;

  const result = useMemo(() => {
    try {
      return analyze(asOf, settings);
    } catch {
      return null;
    }
  }, [asOf, settings]);

  if (!result) {
    return (
      <AppShell>
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="font-semibold">ข้อมูลไม่พอสำหรับการวิเคราะห์</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ต้องมีแท่งย้อนหลังอย่างน้อย {MIN_WARMUP_CANDLES} แท่ง เพื่อคำนวณ EMA200 ให้เชื่อถือได้
            ลองเลื่อนเวลาไปข้างหน้า
          </p>
        </div>
      </AppShell>
    );
  }

  const { snapshot, news, models, ensemble, scenarios, forecast, consensus, plan, narrative } =
    result;

  const activeVotes = models.filter((m) => !m.unavailable).length;

  function handleSave() {
    const prediction: Prediction = {
      id: newPredictionId(asOf),
      asOf,
      createdAt: Date.now(),
      mode: timeMachine ? "time_machine" : "live",
      demo: true,
      symbol: "XAUEUR",
      timeframe: "M15",
      horizon: settings.horizon,
      price: snapshot.price,
      models,
      ensemble,
      consensus,
      scenarios,
      forecast,
      plan,
      narrative,
      newsRisk: news.riskLevel,
      goldBias: news.goldBias,
      eurBias: news.eurBias,
      actual: null,
      score: null,
      locked: true,
    };
    savePrediction(prediction);
    setSaved(prediction.id);
    toast.success("บันทึกคำพยากรณ์แล้ว", {
      description: "ล็อกไว้แก้ไม่ได้ ดูผลเทียบของจริงได้ที่แท็บบันทึกผล",
    });
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-sm text-muted-foreground">XAUEUR · M15</h1>
              <p className="tabular text-3xl font-bold leading-tight">{fmtPrice(snapshot.price)}</p>
              <p
                className={`tabular text-sm ${snapshot.changePct >= 0 ? "text-bull" : "text-bear"}`}
              >
                {fmtPct(snapshot.changePct)} จากแท่งก่อน
              </p>
            </div>
            <div className="text-right">
              <DirectionBadge direction={consensus.direction} size="lg" />
              <p className="mt-1 text-xs text-muted-foreground">สัญญาณสุดท้าย</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Progress value={consensus.confidence} className="h-2 flex-1" />
            <span className="tabular text-sm font-semibold">{consensus.confidence}%</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            เห็นตรงกัน {consensus.agree}/{activeVotes} โมเดล · สภาพตลาด{" "}
            {regimeLabel[snapshot.regime]} · ความเสี่ยงข่าว {riskLabel[news.riskLevel]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            เวลาที่ใช้วิเคราะห์: {fmtDateTime(asOf)}
          </p>

          <div className="mt-3">
            <CandleChart
              history={snapshot.candles}
              forecast={forecast}
              support={snapshot.support}
              resistance={snapshot.resistance}
            />
          </div>

          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={handleSave} disabled={saved !== null}>
              {saved ? (
                <>
                  <Check className="h-4 w-4" aria-hidden /> บันทึกแล้ว
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4" aria-hidden /> บันทึกคำพยากรณ์นี้
                </>
              )}
            </Button>
            <SettingsSheet
              settings={settings}
              onChange={(s) => {
                setSettings(s);
                saveSettings(s);
                setSaved(null);
              }}
            />
          </div>
        </section>

        <TimeMachineBar
          enabled={timeMachine}
          onToggle={(v) => {
            setTimeMachine(v);
            setSaved(null);
          }}
          index={index}
          maxIndex={maxIndex}
          asOf={asOf}
          onIndexChange={(i) => {
            setIndex(i);
            setSaved(null);
          }}
        />

        <Tabs defaultValue="models">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="models">โมเดล</TabsTrigger>
            <TabsTrigger value="gate">เกณฑ์</TabsTrigger>
            <TabsTrigger value="future">อนาคต</TabsTrigger>
            <TabsTrigger value="news">ข่าว</TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              5 โมเดลนี้วิเคราะห์แยกกันคนละมุม แล้วโหวตทิศทางของตัวเอง แตะเพื่อดูเหตุผลเต็ม
            </p>
            {models.map((m, i) => (
              <ModelVoteCard key={m.id} model={m} index={i + 1} />
            ))}
            <EnsemblePanel ensemble={ensemble} />
          </TabsContent>

          <TabsContent value="gate" className="mt-3 space-y-3">
            <GatePanel consensus={consensus} />
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-semibold">ระดับราคาอ้างอิง</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                ใช้ประกอบการอ่านกราฟเท่านั้น ไม่ใช่คำสั่งซื้อขายและไม่มีการแนะนำขนาดสัญญา
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <Cell label="แนวรับ" value={fmtPrice(plan.support)} />
                <Cell label="แนวต้าน" value={fmtPrice(plan.resistance)} />
                <Cell label="จุดที่ถือว่าคิดผิด" value={fmtPrice(plan.invalidation)} />
                <Cell label="ATR (14)" value={fmtPrice(plan.atr)} />
              </dl>
            </section>
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-semibold">สรุปเป็นภาษาคน</h2>
              <p className="mt-2 text-sm">{narrative.whatsHappening}</p>
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ทำไมจึงสรุปแบบนี้
              </h3>
              <ul className="mt-1 space-y-1 text-sm">
                {narrative.why.map((w) => (
                  <li key={w} className="flex gap-2">
                    <span aria-hidden className="text-gold">
                      •
                    </span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                อะไรจะทำให้มุมมองนี้ผิด
              </h3>
              <ul className="mt-1 space-y-1 text-sm">
                {narrative.invalidate.map((w) => (
                  <li key={w} className="flex gap-2">
                    <span aria-hidden className="text-bear">
                      !
                    </span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </section>
          </TabsContent>

          <TabsContent value="future" className="mt-3 space-y-3">
            <ScenarioPanel scenarios={scenarios} />
          </TabsContent>

          <TabsContent value="news" className="mt-3">
            <NewsPanel news={news} />
          </TabsContent>
        </Tabs>

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

function SettingsSheet({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" aria-label="ตั้งค่าเกณฑ์คุณภาพ">
          <Sliders className="h-4 w-4" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>ตั้งค่าเกณฑ์คุณภาพ</SheetTitle>
          <SheetDescription>
            ยิ่งเข้มงวด ระบบยิ่งบอก “รอ” บ่อยขึ้น ซึ่งเป็นเรื่องปกติและดีต่อการทดสอบ
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          <Field
            label={`ความมั่นใจขั้นต่ำ: ${settings.confidenceThreshold}%`}
            value={settings.confidenceThreshold}
            min={40}
            max={90}
            step={5}
            onChange={(v) => onChange({ ...settings, confidenceThreshold: v })}
          />
          <Field
            label={`โมเดลต้องเห็นตรงกันขั้นต่ำ: ${settings.minAgreement} จาก 5`}
            value={settings.minAgreement}
            min={2}
            max={5}
            step={1}
            onChange={(v) => onChange({ ...settings, minAgreement: v })}
          />
          <Field
            label={`เลี่ยงข่าวแรงก่อน-หลัง: ${settings.newsAvoidMinutes} นาที`}
            value={settings.newsAvoidMinutes}
            min={0}
            max={120}
            step={15}
            onChange={(v) => onChange({ ...settings, newsAvoidMinutes: v })}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
        aria-label={label}
      />
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Check, Sliders } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AiAnalystPanel } from "@/components/app/AiAnalystPanel";
import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { CandleChart } from "@/components/app/CandleChart";
import { EnsemblePanel } from "@/components/app/EnsemblePanel";
import { GatePanel } from "@/components/app/GatePanel";
import { ModelVoteCard } from "@/components/app/ModelVoteCard";
import { NewsPanel } from "@/components/app/NewsPanel";
import { ScenarioPanel } from "@/components/app/ScenarioPanel";
import { SettingsFields } from "@/components/app/SettingsFields";
import { SignalHero } from "@/components/app/SignalHero";
import { TimeMachineBar } from "@/components/app/TimeMachineBar";
import { WhyPanel } from "@/components/app/WhyPanel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DEFAULT_SETTINGS, analyze } from "@/lib/analysis";
import {
  loadSettings,
  migrateLocalPredictions,
  savePrediction,
  saveSettings,
} from "@/lib/cloud-store";
import { fmtPrice, regimeLabel } from "@/lib/format";
import { M15_MS, frozenMarketProvider } from "@/lib/market/frozen-provider";
import { MIN_WARMUP_CANDLES } from "@/lib/market/provider";
import { newPredictionId } from "@/lib/storage";
import type { AiExplanation, AppSettings, Prediction } from "@/lib/types";


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

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [timeMachine, setTimeMachine] = useState(false);
  const [index, setIndex] = useState(maxIndex);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const aiRef = useRef<AiExplanation | null>(null);

  // Cloud is the source of truth; lift anything left in this browser once.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const moved = await migrateLocalPredictions();
        if (moved) toast.success(`ย้ายบันทึกเดิม ${moved} รายการขึ้น Cloud แล้ว`);
        const s = await loadSettings();
        if (alive) setSettings(s);
      } catch {
        /* offline or blocked — keep defaults, the app still analyses fine */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  async function handleSave() {
    setSaving(true);
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
      ai: aiRef.current,
    };
    try {
      await savePrediction(prediction);
      setSaved(prediction.id);
      toast.success("บันทึกคำพยากรณ์แล้ว", {
        description: "ล็อกไว้บน Cloud แก้ไม่ได้ ดูผลเทียบของจริงได้ที่แท็บบันทึกผล",
      });
    } catch {
      toast.error("บันทึกไม่สำเร็จ", { description: "ลองใหม่อีกครั้งเมื่อเชื่อมต่อได้" });
    } finally {
      setSaving(false);
    }
  }


  return (
    <AppShell>
      <div className="space-y-4">
        {/* 1. Final signal */}
        <SignalHero
          consensus={consensus}
          snapshot={snapshot}
          news={news}
          activeVotes={activeVotes}
          asOf={asOf}
        />

        {/* 2. Forecast chart — top priority */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="truncate font-semibold">ระบบคาด 5 แท่งถัดไป</h2>
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              {regimeLabel[snapshot.regime]}
            </span>
          </div>
          <div className="mt-2">
            <CandleChart
              history={snapshot.candles}
              forecast={forecast}
              support={snapshot.support}
              resistance={snapshot.resistance}
            />
          </div>

          <div className="mt-2 flex gap-2">
            <Button
              className="min-h-11 flex-1"
              onClick={() => void handleSave()}
              disabled={saved !== null || saving}
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4" aria-hidden /> บันทึกแล้ว
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4" aria-hidden />{" "}
                  {saving ? "กำลังบันทึก…" : "บันทึกคำพยากรณ์นี้"}
                </>
              )}
            </Button>
            <SettingsSheet
              settings={settings}
              onChange={(s) => {
                setSettings(s);
                void saveSettings(s);
                setSaved(null);
              }}
            />
          </div>

          {saved ? (
            <Link
              to="/history"
              className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary"
            >
              ไปดูรายการที่บันทึกไว้ →
            </Link>
          ) : null}
        </section>

        {/* 3. Why */}
        <WhyPanel consensus={consensus} ensemble={ensemble} activeVotes={activeVotes} />

        {/* 4. Model votes */}
        <section className="space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="truncate font-semibold">เสียงโหวตของ 5 โมเดล</h2>
            <span className="shrink-0 text-xs text-muted-foreground">แตะเพื่อดูเหตุผล</span>
          </div>
          {models.map((m, i) => (
            <ModelVoteCard key={m.id} model={m} index={i + 1} />
          ))}
        </section>

        {/* 5. Secondary detail, collapsed by default */}
        <Accordion type="single" collapsible className="space-y-2">
          <Item value="ensemble" title="ความเห็นหัวหน้าทีม (ไม่ใช่สัญญาณสุดท้าย)">
            <EnsemblePanel ensemble={ensemble} />
          </Item>
          <Item value="gate" title="เกณฑ์คุณภาพทั้ง 5 ข้อ">
            <GatePanel consensus={consensus} />
          </Item>
          <Item value="scenarios" title="ฉากทัศน์อนาคต 5 แบบ">
            <ScenarioPanel scenarios={scenarios} />
          </Item>
          <Item value="levels" title="ระดับราคาอ้างอิง (แนวรับ/แนวต้าน)">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Cell label="แนวรับ" value={fmtPrice(plan.support)} />
              <Cell label="แนวต้าน" value={fmtPrice(plan.resistance)} />
              <Cell label="จุดที่ถือว่าคิดผิด" value={fmtPrice(plan.invalidation)} />
              <Cell label="ATR (14)" value={fmtPrice(plan.atr)} />
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              ใช้ประกอบการอ่านกราฟเท่านั้น ไม่ใช่คำสั่งซื้อขาย และไม่มีการแนะนำขนาดสัญญา
            </p>
          </Item>
          <Item value="reason" title="สรุปเป็นภาษาคน">
            <p className="text-sm">{narrative.whatsHappening}</p>
            <h3 className="mt-3 text-xs font-semibold text-muted-foreground">ทำไมจึงสรุปแบบนี้</h3>
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
            <h3 className="mt-3 text-xs font-semibold text-muted-foreground">
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
          </Item>
          <Item value="news" title="ข่าว & ปฏิทินเศรษฐกิจ">
            <NewsPanel news={news} />
          </Item>
        </Accordion>

        {/* 6. Time machine */}
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

        <Disclaimer />
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
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11"
          aria-label="ตั้งค่าเกณฑ์คุณภาพ"
        >
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
        <div className="px-4 pb-6">
          <SettingsFields settings={settings} onChange={onChange} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

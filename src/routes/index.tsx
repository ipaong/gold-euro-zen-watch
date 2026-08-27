import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Check, RefreshCw, Sliders } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AiAnalystPanel } from "@/components/app/AiAnalystPanel";
import { AlertPanel } from "@/components/app/AlertPanel";
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
import { getGoldApiMarketFeed, type MarketFeedResult } from "@/lib/market.functions";
import { getAuthSession } from "@/lib/auth";
import { DEMO_MODE_STORAGE_KEY, resolveHomeAccess } from "@/lib/home-access";
import { buildAlerts } from "@/lib/alerts";
import {
  loadSettings,
  migrateLocalPredictions,
  savePrediction,
  saveSettings,
} from "@/lib/cloud-store";
import { fmtPrice, regimeLabel } from "@/lib/format";
import { getNewsSnapshot } from "@/lib/news.functions";
import { createFeedMarketProvider } from "@/lib/market/feed-provider";
import { frozenMarketProvider } from "@/lib/market/frozen-provider";
import { M15_MS, MIN_WARMUP_CANDLES } from "@/lib/market/provider";
import { newPredictionId } from "@/lib/storage";
import type { AiExplanation, AppSettings, Direction, Prediction } from "@/lib/types";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) =>
    search["demo"] === true || search["demo"] === "true" ? { demo: true } : {},
  beforeLoad: async ({ search }) => {
    // Supabase browser storage is not available during SSR. The client-side
    // guard runs before the route renders in the browser instead.
    if (typeof window === "undefined") return;

    let session = null;
    try {
      session = await getAuthSession();
    } catch {
      throw redirect({ to: "/login" });
    }

    const demoStored = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "1";
    const access = resolveHomeAccess({
      session,
      demoRequested: search.demo === true,
      demoStored,
    });

    if (access === "login") {
      throw redirect({ to: "/login" });
    }

    if (access === "demo") {
      window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
    }
  },
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
  component: HomeGate,
});

function HomeGate() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [access, setAccess] = useState<"checking" | "allowed">("checking");

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const session = await getAuthSession();
        const demoStored = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "1";
        const homeAccess = resolveHomeAccess({
          session,
          demoRequested: search.demo === true,
          demoStored,
        });

        if (homeAccess === "login") {
          await navigate({ to: "/login", replace: true });
          return;
        }

        if (homeAccess === "demo") {
          window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
        }

        if (alive) setAccess("allowed");
      } catch {
        await navigate({ to: "/login", replace: true });
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate, search.demo]);

  if (access === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground" role="status">
          กำลังตรวจสอบการเข้าสู่ระบบ…
        </p>
      </div>
    );
  }

  return <LabPage />;
}

const GOLD_API_REFRESH_MS = 60 * 1000;

function LabPage() {
  const marketQuery = useQuery({
    queryKey: ["gold-api-market-feed"],
    queryFn: () => getGoldApiMarketFeed({ data: { requestedAt: Date.now() } }),
    retry: false,
    staleTime: 45 * 1000,
    refetchInterval: GOLD_API_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const liveFeed = marketQuery.data?.feed ?? null;
  const liveProvider = useMemo(
    () => (liveFeed ? createFeedMarketProvider(liveFeed) : null),
    [liveFeed],
  );
  const activeProvider = liveProvider ?? frozenMarketProvider;
  const usingLive = liveProvider !== null;
  const earliest = activeProvider.getEarliestTime();
  const latest = activeProvider.getLatestTime();
  const firstAnalyzable = earliest + (MIN_WARMUP_CANDLES - 1) * M15_MS;
  const maxIndex = Math.max(0, Math.round((latest - firstAnalyzable) / M15_MS));

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [timeMachine, setTimeMachine] = useState(false);
  const [index, setIndex] = useState(maxIndex);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showFirstRun, setShowFirstRun] = useState(false);
  const [previousDirection, setPreviousDirection] = useState<Direction | undefined>();
  const aiRef = useRef<AiExplanation | null>(null);
  const lastDirectionRef = useRef<Direction | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShowFirstRun(window.localStorage.getItem("xaueur-lab:first-run-dismissed:v1") !== "1");
    }
  }, []);

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

  // Real news + macro, fetched on the server and cached per 10-minute bucket.
  const fetchNews = useServerFn(getNewsSnapshot);
  const newsQuery = useQuery({
    queryKey: ["live-news", Math.floor(asOf / (10 * 60 * 1000))],
    queryFn: () => fetchNews({ data: { asOf } }),
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const liveNews = newsQuery.data ?? null;

  const result = useMemo(() => {
    try {
      return analyze(asOf, settings, liveNews, activeProvider);
    } catch {
      return null;
    }
  }, [activeProvider, asOf, settings, liveNews]);

  useEffect(() => {
    if (!result) return;
    const current = result.consensus.direction;
    const previous = lastDirectionRef.current;
    if (previous !== null && previous !== current) setPreviousDirection(previous);
    lastDirectionRef.current = current;
  }, [result]);

  if (!result) {
    return (
      <AppShell live={usingLive}>
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
  const settlementReady =
    !usingLive &&
    saved !== null &&
    activeProvider.getCandlesAfter(asOf, settings.horizon).length >= settings.horizon;
  const alerts = buildAlerts({
    ...(previousDirection ? { previousDirection } : {}),
    consensus,
    news,
    forecastLocked: saved !== null,
    settlementReady,
    now: Date.now(),
    newsAvoidMinutes: settings.newsAvoidMinutes,
  });

  async function handleRefreshMarketData() {
    const refreshResult = await marketQuery.refetch();
    if (refreshResult.error) {
      const message =
        refreshResult.error instanceof Error ? refreshResult.error.message : "ไม่สามารถดึงข้อมูลตลาดได้";
      toast.error("ดึงข้อมูลไม่สำเร็จ", { description: message });
      return;
    }

    const feed = refreshResult.data?.feed;
    if (feed) {
      toast.success("ดึงข้อมูลตลาดล่าสุดแล้ว", {
        description: `ได้รับข้อมูล ${feed.candles.length} แท่งจาก Gold API ผ่าน Supabase`,
      });
      return;
    }

    const reason =
      refreshResult.data?.health.error ??
      refreshResult.data?.fallbackReason ??
      "Gold API ยังไม่มีข้อมูล live ใน Supabase";
    toast.error("ยังดึงข้อมูล live ไม่ได้", { description: reason });
  }

  async function handleSave() {
    setSaving(true);
    const prediction: Prediction = {
      id: newPredictionId(asOf),
      asOf,
      createdAt: Date.now(),
      mode: timeMachine ? "time_machine" : "live",
      demo: !usingLive,
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
      newsSnapshot: news,
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
    <AppShell live={usingLive}>
      <div className="space-y-4">
        <MarketDataStatus
          result={marketQuery.data}
          loading={marketQuery.isLoading}
          usingLive={usingLive}
          queryError={marketQuery.error}
        />

        {showFirstRun ? (
          <FirstRunNotice
            onStart={() => {
              window.localStorage.setItem("xaueur-lab:first-run-dismissed:v1", "1");
              setShowFirstRun(false);
            }}
          />
        ) : null}

        {/* 1. Final signal */}
        <SignalHero
          consensus={consensus}
          snapshot={snapshot}
          news={news}
          activeVotes={activeVotes}
          asOf={asOf}
        />

        <AlertPanel alerts={alerts} />

        {/* 2. Forecast chart — top priority */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="truncate font-semibold">ระบบคาด 5 แท่งถัดไป</h2>
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              {regimeLabel[snapshot.regime]}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">อ่านข้อมูล Gold API ล่าสุดจาก Supabase</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={() => void handleRefreshMarketData()}
              disabled={marketQuery.isFetching}
              aria-label="อ่านข้อมูลตลาด Gold API จาก Supabase ตอนนี้"
            >
              <RefreshCw className={marketQuery.isFetching ? "animate-spin" : undefined} aria-hidden />
              {marketQuery.isFetching ? "กำลังดึงข้อมูล…" : "ดึงข้อมูลตอนนี้"}
            </Button>
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

        {/* 3b. AI analyst — explains the engine output, never overrides it */}
        <AiAnalystPanel
          result={result}
          cacheKey={`${asOf}-${settings.confidenceThreshold}-${settings.minAgreement}-${settings.newsAvoidMinutes}-${settings.horizon}`}
          onReady={(e) => {
            aiRef.current = e;
          }}
        />

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
            <NewsPanel news={news} loading={newsQuery.isLoading} />
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

        <Disclaimer live={usingLive} />
      </div>
    </AppShell>
  );
}

function MarketDataStatus({
  result,
  loading,
  usingLive,
  queryError,
}: {
  result: MarketFeedResult | undefined;
  loading: boolean;
  usingLive: boolean;
  queryError: unknown;
}) {
  const warnings = result?.validation?.warnings ?? [];
  const queryErrorMessage = queryError instanceof Error ? queryError.message : undefined;
  const warming = result?.health.status === "empty" && result.candleCount < result.requiredCandles;
  const error = result?.health.error ?? (warming ? queryErrorMessage : result?.fallbackReason) ?? queryErrorMessage;
  const label = loading && !result ? "กำลังอ่านข้อมูล…" : usingLive ? "LIVE · Gold API · read-only" : "DEMO fallback";
  const latestSourceTimestamp =
    result && result.health.fetchedAt > 0 ? new Date(result.health.fetchedAt).toISOString() : null;

  return (
    <section
      className="rounded-xl border border-border bg-card px-3 py-2.5"
      aria-live="polite"
      aria-label="สถานะแหล่งข้อมูลราคา"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">แหล่งข้อมูลราคา</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            usingLive ? "bg-bull-soft text-bull" : "bg-accent text-accent-foreground"
          }`}
        >
          {label}
        </span>
        {loading && result ? (
          <span className="text-[11px] text-muted-foreground">กำลังตรวจข้อมูลรอบใหม่…</span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {usingLive
          ? "XAUEUR · 15 นาที · แท่งที่ปิดแล้ว · source timestamp UTC จาก Gold API"
          : warming
            ? `${result.fallbackReason ?? `กำลังสะสมข้อมูลจริง ${result.candleCount}/${result.requiredCandles} แท่ง`} · ระหว่างนี้ใช้ชุดข้อมูลเดโมที่ตรึงไว้`
            : "ยังใช้ชุดข้อมูลเดโมที่ตรึงไว้ เพราะข้อมูล Gold API ยังไม่พร้อม, ค้าง หรือไม่ผ่าน validation"}
      </p>
      {latestSourceTimestamp ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          ตัวอย่างล่าสุดจาก source: {latestSourceTimestamp} UTC
        </p>
      ) : null}
      {error && !warming ? (
        <p className="mt-1 rounded-lg bg-wait-soft p-2 text-[11px] text-muted-foreground">
          เหตุผลที่ใช้ fallback: {error}
        </p>
      ) : null}
      {warnings.length ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          คำเตือนข้อมูล: {warnings.slice(0, 2).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}

function FirstRunNotice({ onStart }: { onStart: () => void }) {
  return (
    <section
      className="rounded-xl border border-gold/40 bg-accent p-4"
      aria-labelledby="first-run-title"
    >
      <h1 id="first-run-title" className="font-semibold">
        ยินดีต้อนรับสู่ XAUEUR Signal Lab
      </h1>
      <p className="mt-2 text-sm leading-relaxed">
        ระบบมอง XAUEUR จาก 5 มุมมองและคาดการณ์ 5 แท่ง M15 ถัดไป เพื่อการเรียนรู้เท่านั้น
        แอปไม่ส่งคำสั่งซื้อขาย และคุณยังเป็นผู้ตัดสินใจทุกอย่างด้วยตนเอง
      </p>
      <Button className="mt-3 min-h-11" onClick={onStart}>
        เริ่ม Demo
      </Button>
    </section>
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
        <Button variant="outline" size="icon" className="h-11 w-11" aria-label="ตั้งค่าเกณฑ์คุณภาพ">
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

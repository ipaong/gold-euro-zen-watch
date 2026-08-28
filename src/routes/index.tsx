import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Check, Eye, EyeOff, RefreshCw, Sliders, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { evaluateSettlement, type SettlementEvaluation } from "@/lib/settlement";

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
import { SafeBufferCard } from "@/components/app/SafeBufferCard";
import { SignalHero } from "@/components/app/SignalHero";
import { TimeMachineBar } from "@/components/app/TimeMachineBar";
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
import { getYahooMarketFeed, getXmMarketFeed, type MarketFeedResult } from "@/lib/market.functions";
import { ACTIVE_MARKET_ASSETS, getMarketAsset, type MarketAssetId } from "@/lib/market/assets";
import { getAuthSession } from "@/lib/auth";
import {
  DEMO_MODE_STORAGE_KEY,
  resolveHomeAccess,
  shouldKeepDemoOnAuthFailure,
} from "@/lib/home-access";
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
import { frozenYahooGoldProvider } from "@/lib/market/yahoo-frozen-provider";
import { loadMarketMode, MARKET_MODE_COPY, saveMarketMode } from "@/lib/market/mode";
import { MIN_WARMUP_CANDLES } from "@/lib/market/provider";
import { newPredictionId } from "@/lib/storage";
import { createLatestSaveQueue, type SaveQueueStatus } from "@/lib/save-queue";
import type {
  AiExplanation,
  AnalysisResult,
  AppSettings,
  Direction,
  MarketMode,
  Prediction,
} from "@/lib/types";

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
      const demoStored = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "1";
      if (
        shouldKeepDemoOnAuthFailure({
          demoRequested: search.demo === true,
          demoStored,
        })
      ) {
        window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
        return;
      }
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
      { title: "Market Prediction Playground — Gold Futures 15m" },
      {
        name: "description",
        content:
          "ห้องทดลองพยากรณ์ Gold Futures ราย 15 นาทีด้วย 5 โมเดลโหวต ฉากทัศน์อนาคต 5 แบบ และเกณฑ์คุณภาพที่ตัดสินสัญญาณสุดท้าย พร้อมโหมดย้อนเวลาแบบไม่แอบดูอนาคต",
      },
      { property: "og:title", content: "Market Prediction Playground — Gold Futures" },
      {
        property: "og:description",
        content:
          "5 โมเดลโหวต + ฉากทัศน์ 5 แบบ + เกณฑ์คุณภาพ บนข้อมูล Yahoo Gold Futures แบบ delayed หรือชุดเดโมที่ตรึงไว้",
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
        const demoStored = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "1";
        if (
          shouldKeepDemoOnAuthFailure({
            demoRequested: search.demo === true,
            demoStored,
          })
        ) {
          window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
          if (alive) setAccess("allowed");
          return;
        }
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

const YAHOO_REFRESH_MS = 60 * 1000;

function LabPage() {
  const [marketMode, setMarketMode] = useState<MarketMode>("cloud");
  const [selectedAssetId, setSelectedAssetId] = useState<MarketAssetId>("gold");
  const [selectedTimeframe, setSelectedTimeframe] = useState<"1m" | "5m" | "15m" | "1h" | "1d">(
    "15m",
  );

  const marketQuery = useQuery({
    queryKey: ["market-feed", marketMode, selectedAssetId, selectedTimeframe],
    queryFn: () => {
      if (marketMode === "xm") {
        return getXmMarketFeed({ data: {} });
      }
      return getYahooMarketFeed({
        data: { assetId: selectedAssetId, timeframe: selectedTimeframe, requestedAt: Date.now() },
      });
    },
    retry: false,
    staleTime: 45 * 1000,
    refetchInterval: YAHOO_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const liveFeed = marketQuery.data?.feed ?? null;
  const liveProvider = useMemo(
    () => (liveFeed ? createFeedMarketProvider(liveFeed) : null),
    [liveFeed],
  );
  const activeProvider =
    marketMode === "xm" ? liveProvider : (liveProvider ?? frozenYahooGoldProvider);
  const analysisProvider = activeProvider ?? frozenYahooGoldProvider;
  const usingLive = liveProvider !== null;
  const earliest = analysisProvider.getEarliestTime();
  const latest = analysisProvider.getLatestTime();
  const intervalMs = analysisProvider.intervalMs;
  const firstAnalyzable = earliest + (MIN_WARMUP_CANDLES - 1) * intervalMs;
  const maxIndex = Math.max(0, Math.round((latest - firstAnalyzable) / intervalMs));

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [timeMachine, setTimeMachine] = useState(false);
  const [timeMachineIndex, setTimeMachineIndex] = useState(maxIndex);
  const [committedTimeMachineIndex, setCommittedTimeMachineIndex] = useState(maxIndex);
  const [timeMachineDataFetched, setTimeMachineDataFetched] = useState(true);
  const [timeMachinePredicted, setTimeMachinePredicted] = useState(false);
  const [revealedEvaluation, setRevealedEvaluation] = useState<SettlementEvaluation | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previousDirection, setPreviousDirection] = useState<Direction | undefined>();
  const aiRef = useRef<AiExplanation | null>(null);
  const lastDirectionRef = useRef<Direction | null>(null);
  const settingsSaveQueueRef = useRef<ReturnType<typeof createLatestSaveQueue<AppSettings>> | null>(
    null,
  );

  if (!settingsSaveQueueRef.current) {
    settingsSaveQueueRef.current = createLatestSaveQueue(
      saveSettings,
      (status: SaveQueueStatus) => {
        if (status === "error") {
          toast.error("บันทึกค่าไป Cloud ไม่สำเร็จ", {
            description: "ค่าบนหน้าจออาจยังไม่ถูกเก็บถาวร กรุณาลองอีกครั้งเมื่อ session พร้อม",
          });
        }
      },
    );
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      setMarketMode(loadMarketMode(window.localStorage));
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

  const pendingTimeMachineAsOf = firstAnalyzable + timeMachineIndex * intervalMs;
  const committedTimeMachineAsOf = firstAnalyzable + committedTimeMachineIndex * intervalMs;
  const asOf = timeMachine ? committedTimeMachineAsOf : latest;

  // Real news + macro, fetched on the server and cached for this exact asOf.
  const fetchNews = useServerFn(getNewsSnapshot);
  const newsQuery = useQuery({
    queryKey: ["live-news", asOf],
    queryFn: () => fetchNews({ data: { asOf } }),
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const liveNews = newsQuery.data ?? null;

  const result = useMemo(() => {
    if (!activeProvider) return null;
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

  async function handleTimeMachineFetchData() {
    setCommittedTimeMachineIndex(timeMachineIndex);
    setTimeMachineDataFetched(true);
    setTimeMachinePredicted(false);
    setRevealedEvaluation(null);
    setSaved(null);
    await newsQuery.refetch();
    toast.success("ดึงกราฟและข่าว ณ เวลานี้เรียบร้อยแล้ว");
  }

  function handleTimeMachinePredict() {
    setTimeMachinePredicted(true);
    toast.success("ประมวลผลการทำนาย 5 แท่งเรียบร้อยแล้ว");
  }

  function handlePendingIndexChange(index: number) {
    setTimeMachineIndex(index);
    if (revealedEvaluation) {
      setRevealedEvaluation(null);
    }
  }

  function handleMarketModeChange(next: MarketMode) {
    setMarketMode(next);
    saveMarketMode(window.localStorage, next);
    setTimeMachine(false);
    setTimeMachinePredicted(false);
    setSaved(null);
    setRevealedEvaluation(null);
  }

  if (!result) {
    return (
      <AppShell
        live={usingLive}
        marketMode={marketMode}
        marketLabel="Gold Futures (GC=F) · 15m"
        marketSubline="ระบบพยากรณ์ราคาทองคำ"
      >
        <ZenMarketBar
          assetId={selectedAssetId}
          timeframe={selectedTimeframe}
          result={marketQuery.data}
          usingLive={usingLive}
          onRefresh={() => void handleRefreshMarketData()}
          isRefreshing={marketQuery.isFetching}
        />
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="font-semibold">
            {marketMode === "xm"
              ? marketQuery.isLoading
                ? "กำลังเชื่อมต่อ XM Live"
                : "XM Live ยังไม่พร้อม"
              : "ข้อมูลไม่พอสำหรับการวิเคราะห์"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {marketMode === "xm"
              ? "เปิด MT5 ให้เห็น GOLD และรัน bridge บน PC ก่อน ระบบจะไม่ใช้ GC=F แทนให้อัตโนมัติ"
              : `ต้องมีแท่งย้อนหลังอย่างน้อย ${MIN_WARMUP_CANDLES} แท่ง เพื่อคำนวณ EMA200 ให้เชื่อถือได้ ลองเลื่อนเวลาไปข้างหน้า`}
          </p>
          {marketMode === "xm" ? (
            <Button className="mt-4 min-h-11" onClick={() => handleMarketModeChange("cloud")}>
              ใช้ Cloud Mode แทน
            </Button>
          ) : null}
        </div>
        <Disclaimer live={usingLive} marketMode={marketMode} />
      </AppShell>
    );
  }

  const { snapshot, news, models, ensemble, scenarios, forecast, consensus, plan, narrative } =
    result;

  const activeVotes = models.filter((m) => !m.unavailable).length;
  const settlementReady =
    !usingLive &&
    marketMode === "cloud" &&
    saved !== null &&
    analysisProvider.getCandlesAfter(asOf, settings.horizon).length >= settings.horizon;
  const alerts = buildAlerts({
    ...(previousDirection ? { previousDirection } : {}),
    consensus,
    news,
    forecastLocked: saved !== null,
    settlementReady,
    now: Date.now(),
    newsAvoidMinutes: settings.newsAvoidMinutes,
  });

  // Fetch all available actual candles after asOf (up to 120 candles) so users can see the whole trend to present
  const availableActuals = analysisProvider.getCandlesAfter(asOf, 120);
  const canReveal = availableActuals.length >= settings.horizon;

  const revealedActuals =
    revealedEvaluation && availableActuals.length >= settings.horizon
      ? availableActuals
      : (revealedEvaluation?.actual ?? null);

  function handleRevealActual() {
    if (revealedEvaluation) {
      setRevealedEvaluation(null);
      return;
    }
    if (!canReveal) {
      toast.info("ยังไม่ครบแท่งจริงสำหรับช่วงเวลาที่คาดการณ์", {
        description: `มีแท่งจริงแล้ว ${availableActuals.length}/${settings.horizon} แท่งหลังเวลานี้`,
      });
      return;
    }
    const tempPred: Prediction = {
      id: "inline-preview",
      asOf,
      createdAt: Date.now(),
      mode: timeMachine ? "time_machine" : "live",
      marketMode,
      demo: !usingLive,
      symbol: analysisProvider.symbol,
      timeframe: analysisProvider.timeframe,
      provider: analysisProvider.id,
      providerSymbol: analysisProvider.providerSymbol,
      dataStatus: analysisProvider.sourceType,
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
    };
    const evaluation = evaluateSettlement(tempPred, analysisProvider);
    if (evaluation.status === "ready") {
      setRevealedEvaluation(evaluation);
      toast.success(
        evaluation.score?.directionCorrect === null
          ? "เปิดเฉลยแล้ว (สัญญาณเป็น “รอ” จึงไม่นับแพ้ชนะทิศทาง)"
          : evaluation.score?.directionCorrect
            ? "เปิดเฉลยแล้ว — ทายทิศทางถูก ✓"
            : "เปิดเฉลยแล้ว — ทายทิศทางผิด ✗",
      );
    } else {
      toast.error("ไม่สามารถเปิดเฉลยได้", {
        description: `มีแท่งจริง ${evaluation.available}/${evaluation.required} แท่ง`,
      });
    }
  }

  async function handleRefreshMarketData() {
    setRevealedEvaluation(null);
    const refreshResult = await marketQuery.refetch();
    if (refreshResult.error) {
      const rawMessage =
        refreshResult.error instanceof Error
          ? refreshResult.error.message
          : "ไม่สามารถดึงข้อมูลตลาดได้";
      const isSupabaseMissing = rawMessage.includes("Missing Supabase environment variable");
      if (isSupabaseMissing) {
        toast.info("โหมดเดโม (Snapshot)", {
          description:
            "บนเครื่องทดสอบไม่มีกุญแจ Supabase ระบบจึงใช้ข้อมูลตัวอย่าง (เมื่อ deploy ขึ้น Cloud จะต่อสดอัตโนมัติ)",
        });
      } else {
        toast.error("ดึงข้อมูลไม่สำเร็จ", { description: rawMessage });
      }
      return;
    }

    const feed = refreshResult.data?.feed;
    if (feed) {
      toast.success("ดึงข้อมูลตลาดล่าสุดแล้ว", {
        description:
          marketMode === "xm"
            ? `ได้รับข้อมูล ${feed.candles.length} แท่งจาก XM MT5 bridge`
            : `ได้รับข้อมูล ${feed.candles.length} แท่งจาก Yahoo Chart แบบ server-side`,
      });
      return;
    }

    const rawReason =
      refreshResult.data?.health.error ??
      refreshResult.data?.fallbackReason ??
      (marketMode === "xm"
        ? "ยังไม่มีข้อมูล GOLD จาก MT5 bridge"
        : "Yahoo ยังไม่มีข้อมูล delayed ที่ผ่าน validation");
    const isSupabaseMissing = rawReason.includes("Missing Supabase environment variable");
    if (isSupabaseMissing) {
      toast.info("โหมดเดโม (Snapshot)", {
        description:
          "บนเครื่องทดสอบไม่มีกุญแจ Supabase ระบบจึงใช้ข้อมูลตัวอย่าง (เมื่อ deploy ขึ้น Cloud จะต่อสดอัตโนมัติ)",
      });
    } else {
      toast.error(marketMode === "xm" ? "XM bridge ยังไม่พร้อม" : "ยังดึงข้อมูล live ไม่ได้", {
        description: rawReason,
      });
    }
  }

  async function handleSave() {
    setSaving(true);
    const prediction: Prediction = {
      id: newPredictionId(asOf),
      asOf,
      createdAt: Date.now(),
      mode: timeMachine ? "time_machine" : "live",
      marketMode,
      demo: !usingLive,
      symbol: analysisProvider.symbol,
      timeframe: analysisProvider.timeframe,
      provider: analysisProvider.id,
      providerSymbol: analysisProvider.providerSymbol,
      dataStatus: analysisProvider.sourceType,
      horizon: settings.horizon,
      price: snapshot.price,
      models,
      ensemble,
      consensus,
      scenarios,
      forecast,
      plan,
      marketCandles: analysisProvider.getCandlesUpTo(asOf, 40),
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
    <AppShell
      live={usingLive}
      marketMode={marketMode}
      marketLabel="Gold Futures (GC=F) · 15m"
      marketSubline="ระบบพยากรณ์ราคาทองคำ"
    >
      <div className="space-y-4">
        <ZenMarketBar
          assetId={selectedAssetId}
          timeframe={selectedTimeframe}
          result={marketQuery.data}
          usingLive={usingLive}
          onRefresh={() => void handleRefreshMarketData()}
          isRefreshing={marketQuery.isFetching}
        />

        <TimeMachineBar
          enabled={timeMachine}
          onToggle={(v) => {
            setTimeMachine(v);
            if (v) {
              const defaultIndex = Math.max(0, maxIndex - settings.horizon);
              setTimeMachineIndex(defaultIndex);
              setCommittedTimeMachineIndex(defaultIndex);
              setTimeMachineDataFetched(true);
              setTimeMachinePredicted(false);
            }
            setSaved(null);
            setRevealedEvaluation(null);
          }}
          pendingIndex={timeMachineIndex}
          maxIndex={maxIndex}
          pendingAsOf={pendingTimeMachineAsOf}
          committedAsOf={committedTimeMachineAsOf}
          onPendingIndexChange={handlePendingIndexChange}
          onFetchData={() => void handleTimeMachineFetchData()}
          isFetchingData={newsQuery.isFetching}
          dataFetched={timeMachineDataFetched}
          onPredict={handleTimeMachinePredict}
          isPredicted={timeMachinePredicted}
          candleCount={snapshot.candles.length}
          newsCount={news.headlines.length}
          usingLive={usingLive}
        />

        {/* 1. Final signal */}
        {timeMachine && !timeMachinePredicted ? (
          <section className="rounded-xl border border-gold/30 bg-accent/20 p-5 text-center shadow-xs">
            <h2 className="font-semibold text-sm">ข้อมูลกราฟและข่าวย้อนหลังพร้อมแล้ว</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {timeMachineDataFetched
                ? "กดปุ่มเริ่มทำนายเพื่อวิเคราะห์ 5 แท่งถัดไป (15m)"
                : "กดปุ่ม “2. ดึงกราฟ + ข่าว” ด้านบน เพื่อเตรียมข้อมูลสำหรับเวลานี้"}
            </p>
            {timeMachineDataFetched ? (
              <Button
                size="lg"
                className="mt-3 min-h-11 w-full bg-primary text-primary-foreground font-semibold shadow-sm"
                onClick={handleTimeMachinePredict}
              >
                <Sparkles className="h-4 w-4 mr-2 text-gold" />
                เริ่มทำนาย 5 แท่งถัดไป
              </Button>
            ) : null}
          </section>
        ) : (
          <SignalHero
            consensus={consensus}
            snapshot={snapshot}
            news={news}
            activeVotes={activeVotes}
            asOf={asOf}
          />
        )}

        <AlertPanel alerts={alerts} />

        {/* 2. Forecast chart — top priority */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="truncate font-semibold">ระบบคาด 5 แท่งถัดไป</h2>
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              {regimeLabel[snapshot.regime]}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {usingLive
              ? "ราคาสด Gold Futures (GC=F) จาก Yahoo (Delayed 15m)"
              : "ข้อมูลจำลอง Gold Futures (GC=F) สำหรับทดสอบ"}
          </p>

          <div className="mt-2">
            <CandleChart
              history={snapshot.candles}
              forecast={timeMachine && !timeMachinePredicted ? [] : forecast}
              actual={revealedActuals}
              support={timeMachine && !timeMachinePredicted ? undefined : snapshot.support}
              resistance={timeMachine && !timeMachinePredicted ? undefined : snapshot.resistance}
              symbol={analysisProvider.symbol}
              timeframe={analysisProvider.timeframe}
              asOf={asOf}
              isTimeMachine={timeMachine}
              forecastMuted={consensus.direction === "WAIT"}
            />
          </div>

          {/* Inline Reveal button if in Time Machine or candles exist after asOf */}
          {timeMachine || availableActuals.length > 0 ? (
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 w-full text-xs"
                onClick={handleRevealActual}
                disabled={
                  (!canReveal && !revealedEvaluation) || (timeMachine && !timeMachinePredicted)
                }
              >
                {revealedEvaluation ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-1.5" aria-hidden />
                    ซ่อนเฉลยแท่งจริง ({revealedActuals?.length ?? 5} แท่ง)
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-1.5 text-gold" aria-hidden />
                    {timeMachine && !timeMachinePredicted
                      ? "กดทำนายก่อน จึงจะเปิดเฉลยได้"
                      : canReveal
                        ? availableActuals.length > 5
                          ? `เปิดเฉลยแท่งจริงทั้งหมด (${availableActuals.length} แท่งถึงปัจจุบัน)`
                          : "เปิดเฉลย 5 แท่งจริง (เปรียบเทียบผลลัพธ์)"
                        : `แท่งจริงหลังเวลานี้ยังไม่ครบ 5 แท่ง (${availableActuals.length}/${settings.horizon})`}
                  </>
                )}
              </Button>
            </div>
          ) : null}

          {/* Inline Settlement Summary Card */}
          {revealedEvaluation?.score ? (
            <div className="mt-2.5 space-y-2 rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>ผลการเปรียบเทียบกับแท่งจริง</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    revealedEvaluation.score.directionCorrect === null
                      ? "bg-wait-soft text-muted-foreground"
                      : revealedEvaluation.score.directionCorrect
                        ? "bg-bull-soft text-bull"
                        : "bg-bear-soft text-bear"
                  }`}
                >
                  {revealedEvaluation.score.directionCorrect === null
                    ? "สัญญาณเป็น “รอ”"
                    : revealedEvaluation.score.directionCorrect
                      ? "ทายทิศถูก ✓"
                      : "ทายทิศผิด ✗"}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg bg-muted p-2">
                  <dt className="text-muted-foreground">ทิศทางจริง</dt>
                  <dd className="font-semibold">
                    {revealedEvaluation.score.actualDirection === "BUY"
                      ? "ขึ้น (BUY)"
                      : revealedEvaluation.score.actualDirection === "SELL"
                        ? "ลง (SELL)"
                        : "ออกข้าง (WAIT)"}
                  </dd>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <dt className="text-muted-foreground">คลาดเคลื่อนเฉลี่ย (MAE)</dt>
                  <dd className="font-semibold">{fmtPrice(revealedEvaluation.score.mae)}</dd>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <dt className="text-muted-foreground">ทายทิศรายแท่ง</dt>
                  <dd className="font-semibold">
                    {revealedEvaluation.score.candleDirHits}/
                    {revealedEvaluation.score.candleDirTotal} แท่ง
                  </dd>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <dt className="text-muted-foreground">เคลื่อนที่ตามสัญญาณ</dt>
                  <dd className="font-semibold">
                    {fmtPrice(revealedEvaluation.score.hypotheticalMove)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

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
                settingsSaveQueueRef.current?.enqueue(s);
                setSaved(null);
                setRevealedEvaluation(null);
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

        {/* 3. ระดับราคาอ้างอิง & เครื่องคำนวณเงินกันพอร์ตแตก */}
        {!timeMachine || timeMachinePredicted ? (
          <SafeBufferCard plan={plan} currentPrice={snapshot.price} />
        ) : null}

        {/* 4. สรุปโดย AI Analyst */}
        {!timeMachine || timeMachinePredicted ? (
          <AiAnalystPanel
            result={result}
            cacheKey={`${asOf}-${settings.confidenceThreshold}-${settings.minAgreement}-${settings.newsAvoidMinutes}-${settings.horizon}`}
            onReady={(e) => {
              aiRef.current = e;
            }}
          />
        ) : null}

        {/* 5. รายละเอียดเชิงลึก ซ่อนไว้ใน Sheet Drawer (Zen Design) */}
        <DeepAnalysisSheet result={result} newsLoading={newsQuery.isLoading} />

        <Disclaimer live={usingLive} marketMode={marketMode} />
      </div>
    </AppShell>
  );
}

function ZenMarketBar({
  assetId,
  timeframe,
  result,
  usingLive,
  onRefresh,
  isRefreshing,
}: {
  assetId: MarketAssetId;
  timeframe: string;
  result: MarketFeedResult | undefined;
  usingLive: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const asset = getMarketAsset(assetId);
  const candleCountDisplay = result && result.candleCount > 0 ? `${result.candleCount} แท่ง` : null;

  return (
    <section
      className="rounded-xl border border-border bg-card p-3 shadow-xs"
      aria-label="ข้อมูลตลาด"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-gold" aria-hidden />
          <span className="font-semibold text-sm">{asset.displayName}</span>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {timeframe}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              usingLive ? "bg-bull-soft text-bull" : "bg-accent text-accent-foreground"
            }`}
          >
            {usingLive ? "ราคาสด Yahoo" : "โหมดเดโม"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {candleCountDisplay ? (
            <span className="text-xs text-muted-foreground">{candleCountDisplay}</span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "กำลังดึง…" : "ดึงข้อมูล"}</span>
          </Button>
        </div>
      </div>

      <details className="mt-2 pt-2 border-t border-border/50">
        <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
          รายละเอียดข้อมูลตลาด
        </summary>
        <div className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            • สัญญาซื้อขายล่วงหน้าทองคำ COMEX Gold Futures (GC=F) จาก Yahoo Finance (Delayed 15
            นาที)
          </p>
          {!usingLive ? (
            <p className="text-wait">
              • ปัจจุบันใช้ข้อมูลจำลอง (Demo Snapshot) สำหรับทดลองใช้งานและทดสอบระบบพยากรณ์
            </p>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function DeepAnalysisSheet({
  result,
  newsLoading,
}: {
  result: AnalysisResult;
  newsLoading: boolean;
}) {
  const { models, consensus, ensemble, scenarios, narrative, news } = result;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="min-h-12 w-full justify-between rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-gold" />
            ดูเสียงโหวต 5 โมเดล & เกณฑ์คุณภาพ
          </span>
          <span className="text-xs text-muted-foreground">แตะเพื่อเปิดดู →</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto px-4 pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle>รายละเอียดการวิเคราะห์เชิงลึก</SheetTitle>
          <SheetDescription>
            เสียงโหวตแยกตามโมเดล, เกณฑ์คุณภาพ 5 ข้อ, และฉากทัศน์ทางเทคนิค
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* เสียงโหวต 5 โมเดล */}
          <section className="space-y-2">
            <h3 className="font-semibold text-sm">เสียงโหวตของ 5 โมเดล</h3>
            {models.map((m, i) => (
              <ModelVoteCard key={m.id} model={m} index={i + 1} />
            ))}
          </section>

          {/* เกณฑ์คุณภาพ 5 ข้อ */}
          <section className="space-y-2 pt-4 border-t border-border">
            <h3 className="font-semibold text-sm">เกณฑ์คุณภาพทั้ง 5 ข้อ</h3>
            <GatePanel consensus={consensus} />
          </section>

          {/* ความเห็นหัวหน้าทีม */}
          <section className="space-y-2 pt-4 border-t border-border">
            <h3 className="font-semibold text-sm">ความเห็นหัวหน้าทีม (Ensemble)</h3>
            <EnsemblePanel ensemble={ensemble} />
          </section>

          {/* ฉากทัศน์อนาคต 5 แบบ */}
          <section className="space-y-2 pt-4 border-t border-border">
            <h3 className="font-semibold text-sm">ฉากทัศน์อนาคต 5 แบบ</h3>
            <ScenarioPanel scenarios={scenarios} />
          </section>

          {/* สรุปเหตุผลเป็นภาษาคน */}
          <section className="space-y-2 pt-4 border-t border-border">
            <h3 className="font-semibold text-sm">สรุปเป็นภาษาคน</h3>
            <p className="text-sm">{narrative.whatsHappening}</p>
            <h4 className="mt-2 text-xs font-semibold text-muted-foreground">ทำไมจึงสรุปแบบนี้</h4>
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
            <h4 className="mt-2 text-xs font-semibold text-muted-foreground">
              อะไรจะทำให้มุมมองนี้ผิด
            </h4>
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

          {/* ข่าว & ปฏิทินเศรษฐกิจ */}
          <section className="space-y-2 pt-4 border-t border-border">
            <h3 className="font-semibold text-sm">ข่าว & ปฏิทินเศรษฐกิจ</h3>
            <NewsPanel news={news} loading={newsLoading} />
          </section>
        </div>
      </SheetContent>
    </Sheet>
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

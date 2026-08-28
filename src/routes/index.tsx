import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Check, Eye, EyeOff, RefreshCw, Sliders } from "lucide-react";
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
  getYahooMarketFeed,
  getXmMarketFeed,
  type MarketFeedResult,
} from "@/lib/market.functions";
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
import {
  loadMarketMode,
  MARKET_MODE_COPY,
  saveMarketMode,
} from "@/lib/market/mode";
import { MIN_WARMUP_CANDLES } from "@/lib/market/provider";
import { newPredictionId } from "@/lib/storage";
import { createLatestSaveQueue, type SaveQueueStatus } from "@/lib/save-queue";
import type { AiExplanation, AppSettings, Direction, MarketMode, Prediction } from "@/lib/types";

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
  const activeProvider = marketMode === "xm" ? liveProvider : liveProvider ?? frozenYahooGoldProvider;
  const analysisProvider = activeProvider ?? frozenYahooGoldProvider;
  const usingLive = liveProvider !== null;
  const earliest = analysisProvider.getEarliestTime();
  const latest = analysisProvider.getLatestTime();
  const intervalMs = analysisProvider.intervalMs;
  const firstAnalyzable = earliest + (MIN_WARMUP_CANDLES - 1) * intervalMs;
  const maxIndex = Math.max(0, Math.round((latest - firstAnalyzable) / intervalMs));

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [timeMachine, setTimeMachine] = useState(false);
  const [index, setIndex] = useState(maxIndex);
  const [revealedEvaluation, setRevealedEvaluation] = useState<SettlementEvaluation | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showFirstRun, setShowFirstRun] = useState(false);
  const [previousDirection, setPreviousDirection] = useState<Direction | undefined>();
  const aiRef = useRef<AiExplanation | null>(null);
  const lastDirectionRef = useRef<Direction | null>(null);
  const settingsSaveQueueRef = useRef<ReturnType<typeof createLatestSaveQueue<AppSettings>> | null>(null);

  if (!settingsSaveQueueRef.current) {
    settingsSaveQueueRef.current = createLatestSaveQueue(saveSettings, (status: SaveQueueStatus) => {
      if (status === "error") {
        toast.error("บันทึกค่าไป Cloud ไม่สำเร็จ", {
          description: "ค่าบนหน้าจออาจยังไม่ถูกเก็บถาวร กรุณาลองอีกครั้งเมื่อ session พร้อม",
        });
      }
    });
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShowFirstRun(window.localStorage.getItem("market-lab:first-run-dismissed:v2") !== "1");
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

  const asOf = timeMachine ? firstAnalyzable + index * intervalMs : latest;

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

  function handleMarketModeChange(next: MarketMode) {
    setMarketMode(next);
    saveMarketMode(window.localStorage, next);
    setTimeMachine(false);
    setSaved(null);
  }

  if (!result) {
    return (
      <AppShell
        live={usingLive}
        marketMode={marketMode}
        marketLabel={marketMode === "xm" ? "XM GOLD" : analysisProvider.label}
      >
        <MarketModeSelector mode={marketMode} onChange={handleMarketModeChange} />
        <MarketDataStatus
          mode={marketMode}
          result={marketQuery.data}
          loading={marketQuery.isLoading}
          usingLive={usingLive}
          queryError={marketQuery.error}
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

  const availableActuals = analysisProvider.getCandlesAfter(asOf, settings.horizon);
  const canReveal = availableActuals.length >= settings.horizon;

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
      const message =
        refreshResult.error instanceof Error
          ? refreshResult.error.message
          : "ไม่สามารถดึงข้อมูลตลาดได้";
      toast.error("ดึงข้อมูลไม่สำเร็จ", { description: message });
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

    const reason =
      refreshResult.data?.health.error ??
      refreshResult.data?.fallbackReason ??
      (marketMode === "xm"
        ? "ยังไม่มีข้อมูล GOLD จาก MT5 bridge"
        : "Yahoo ยังไม่มีข้อมูล delayed ที่ผ่าน validation");
    toast.error(marketMode === "xm" ? "XM bridge ยังไม่พร้อม" : "ยังดึงข้อมูล live ไม่ได้", {
      description: reason,
    });
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
      marketLabel={analysisProvider.label}
    >
      <div className="space-y-4">
        <MarketModeSelector mode={marketMode} onChange={handleMarketModeChange} />
        <MarketSelector
          mode={marketMode}
          assetId={selectedAssetId}
          timeframe={selectedTimeframe}
          onAssetChange={(next) => {
            setSelectedAssetId(next);
            setSelectedTimeframe(getMarketAsset(next).defaultTimeframe);
            setTimeMachine(false);
            setSaved(null);
          }}
          onTimeframeChange={(next) => {
            setSelectedTimeframe(next);
            setTimeMachine(false);
            setSaved(null);
          }}
        />

        <MarketDataStatus
          mode={marketMode}
          result={marketQuery.data}
          loading={marketQuery.isLoading}
          usingLive={usingLive}
          queryError={marketQuery.error}
        />

        {showFirstRun ? (
          <FirstRunNotice
            mode={marketMode}
            onStart={() => {
              window.localStorage.setItem("market-lab:first-run-dismissed:v2", "1");
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
            <p className="text-xs text-muted-foreground">
              {marketMode === "xm"
                ? "อ่าน GOLD M15 จาก MT5/XM ผ่าน bridge แบบ read-only"
                : usingLive
                  ? "อ่าน Gold Futures (GC=F) จาก Yahoo แบบ delayed"
                  : "ใช้ snapshot เดโม Gold Futures ที่ตรึงไว้"}
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={() => void handleRefreshMarketData()}
              disabled={marketQuery.isFetching}
              aria-label="อ่านข้อมูลตลาด Yahoo Gold Futures ตอนนี้"
            >
              <RefreshCw
                className={marketQuery.isFetching ? "animate-spin" : undefined}
                aria-hidden
              />
              {marketQuery.isFetching ? "กำลังดึงข้อมูล…" : "ดึงข้อมูลตอนนี้"}
            </Button>
          </div>

          <div className="mt-2">
            <CandleChart
              history={snapshot.candles}
              forecast={forecast}
              actual={revealedEvaluation?.actual ?? null}
              support={snapshot.support}
              resistance={snapshot.resistance}
              symbol={analysisProvider.symbol}
              timeframe={analysisProvider.timeframe}
              asOf={asOf}
              isTimeMachine={timeMachine}
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
                disabled={!canReveal && !revealedEvaluation}
              >
                {revealedEvaluation ? (
                  <>
                    <EyeOff className="h-4 w-4" aria-hidden /> ซ่อนเฉลย 5 แท่งจริง
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 text-gold" aria-hidden />
                    {canReveal
                      ? "เปิดเฉลย 5 แท่งจริง (เปรียบเทียบผลลัพธ์)"
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
                    {revealedEvaluation.score.candleDirHits}/{revealedEvaluation.score.candleDirTotal} แท่ง
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
            setRevealedEvaluation(null);
          }}
          index={index}
          maxIndex={maxIndex}
          asOf={asOf}
          onIndexChange={(i) => {
            setIndex(i);
            setSaved(null);
            setRevealedEvaluation(null);
          }}
          usingLive={usingLive}
        />

        <Disclaimer live={usingLive} marketMode={marketMode} />
      </div>
    </AppShell>
  );
}

function MarketModeSelector({
  mode,
  onChange,
}: {
  mode: MarketMode;
  onChange: (mode: MarketMode) => void;
}) {
  return (
    <section className="rounded-xl border border-gold/40 bg-accent/40 p-3" aria-label="เลือกโหมดข้อมูลตลาด">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold">โหมดข้อมูลตลาด</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            ระบบอ่านข้อมูลจาก Yahoo GC=F (COMEX Gold Futures) แบบ delayed เท่านั้น
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-background px-2 py-1 text-[11px] font-semibold">
          {MARKET_MODE_COPY[mode].shortLabel}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="โหมดข้อมูลตลาด">
        {(["cloud", "xm"] as const).map((option) => {
          const copy = MARKET_MODE_COPY[option];
          const isPaused = copy.paused;
          const isSelected = mode === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isSelected}
              onClick={() => !isPaused && onChange(option)}
              disabled={isPaused}
              className={`relative min-h-11 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                isPaused
                  ? "cursor-not-allowed border-border/50 bg-muted/50 text-muted-foreground/60"
                  : isSelected
                    ? "border-primary bg-primary text-primary-foreground active:scale-[0.98]"
                    : "border-border bg-background text-foreground hover:bg-muted active:scale-[0.98]"
              }`}
            >
              <span className="block font-semibold">{copy.label}</span>
              <span className={`mt-0.5 block leading-relaxed ${isSelected && !isPaused ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {copy.instrument}
              </span>
              {isPaused ? (
                <span className="absolute right-2 top-2 rounded-full bg-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  กำลังพัฒนา
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{MARKET_MODE_COPY[mode].description}</p>
    </section>
  );
}

function MarketSelector({
  mode,
  assetId,
  timeframe,
  onAssetChange,
  onTimeframeChange,
}: {
  mode: MarketMode;
  assetId: MarketAssetId;
  timeframe: "1m" | "5m" | "15m" | "1h" | "1d";
  onAssetChange: (assetId: MarketAssetId) => void;
  onTimeframeChange: (timeframe: "1m" | "5m" | "15m" | "1h" | "1d") => void;
}) {
  const asset = getMarketAsset(assetId);
  if (mode === "xm") {
    return (
      <section className="rounded-xl border border-border bg-card p-3" aria-label="ตลาด XM">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">ตลาดที่เลือก</p>
            <p className="mt-1 text-sm font-semibold">GOLD · XM MetaTrader 5</p>
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium">M15</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          ใช้แท่ง GOLD จากบัญชี XM ผ่าน bridge บน PC เท่านั้น ไม่ใช่ XAUEUR และไม่ใช่ Yahoo GC=F
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-border bg-card p-3" aria-label="เลือกตลาด">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Asset
          <select
            className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground"
            value={assetId}
            onChange={(event) => onAssetChange(event.target.value as MarketAssetId)}
            aria-label="เลือก asset"
          >
            {ACTIVE_MARKET_ASSETS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Timeframe
          <select
            className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground"
            value={timeframe}
            onChange={(event) =>
              onTimeframeChange(event.target.value as "1m" | "5m" | "15m" | "1h" | "1d")
            }
            aria-label="เลือก timeframe"
          >
            {asset.supportedIntervals.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {asset.dataLimitations}
      </p>
    </section>
  );
}

function MarketDataStatus({
  mode,
  result,
  loading,
  usingLive,
  queryError,
}: {
  mode: MarketMode;
  result: MarketFeedResult | undefined;
  loading: boolean;
  usingLive: boolean;
  queryError: unknown;
}) {
  const warnings = result?.validation?.warnings ?? [];
  const queryErrorMessage = queryError instanceof Error ? queryError.message : undefined;
  const warming = result?.health.status === "empty" && result.candleCount < result.requiredCandles;
  const stale = result?.validation?.stale === true;
  const error =
    result?.health.error ??
    (warming ? queryErrorMessage : result?.fallbackReason) ??
    queryErrorMessage;
  const feed = result?.feed;
  const label =
    loading && !result
      ? "กำลังอ่านข้อมูล…"
      : mode === "xm"
        ? warming
          ? "WARMING · XM bridge"
          : stale
            ? "STALE · XM bridge"
            : feed
              ? "LIVE · XM · read-only"
              : "OFFLINE · XM bridge"
        : usingLive && feed?.delayed
          ? "DELAYED · Yahoo · read-only"
          : usingLive
            ? "LIVE · read-only"
            : stale
              ? "STALE · DEMO fallback"
              : error
                ? "ERROR · DEMO fallback"
                : "DEMO · frozen snapshot";
  const latestSourceTimestamp =
    result && result.candleCount > 0 && result.health.fetchedAt > 0
      ? new Date(result.health.fetchedAt).toISOString()
      : null;
  const statusClass =
    usingLive && !stale
      ? "bg-bull-soft text-bull"
      : error || stale
        ? "bg-wait-soft text-foreground"
        : "bg-accent text-accent-foreground";

  const candleCountDisplay = result && result.candleCount > 0
    ? `${result.candleCount}/${result.requiredCandles} แท่ง${result.candleCount >= result.requiredCandles ? " ✓" : ""}`
    : null;
  const FRESHNESS_WARN_MS = 30 * 60 * 1000;
  const freshnessWarning = usingLive && feed && result?.health.fetchedAt
    ? (Date.now() - result.health.fetchedAt > FRESHNESS_WARN_MS)
    : false;

  return (
    <section
      className="rounded-xl border border-border bg-card px-3 py-2.5"
      aria-live="polite"
      aria-label="สถานะแหล่งข้อมูลราคา"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">แหล่งข้อมูลราคา</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass}`}>
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {feed?.displayName ?? (mode === "xm" ? "XM GOLD · MT5 bridge" : "Yahoo Gold Futures")}
        </span>
        {candleCountDisplay ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
            {candleCountDisplay}
          </span>
        ) : null}
        {loading && result ? (
          <span className="text-[11px] text-muted-foreground">กำลังตรวจข้อมูลรอบใหม่…</span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {mode === "xm"
          ? feed
            ? `${feed.symbol} · ${feed.timeframe} · GOLD จาก MT5/XM bridge · แท่งที่ปิดแล้ว · timestamp UTC`
            : warming
              ? `${result?.fallbackReason ?? `กำลังสะสมข้อมูล XM ${result?.candleCount ?? 0}/${result?.requiredCandles ?? MIN_WARMUP_CANDLES} แท่ง`} · ยังไม่สร้างสัญญาณจนกว่าจะพร้อม`
              : stale
                ? "ข้อมูล GOLD จาก bridge ค้างเกินเกณฑ์ · เปิด MT5/bridge หรือเลือก Cloud Mode เอง"
                : "ยังไม่ได้รับ closed candle จาก XM MT5 bridge · ระบบไม่ใช้ GC=F หรือ snapshot คนละ instrument แทน"
          : usingLive && feed
            ? `${feed.symbol} · ${feed.timeframe} · ${feed.delayed ? "ราคา delayed" : "ราคาสด"} · แท่งที่ปิดแล้ว · timestamp UTC`
            : warming
              ? `${result?.fallbackReason ?? `กำลังสะสมข้อมูลจริง ${result?.candleCount ?? 0}/${result?.requiredCandles ?? MIN_WARMUP_CANDLES} แท่ง`} · ระหว่างนี้ใช้ snapshot เดโมที่ตรึงไว้`
              : "ยังใช้ snapshot เดโม GC=F ที่ตรึงไว้ เพราะ Yahoo ยังไม่พร้อม, ค้าง, rate-limited หรือไม่ผ่าน validation"}
      </p>
      {latestSourceTimestamp ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          แท่งปิดล่าสุดที่รับรอง: {latestSourceTimestamp} UTC
        </p>
      ) : null}
      {freshnessWarning ? (
        <p className="mt-1 rounded-lg bg-wait-soft p-2 text-[11px] text-muted-foreground">
          ⚠ ข้อมูลล่าสุดเก่ากว่า 30 นาที · อาจเป็นเพราะตลาดปิด, rate limit หรือ Yahoo ไม่ตอบ
        </p>
      ) : null}
      {error && !warming ? (
        <p className="mt-1 rounded-lg bg-wait-soft p-2 text-[11px] text-muted-foreground">
          {mode === "xm" ? "เหตุผลที่หยุดการวิเคราะห์" : "เหตุผลที่ใช้ fallback"}: {error}
        </p>
      ) : null}
      {warnings.length ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          คำเตือนข้อมูล: {warnings.slice(0, 2).join(" · ")}
        </p>
      ) : null}

      {/* Source / instrument explanation (Item 5) */}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] font-medium text-primary">
          เกี่ยวกับแหล่งข้อมูลราคา
        </summary>
        <div className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            <strong>GC=F</strong> คือ COMEX Gold Futures ที่ซื้อขายบนตลาด CME Globex สกุล USD — ใช้เป็น
            directional proxy ของทิศทางทองคำได้ แต่ราคา, wick, basis, FX conversion, timezone
            และ session hours ไม่เท่ากับ broker GOLD (XM CFD) หรือ XAU/EUR
          </p>
          <p>
            ข้อมูลจาก Yahoo Finance เป็น delayed quote ไม่ใช่ราคา real-time
            และไม่มีการส่งคำสั่งซื้อขายใด ๆ ผ่านระบบนี้
          </p>
        </div>
      </details>
    </section>
  );
}

function FirstRunNotice({
  mode,
  onStart,
}: {
  mode: MarketMode;
  onStart: () => void;
}) {
  return (
    <section
      className="rounded-xl border border-gold/40 bg-accent p-4"
      aria-labelledby="first-run-title"
    >
      <h1 id="first-run-title" className="font-semibold">
        ยินดีต้อนรับสู่ Market Prediction Playground
      </h1>
      <p className="mt-2 text-sm leading-relaxed">
        {mode === "xm"
          ? "ระบบมองแท่ง GOLD M15 จาก MT5/XM ผ่าน bridge จาก 5 มุมมองและคาดการณ์ 5 แท่งถัดไป"
          : "ระบบมอง Gold Futures (GC=F) จาก 5 มุมมองและคาดการณ์ 5 แท่ง 15 นาทีถัดไป"} เพื่อการเรียนรู้เท่านั้น
        แอปไม่ส่งคำสั่งซื้อขาย และคุณยังเป็นผู้ตัดสินใจทุกอย่างด้วยตนเอง
      </p>
      <Button className="mt-3 min-h-11" onClick={onStart}>
        {mode === "xm" ? "เริ่มวิเคราะห์ XM" : "เริ่ม Demo"}
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

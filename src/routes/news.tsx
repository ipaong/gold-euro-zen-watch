import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { NewsPanel } from "@/components/app/NewsPanel";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { getYahooMarketFeed } from "@/lib/market.functions";
import { frozenYahooGoldProvider } from "@/lib/market/yahoo-frozen-provider";
import { getNewsSnapshot } from "@/lib/news.functions";
import { frozenNewsProvider } from "@/lib/news/frozen-news";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "ข่าว & ปฏิทินเศรษฐกิจ — Gold Futures Playground" },
      {
        name: "description",
        content:
          "ดูข่าวแรงและปฏิทินเศรษฐกิจที่ระบบใช้ประกอบการวิเคราะห์ Gold Futures GC=F ราย 15 นาที พร้อมทิศทางทองคำ",
      },
      { property: "og:title", content: "ข่าว & ปฏิทินเศรษฐกิจ — Gold Futures Playground" },
      {
        property: "og:description",
        content: "ข่าวแรง ปฏิทินเศรษฐกิจ และทิศทางทองคำที่ระบบใช้ประเมินความเสี่ยงของ GC=F",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  // Use Cloud Yahoo latest candle timestamp as the real asOf, not frozen fixture.
  const fetchMarket = useServerFn(getYahooMarketFeed);
  const marketQuery = useQuery({
    queryKey: ["news-page-market"],
    queryFn: () =>
      fetchMarket({ data: { assetId: "gold", timeframe: "15m", requestedAt: Date.now() } }),
    retry: false,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const liveFeed = marketQuery.data?.feed ?? null;
  const usingLive = liveFeed !== null;
  const asOf = useMemo(() => {
    if (liveFeed && liveFeed.candles.length > 0) {
      return liveFeed.candles[liveFeed.candles.length - 1]!.t;
    }
    return frozenYahooGoldProvider.getLatestTime();
  }, [liveFeed]);

  const fetchNews = useServerFn(getNewsSnapshot);
  const newsQuery = useQuery({
    queryKey: ["live-news", asOf],
    queryFn: () => fetchNews({ data: { asOf } }),
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const news = newsQuery.data ?? frozenNewsProvider.buildSnapshot(asOf);

  // Find newest headline timestamp for display.
  const newestHeadline =
    news.headlines.length > 0
      ? Math.max(...news.headlines.map((h) => h.publishedAt))
      : null;

  async function handleRefreshNews() {
    const refreshResult = await newsQuery.refetch();
    if (refreshResult.error) {
      toast.error("ดึงข่าวไม่สำเร็จ", {
        description:
          refreshResult.error instanceof Error
            ? refreshResult.error.message
            : "ไม่สามารถดึงข่าวจริงได้",
      });
      return;
    }
    toast.success("อัปเดตข่าวแล้ว");
  }

  return (
    <AppShell
      marketLabel="Gold Futures (Yahoo proxy)"
      marketSubline="GC=F · 15m · ข่าวตามเวลาที่วิเคราะห์"
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="font-semibold">ข่าว & เศรษฐกิจ</h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9"
              onClick={() => void handleRefreshNews()}
              disabled={newsQuery.isFetching}
              aria-label="ดึงข่าวใหม่"
            >
              <RefreshCw
                className={newsQuery.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
                aria-hidden
              />
              {newsQuery.isFetching ? "กำลังดึง…" : "ดึงข่าวใหม่"}
            </Button>
          </div>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>
              วิเคราะห์ ณ {fmtDateTime(asOf)}{" "}
              {usingLive ? "(Yahoo GC=F delayed)" : "(snapshot เดโม GC=F)"}
            </p>
            {newestHeadline ? (
              <p>ข่าวล่าสุดเผยแพร่เมื่อ: {fmtDateTime(newestHeadline)}</p>
            ) : null}
            {news.fetchedAt ? (
              <p>ดึงข้อมูลเมื่อ: {fmtDateTime(news.fetchedAt)}</p>
            ) : null}
          </div>
          {!usingLive ? (
            <p className="mt-2 rounded-lg bg-wait-soft p-2 text-[11px] text-muted-foreground">
              ⚠ ข่าวย้อนหลังอาจไม่ครบ — RSS ให้เฉพาะรายการที่ feed ยังเก็บไว้
              และข้อมูลมหภาคบางรายการใช้เวลาเชิงประมาณจากช่วงเวลา ไม่ใช่ release timestamp จริง
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-muted-foreground">
            ข่าวจริงจาก GDELT, Fed, ECB และตัวเลขมหภาคจาก BLS, Eurostat, ECB Data Portal
            ระบบเห็นเฉพาะข่าวที่เผยแพร่แล้ว
          </p>
        </section>
        <NewsPanel news={news} loading={newsQuery.isLoading} asOf={asOf} />
        <Disclaimer />
      </div>
    </AppShell>
  );
}


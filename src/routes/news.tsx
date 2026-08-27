import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { NewsPanel } from "@/components/app/NewsPanel";
import { fmtDateTime } from "@/lib/format";
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
          "ดูข่าวแรงและปฏิทินเศรษฐกิจที่ระบบใช้ประกอบการวิเคราะห์ Gold Futures GC=F ราย 15 นาที พร้อมทิศทางของทองคำในชุดข้อมูลเดโม",
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
  const asOf = frozenYahooGoldProvider.getLatestTime();
  const fetchNews = useServerFn(getNewsSnapshot);
  const newsQuery = useQuery({
    queryKey: ["live-news", asOf],
    queryFn: () => fetchNews({ data: { asOf } }),
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const news = newsQuery.data ?? frozenNewsProvider.buildSnapshot(asOf);

  return (
    <AppShell
      marketLabel="Gold Futures (Yahoo proxy)"
      marketSubline="GC=F · 15m · ข่าวตามเวลาที่วิเคราะห์"
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <h1 className="font-semibold">ข่าว & เศรษฐกิจ</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            ข้อมูล ณ {fmtDateTime(asOf)} — ข่าวจริงจาก GDELT, Fed, ECB และตัวเลขมหภาคจาก BLS,
            Eurostat, ECB Data Portal ระบบเห็นเฉพาะข่าวที่เผยแพร่แล้ว
          </p>
        </section>
        <NewsPanel news={news} loading={newsQuery.isLoading} />
        <Disclaimer />
      </div>
    </AppShell>
  );
}

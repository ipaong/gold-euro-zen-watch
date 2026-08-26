import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { NewsPanel } from "@/components/app/NewsPanel";
import { fmtDateTime } from "@/lib/format";
import { frozenMarketProvider } from "@/lib/market/frozen-provider";
import { getNewsSnapshot } from "@/lib/news.functions";
import { frozenNewsProvider } from "@/lib/news/frozen-news";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "ข่าว & ปฏิทินเศรษฐกิจ — XAUEUR Signal Lab" },
      {
        name: "description",
        content:
          "ดูข่าวแรงและปฏิทินเศรษฐกิจที่ระบบใช้ประกอบการวิเคราะห์ XAUEUR ราย 15 นาที พร้อมทิศทางของทองคำและยูโรในชุดข้อมูลเดโม",
      },
      { property: "og:title", content: "ข่าว & ปฏิทินเศรษฐกิจ — XAUEUR Signal Lab" },
      {
        property: "og:description",
        content: "ข่าวแรง ปฏิทินเศรษฐกิจ และทิศทางทองคำ/ยูโรที่ระบบใช้ตัดสินความเสี่ยง",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const asOf = frozenMarketProvider.getLatestTime();
  const fetchNews = useServerFn(getNewsSnapshot);
  const newsQuery = useQuery({
    queryKey: ["live-news", Math.floor(asOf / (10 * 60 * 1000))],
    queryFn: () => fetchNews({ data: { asOf } }),
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const news = newsQuery.data ?? frozenNewsProvider.buildSnapshot(asOf);

  return (
    <AppShell>
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

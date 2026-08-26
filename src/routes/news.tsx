import { createFileRoute } from "@tanstack/react-router";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { NewsPanel } from "@/components/app/NewsPanel";
import { fmtDateTime } from "@/lib/format";
import { frozenMarketProvider } from "@/lib/market/frozen-provider";
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
  const news = frozenNewsProvider.buildSnapshot(asOf);

  return (
    <AppShell>
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <h1 className="font-semibold">ข่าว & เศรษฐกิจ</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            ข้อมูล ณ {fmtDateTime(asOf)} — ระบบเห็นเฉพาะข่าวที่ประกาศแล้ว
            ตัวเลขจริงของข่าวที่ยังไม่ถึงเวลาจะถูกซ่อนไว้
          </p>
        </section>
        <NewsPanel news={news} />
        <Disclaimer />
      </div>
    </AppShell>
  );
}

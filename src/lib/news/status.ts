import type { NewsSnapshot } from "../types";

export function getNewsStatusLabel(
  news: Pick<NewsSnapshot, "demo" | "live" | "stale">,
  loading = false,
): string {
  if (loading) return "กำลังดึงข่าวจริง…";
  if (news.demo) return "ข่าวเดโม";
  if (news.stale) return "ข่าวจริง (STALE)";
  return news.live ? "ข่าวจริง (LIVE)" : "ข่าวจริง";
}

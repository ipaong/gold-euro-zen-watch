import { Bell, CircleCheck, Info, TriangleAlert } from "lucide-react";

import type { AppAlert } from "@/lib/alerts";

export function AlertPanel({ alerts }: { alerts: AppAlert[] }) {
  if (!alerts.length) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-label="การแจ้งเตือนในแอป">
      <header className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-gold" aria-hidden />
        <h2 className="font-semibold">การแจ้งเตือน</h2>
        <span className="ml-auto text-xs text-muted-foreground">ข้อมูลประกอบ ไม่ใช่คำสั่งเทรด</span>
      </header>
      <ul className="mt-2 space-y-2">
        {alerts.map((alert) => {
          const Icon =
            alert.tone === "warning"
              ? TriangleAlert
              : alert.tone === "positive"
                ? CircleCheck
                : Info;
          const tone =
            alert.tone === "warning"
              ? "border-gold/30 bg-accent"
              : alert.tone === "positive"
                ? "border-bull/20 bg-bull-soft"
                : "border-border bg-muted";
          return (
            <li key={alert.id} className={`rounded-lg border p-2.5 ${tone}`}>
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{alert.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{alert.body}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

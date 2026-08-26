import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, History, LineChart } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "วิเคราะห์", icon: LineChart },
  { to: "/history", label: "บันทึกผล", icon: History },
  { to: "/guide", label: "คู่มือ", icon: BookOpen },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            XE
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">XAUEUR Signal Lab</p>
            <p className="truncate text-[11px] text-muted-foreground">
              ทองคำ/ยูโร · M15 · ห้องทดลองพยากรณ์
            </p>
          </div>
          <span className="ml-auto shrink-0 rounded-full border border-gold/50 bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
            ข้อมูลเดโม
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-28 pt-4">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <ul className="mx-auto flex max-w-lg">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
      เครื่องมือนี้ใช้เพื่อการศึกษาและทดสอบกระบวนการวิเคราะห์เท่านั้น ไม่ใช่คำแนะนำการลงทุน
      ข้อมูลราคาและข่าวทั้งหมดในเฟสนี้เป็นชุดข้อมูลเดโมที่ถูกตรึงไว้ (frozen dataset)
      ไม่ใช่ราคาตลาดจริง
    </p>
  );
}

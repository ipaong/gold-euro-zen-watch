import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  History,
  LineChart,
  MoreHorizontal,
  Newspaper,
  Sliders,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const mainNav = [
  { to: "/", label: "วิเคราะห์", icon: LineChart },
  { to: "/history", label: "บันทึกผล", icon: History },
  { to: "/performance", label: "สถิติ", icon: BarChart3 },
] as const;

const moreNav = [
  { to: "/news", label: "ข่าว & เศรษฐกิจ", icon: Newspaper, hint: "ข่าวแรงและปฏิทินที่ระบบใช้" },
  { to: "/settings", label: "ตั้งค่าเกณฑ์คุณภาพ", icon: Sliders, hint: "ปรับความเข้มงวดของสัญญาณ" },
  { to: "/guide", label: "คู่มือมือใหม่", icon: BookOpen, hint: "ระบบทำงานยังไงตั้งแต่ต้น" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreNav.some((i) => pathname.startsWith(i.to));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
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

      <main className="mx-auto max-w-lg px-4 pb-32 pt-4">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex max-w-lg">
          {mainNav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="เมนูเพิ่มเติม"
              className={`flex min-h-12 w-full flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium ${
                moreActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden />
              เพิ่มเติม
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>เมนูเพิ่มเติม</SheetTitle>
            <SheetDescription>หน้ารองทั้งหมดของแอปอยู่ที่นี่</SheetDescription>
          </SheetHeader>
          <ul className="space-y-2 px-4 pb-6">
            {moreNav.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-gold" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.hint}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
      เครื่องมือนี้ใช้เพื่อการศึกษาและทดสอบกระบวนการวิเคราะห์เท่านั้น ไม่ใช่คำแนะนำการลงทุน
      ข้อมูลราคาและข่าวทั้งหมดในเฟสนี้เป็นชุดข้อมูลเดโมที่ตรึงไว้ ไม่ใช่ราคาตลาดจริง
    </p>
  );
}

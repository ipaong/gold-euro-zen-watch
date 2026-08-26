import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { SettingsFields } from "@/components/app/SettingsFields";
import { Button } from "@/components/ui/button";
import { DEFAULT_SETTINGS } from "@/lib/analysis";
import { loadSettings, saveSettings } from "@/lib/storage";
import type { AppSettings } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าเกณฑ์คุณภาพ — XAUEUR Signal Lab" },
      {
        name: "description",
        content:
          "ปรับความเข้มงวดของสัญญาณ XAUEUR ได้เอง เช่น ความมั่นใจขั้นต่ำ จำนวนโมเดลที่ต้องเห็นตรงกัน และระยะเวลาเลี่ยงข่าวแรง",
      },
      { property: "og:title", content: "ตั้งค่าเกณฑ์คุณภาพ — XAUEUR Signal Lab" },
      {
        property: "og:description",
        content: "ตั้งความมั่นใจขั้นต่ำ จำนวนเสียงที่ต้องตรงกัน และการเลี่ยงข่าวแรง",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function update(s: AppSettings) {
    setSettings(s);
    saveSettings(s);
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <h1 className="font-semibold">ตั้งค่าเกณฑ์คุณภาพ</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            ยิ่งตั้งเข้มงวด ระบบยิ่งบอก “รอ” บ่อยขึ้น ซึ่งเป็นเรื่องปกติและดีต่อการทดสอบ
            ค่าที่ตั้งไว้จะถูกจำในเครื่องนี้
          </p>
          <div className="mt-4">
            <SettingsFields settings={settings} onChange={update} />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-6 w-full"
            onClick={() => {
              update(DEFAULT_SETTINGS);
              toast.success("คืนค่าเริ่มต้นแล้ว");
            }}
          >
            คืนค่าเริ่มต้น
          </Button>
        </section>
        <Disclaimer />
      </div>
    </AppShell>
  );
}

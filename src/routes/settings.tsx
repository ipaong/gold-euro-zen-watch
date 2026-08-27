import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { SettingsFields } from "@/components/app/SettingsFields";
import { Button } from "@/components/ui/button";
import { DEFAULT_SETTINGS } from "@/lib/analysis";
import { loadSettings, saveSettings } from "@/lib/cloud-store";
import { createLatestSaveQueue, type SaveQueueStatus } from "@/lib/save-queue";
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

type PersistState = SaveQueueStatus;

function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [persistState, setPersistState] = useState<PersistState>("synced");
  const saveQueueRef = useRef<ReturnType<typeof createLatestSaveQueue<AppSettings>> | null>(null);

  if (!saveQueueRef.current) {
    saveQueueRef.current = createLatestSaveQueue(saveSettings, (status: SaveQueueStatus) => {
      setPersistState(status);
      if (status === "error") {
        toast.error("บันทึกค่าไป Cloud ไม่สำเร็จ", {
          description: "ค่าบนหน้าจออาจยังไม่ถูกเก็บถาวร กรุณาลองอีกครั้งเมื่อ session พร้อม",
        });
      }
    });
  }

  useEffect(() => {
    void (async () => {
      try {
        setSettings(await loadSettings());
        setPersistState("synced");
      } catch {
        setPersistState("error");
        toast.error("โหลดค่าจาก Cloud ไม่สำเร็จ", {
          description: "กำลังแสดงค่าเริ่มต้น และจะไม่แสดงว่าบันทึกสำเร็จจนกว่าจะยืนยันได้",
        });
      }
    })();
  }, []);

  function update(next: AppSettings) {
    setSettings(next);
    saveQueueRef.current?.enqueue(next);
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <h1 className="font-semibold">ตั้งค่าเกณฑ์คุณภาพ</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            ยิ่งตั้งเข้มงวด ระบบยิ่งบอก “รอ” บ่อยขึ้น ซึ่งเป็นเรื่องปกติและดีต่อการทดสอบ
            ค่าที่ตั้งไว้จะถูกจำไว้บน Lovable Cloud
          </p>
          <div className="mt-4">
            <SettingsFields settings={settings} onChange={update} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground" role="status" aria-live="polite">
            {persistState === "saving"
              ? "กำลังบันทึกค่าล่าสุด…"
              : persistState === "error"
                ? "ยังยืนยันการบันทึกไม่ได้ — ค่าบนหน้าจออาจยังไม่ถาวร"
                : "ค่าล่าสุดยืนยันกับ Cloud แล้ว"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={() => update(DEFAULT_SETTINGS)}
          >
            คืนค่าเริ่มต้น
          </Button>
        </section>
        <Disclaimer />
      </div>
    </AppShell>
  );
}

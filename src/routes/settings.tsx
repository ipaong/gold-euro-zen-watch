import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell, Disclaimer } from "@/components/app/AppShell";
import { SettingsFields } from "@/components/app/SettingsFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_SETTINGS } from "@/lib/analysis";
import { getAuthSession, updatePassword } from "@/lib/auth";
import { loadSettings, saveSettings } from "@/lib/cloud-store";
import { createLatestSaveQueue, type SaveQueueStatus } from "@/lib/save-queue";
import type { AppSettings } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าเกณฑ์คุณภาพ — Market Prediction Playground" },
      {
        name: "description",
        content:
          "ปรับความเข้มงวดของสัญญาณ Gold Futures GC=F ได้เอง เช่น ความมั่นใจขั้นต่ำ จำนวนโมเดลที่ต้องเห็นตรงกัน และระยะเวลาเลี่ยงข่าวแรง",
      },
      { property: "og:title", content: "ตั้งค่าเกณฑ์คุณภาพ — Market Prediction Playground" },
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
type PasswordSessionState = "loading" | "account" | "demo" | "error";

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

        <PasswordChangeSection />

        <Disclaimer />
      </div>
    </AppShell>
  );
}

function PasswordChangeSection() {
  const [sessionState, setSessionState] = useState<PasswordSessionState>("loading");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void getAuthSession()
      .then((session) => {
        const user = session?.user;
        const isAnonymous = Boolean((user as { is_anonymous?: boolean } | null)?.is_anonymous);
        if (user?.email && !isAnonymous) {
          setAccountEmail(user.email);
          setSessionState("account");
        } else {
          setSessionState("demo");
        }
      })
      .catch(() => {
        setSessionState("error");
      });
  }, []);

  function authMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
    const normalized = message.toLowerCase();

    if (normalized.includes("same password")) {
      return "รหัสผ่านใหม่ต้องแตกต่างจากรหัสผ่านเดิม";
    }
    if (normalized.includes("password") && normalized.includes("weak")) {
      return "รหัสผ่านใหม่ไม่ผ่านเกณฑ์ความปลอดภัยของ Supabase";
    }
    if (normalized.includes("session") || normalized.includes("jwt")) {
      return "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง";
    }

    return message;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("เปลี่ยนรหัสผ่านแล้ว");
    } catch (error) {
      setPasswordError(authMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="password-title">
      <h2 id="password-title" className="font-semibold">
        เปลี่ยนรหัสผ่าน
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        เปลี่ยนรหัสผ่านของบัญชี Login ปัจจุบันได้จากหน้านี้ โดยรหัสผ่านจะถูกจัดการผ่าน Supabase
        Auth และไม่ถูกบันทึกไว้ในแอป
      </p>

      {sessionState === "loading" ? (
        <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground" role="status">
          กำลังตรวจสอบบัญชี…
        </p>
      ) : sessionState === "account" ? (
        <form className="mt-4 space-y-4" onSubmit={(event) => void submit(event)}>
          <p className="text-xs text-muted-foreground">
            บัญชีที่กำลังใช้งาน: <span className="font-medium text-foreground">{accountEmail}</span>
          </p>
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium">
              รหัสผ่านใหม่
            </label>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="อย่างน้อย 6 ตัวอักษร"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={6}
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium">
              ยืนยันรหัสผ่านใหม่
            </label>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
              required
              disabled={submitting}
            />
          </div>

          {passwordError ? (
            <p
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {passwordError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "กำลังเปลี่ยนรหัสผ่าน…" : "เปลี่ยนรหัสผ่าน"}
          </Button>
        </form>
      ) : (
        <div className="mt-4 rounded-lg bg-muted p-3">
          <p className="text-sm text-muted-foreground">
            {sessionState === "error"
              ? "ตรวจสอบ session ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่ก่อนเปลี่ยนรหัสผ่าน"
              : "ฟีเจอร์เปลี่ยนรหัสผ่านใช้ได้เมื่อเข้าสู่ระบบด้วยบัญชีจริง ไม่รวมโหมด Demo"}
          </p>
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link to="/login">ไปหน้าเข้าสู่ระบบ</Link>
          </Button>
        </div>
      )}
    </section>
  );
}

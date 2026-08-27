import { createFileRoute } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthSession, signInWithPassword, signOut } from "@/lib/auth";
import { DEMO_MODE_STORAGE_KEY } from "@/lib/home-access";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — Market Prediction Playground" },
      {
        name: "description",
        content: "เข้าสู่ระบบเพื่อเก็บคำพยากรณ์และผลการทดสอบของคุณแยกจากผู้ใช้อื่น",
      },
      { property: "og:title", content: "เข้าสู่ระบบ — Market Prediction Playground" },
      {
        property: "og:description",
        content: "เข้าสู่ระบบเพื่อเก็บคำพยากรณ์และผลการทดสอบของคุณ",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LoginPage,
});

type SessionState =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "anonymous" }
  | { kind: "signed_in"; email: string }
  | { kind: "backend_unavailable" };

function isBackendUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  return (
    normalized.includes("missing supabase environment variable") ||
    normalized.includes("supabase_url") ||
    normalized.includes("supabase_publishable_key") ||
    normalized.includes("connect supabase")
  );
}

function authMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  const normalized = message.toLowerCase();

  if (isBackendUnavailableError(error)) {
    return "ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล คุณยังเข้าใช้งานโหมด Demo ได้ตามปกติ";
  }
  if (normalized.includes("invalid login credentials")) {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }
  if (normalized.includes("email not confirmed")) {
    return "บัญชีนี้ยังไม่ได้ยืนยันอีเมล กรุณาติดต่อผู้ดูแลระบบ";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "มีการลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่";
  }

  return message;
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<SessionState>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAuthSession()
      .then((currentSession) => {
        if (!currentSession) {
          setSession({ kind: "signed_out" });
          return;
        }

        const user = currentSession.user;
        const isAnonymous = Boolean((user as { is_anonymous?: boolean }).is_anonymous);
        if (isAnonymous || !user.email) {
          setSession({ kind: "anonymous" });
        } else {
          setSession({ kind: "signed_in", email: user.email });
        }
      })
      .catch((authError) => {
        if (isBackendUnavailableError(authError)) {
          setSession({ kind: "backend_unavailable" });
        } else {
          // The form remains usable when session inspection is unavailable.
          setSession({ kind: "signed_out" });
        }
      });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signInWithPassword(email.trim(), password);
      await navigate({ to: "/" });
    } catch (authError) {
      setError(authMessage(authError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);
    try {
      await signOut();
      setSession({ kind: "signed_out" });
    } catch (authError) {
      setError(authMessage(authError));
    } finally {
      setSigningOut(false);
    }
  }

  const isLoading = session.kind === "loading";
  const hasAccount = session.kind === "signed_in";
  const backendUnavailable = session.kind === "backend_unavailable";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            XE
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">Market Prediction Playground</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Gold Futures GC=F · 15m · Yahoo delayed
            </p>
          </div>
          <span className="ml-auto shrink-0 rounded-full border border-gold/50 bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
            ข้อมูลเดโม
          </span>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-lg items-start px-4 pb-12 pt-10">
        <section className="w-full rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Account access
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {hasAccount ? "บัญชีของคุณ" : backendUnavailable ? "ระบบยังไม่พร้อม" : "เข้าสู่ระบบ"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {hasAccount
                ? "บัญชีนี้ใช้เก็บคำพยากรณ์และผลการทดสอบของคุณแยกจากผู้ใช้อื่น"
                : backendUnavailable
                  ? "ฐานข้อมูลยังไม่ได้เชื่อมต่อ คุณสามารถทดลองใช้งานโหมด Demo ได้ทันที"
                  : "เข้าสู่ระบบเพื่อเก็บคำพยากรณ์และผลการทดสอบของคุณอย่างเป็นสัดส่วน"}
            </p>
          </div>

          {isLoading ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground" role="status">
              กำลังตรวจสอบ session…
            </p>
          ) : backendUnavailable ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted p-4">
                <p className="text-sm font-medium text-foreground">ฐานข้อมูลยังไม่เชื่อมต่อ</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  ฟีเจอร์บัญชีผู้ใช้จะใช้งานได้หลังจากเชื่อมต่อ Lovable Cloud แต่คุณยังสามารถทดลองวิเคราะห์สัญญาณในโหมด Demo ได้ตามปกติ
                </p>
              </div>
              <Button asChild className="w-full">
                <Link to="/" search={{ demo: true }}>
                  เข้าโหมด Demo
                </Link>
              </Button>
            </div>
          ) : hasAccount ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted p-4">
                <p className="text-xs text-muted-foreground">เข้าสู่ระบบด้วย</p>
                <p className="mt-1 break-all font-medium">{session.email}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild className="w-full">
                  <Link to="/">กลับไปหน้าวิเคราะห์</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                >
                  {signingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
                </Button>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void submit(event)}>
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-medium">
                  อีเมล
                </label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-medium">
                  รหัสผ่าน
                </label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="รหัสผ่านของคุณ"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                  disabled={submitting}
                />
              </div>

              {error ? (
                <p
                  className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
              </Button>
            </form>
          )}

          {!hasAccount ? (
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                หากยังไม่ต้องการใช้บัญชี คุณสามารถเข้าโหมด Demo ได้โดยไม่ต้อง Login
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => {
                  window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
                  void navigate({ to: "/", search: { demo: true } });
                }}
              >
                เข้าโหมด Demo
              </Button>
            </div>
          ) : null}

          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
            ระบบนี้ใช้เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน และยังใช้ข้อมูลราคาเดโมที่ตรึงไว้
          </p>
        </section>
      </main>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthSession, signInWithPassword, signOut, signUpWithPassword } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — XAUEUR Signal Lab" },
      {
        name: "description",
        content: "เข้าสู่ระบบเพื่อเก็บคำพยากรณ์และผลการทดสอบของคุณแยกจากผู้ใช้อื่น",
      },
      { property: "og:title", content: "เข้าสู่ระบบ — XAUEUR Signal Lab" },
      {
        property: "og:description",
        content: "เข้าสู่ระบบเพื่อเก็บคำพยากรณ์และผลการทดสอบของคุณ",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LoginPage,
});

type AuthMode = "login" | "signup";
type SessionState =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "anonymous" }
  | { kind: "signed_in"; email: string };

function authMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }
  if (normalized.includes("email not confirmed")) {
    return "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ";
  }
  if (normalized.includes("user already registered")) {
    return "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทนการสมัครใหม่";
  }
  if (normalized.includes("password should be at least")) {
    return "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "มีการลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่";
  }

  return message;
}

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<SessionState>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      .catch(() => {
        // The form remains usable when session inspection is unavailable.
        setSession({ kind: "signed_out" });
      });
  }, []);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        await signInWithPassword(email.trim(), password);
        await navigate({ to: "/" });
        return;
      }

      const result = await signUpWithPassword(email.trim(), password);
      if (result.needsEmailConfirmation) {
        setNotice("สมัครสำเร็จแล้ว กรุณาตรวจอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ");
        setPassword("");
      } else {
        await navigate({ to: "/" });
      }
    } catch (authError) {
      setError(authMessage(authError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setError(null);
    setNotice(null);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95">
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

      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-lg items-start px-4 pb-12 pt-10">
        <section className="w-full rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Account access
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {hasAccount ? "บัญชีของคุณ" : mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {hasAccount
                ? "บัญชีนี้ใช้เก็บคำพยากรณ์และผลการทดสอบของคุณแยกจากผู้ใช้อื่น"
                : "เข้าสู่ระบบเพื่อเก็บคำพยากรณ์และผลการทดสอบของคุณอย่างเป็นสัดส่วน"}
            </p>
          </div>

          {isLoading ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground" role="status">
              กำลังตรวจสอบ session…
            </p>
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
            <>
              <div className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    mode === "login"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => switchMode("login")}
                >
                  เข้าสู่ระบบ
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signup"}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    mode === "signup"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => switchMode("signup")}
                >
                  สมัครบัญชี
                </button>
              </div>

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
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
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
                {notice ? (
                  <p
                    className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground"
                    role="status"
                  >
                    {notice}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting
                    ? mode === "login"
                      ? "กำลังเข้าสู่ระบบ…"
                      : "กำลังสร้างบัญชี…"
                    : mode === "login"
                      ? "เข้าสู่ระบบ"
                      : "สมัครบัญชี"}
                </Button>
              </form>
            </>
          )}

          {!hasAccount ? (
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                ยังไม่พร้อมสร้างบัญชีใช่ไหม คุณสามารถเข้าโหมด Demo ได้โดยไม่ต้อง Login
              </p>
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link to="/">เข้าโหมด Demo</Link>
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

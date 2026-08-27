# Manus Progress Log — XAUEUR Signal Lab

อัปเดตล่าสุด: 27 สิงหาคม 2026
Branch: `main`
Baseline: `origin/main` ล่าสุดก่อนรอบนี้ที่ `6983720` (`สร้าง Manus prompt งานค้าง`)

## Milestone: Phase 0 review + source implementation

สถานะ: committed ใน `1a0b7bc` (`feat: harden phase 0 settlement ownership`)

สิ่งที่ทำ:

- ทวน Anonymous Auth session reuse, in-flight promise deduplication, failure recovery และ user_id scoping ใน cloud store
- เพิ่ม migration `20260827120000_phase0_result_immutability.sql` ให้ `prediction_results` append-only และเพิ่ม pgTAP assertions รวมเป็น 22 tests
- เพิ่ม `SUPABASE_PHASE0_RUNBOOK.md` สำหรับ staging preflight, Anonymous Sign-In, CAPTCHA/Turnstile, RLS และหลักฐานการ execute
- เพิ่ม migration/local data-preservation tests; duplicate settlement retry ไม่ overwrite ผลเดิม

หลักฐานที่ตรวจแล้ว:

- Vitest cloud-store suite: ผ่าน 7 tests รวม migration failure preservation และ duplicate result retry
- มี pgTAP SQL suite 22 assertions แต่ยังไม่ได้ execute บน DB จริง
- Supabase CLI และ Docker daemon ไม่มีใน sandbox จึงห้ามเคลม migration/pgTAP deployed หรือ passed

## Milestone: Phase 1 Measurement Integrity

สถานะ: source implementation เสร็จในขอบเขตที่ไม่ต้องใช้ live DB

- เพิ่ม `SCORE_VERSION = 1.0.0`, readiness rule, exact horizon scoring และ per-model outcomes สำหรับ Trend, Momentum, Technical, News, Volatility และ Consensus
- Ensemble ไม่ถูกนับเป็น vote เพิ่ม
- เพิ่ม Last 20/50/100/All, BUY/SELL accuracy, WAIT frequency, MAE, candle-direction accuracy, calibration buckets และ minimum-sample warning
- เพิ่ม chronological pilot split, Wilson interval และ idempotent settlement contract

## Milestone: Phase 2 News Resilience

สถานะ: source implementation และ unit tests เสร็จในขอบเขตที่ไม่ต้องใช้ credential

- GDELT เป็น optional single request timeout 8 วินาทีด้วย query สั้น
- cache successful snapshots 60 นาทีและแยก live/historical key; optional-provider failure ไม่ invalidates snapshot ที่ required providers ยังสำเร็จ
- เพิ่ม provider health/version, fetchedAt, stale/fallback reason และ AI schema/supporting-ID guards
- เพิ่ม normalize, cache, provider failure, AI parsing และ future-event masking tests

## Milestone: Phase 3 Read-only Market Data

สถานะ: source integration เสร็จแบบ read-only; live response ต้องยืนยันใน Lovable หลังตั้ง secret/ตรวจ plan

- ศึกษา official MT5 `copy_rates_from` และ OANDA v20 candle contract; trade-offs อยู่ใน `MARKET_PROVIDER_RESEARCH.md`
- เพิ่ม normalized XAUEUR/M15 contract, OHLC validation, closed-candle-only, ordering, missing interval, UTC timestamp และ stale checks
- เพิ่ม frozen demo adapter; ไม่มี order/trade path และไม่อ้างว่า live
- เพิ่ม `src/lib/market/twelvedata.ts` สำหรับ parse `XAU/EUR`/`15min`/UTC, closed-candle, OHLC/symbol/order validation และ `feed-provider.ts` สำหรับ synchronous analysis boundary
- เพิ่ม `src/lib/market.functions.ts` ให้เรียก Twelve Data จาก server เท่านั้นด้วย `TWELVEDATA_API_KEY`, timeout 8 วินาที, success-only cache 60 วินาที, minimum 240-candle warmup และ provider health/fallback
- Home ใช้ Twelve Data เมื่อพร้อมและ fallback เป็น frozen demo เมื่อไม่พร้อม; auth gate ที่ `/` redirect signed-out ไป `/login` และปุ่ม Demo สร้าง anonymous session ก่อนกลับ Home
- live prediction ถูกติดป้ายใน History และยังไม่ settlement ด้วย frozen demo เพื่อไม่เทียบข้อมูลคนละ source

## Milestone: Phase 4 UX, Performance & Observability

สถานะ: partial implementation

- เพิ่ม first-run explanation/dismissal และ in-app alerts บน dashboard
- NewsPanel แสดง fetched time, provider health/version และ fallback reason
- เพิ่ม bounded structured operational metrics สำหรับ provider, AI fallback, stale feed, auth และ settlement โดยไม่เก็บ secrets/PII
- จัดการ Fast Refresh false positives ของ app component และ UI primitives ผ่าน ESLint override โดยไม่แก้ Supabase generated files
- route code-splitting และ browser accessibility evidence ยัง pending

## Milestone: Phase 5 Controlled Pilot & Alerts

สถานะ: protocol/reporting/in-app alerts เสร็จ; evaluation จริง pending

- protocol ล็อกเป็น tuning 30 + evaluation 50 จาก locked ขั้นต่ำ 80 รายการ
- eligibility ต้องมี evaluation directional results ครบ, settlement completeness อย่างน้อย 90% และมี Wilson 95% interval
- external LINE/Telegram/email ยังไม่ทำ และไม่มี automatic trading

## Verification plan

คำสั่งที่ต้องรันก่อน commit/PR:

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Database verification ต้องรันแยกใน local/staging environment ที่ยืนยันแล้ว:

```sh
supabase db reset
supabase test db
```

## Open blockers

- Sandbox ไม่มี Supabase CLI/Docker และยังไม่มี staging project ref ที่เจ้าของยืนยัน จึงยังไม่ deploy migration หรือรัน pgTAP
- Anonymous Sign-In, CAPTCHA/Turnstile, rate limit และ cleanup policy ต้องตั้งค่าก่อนเปิดสาธารณะ
- ต้องเพิ่ม `TWELVEDATA_API_KEY` ใน Lovable server secrets และยืนยัน plan/symbol access ด้วย live response; MT5 bridge ยังไม่ทำ
- Live automatic settlement ยังไม่เปิด เพราะต้องมี live outcome provider/source-version policy แยกจาก frozen demo
- Pilot evaluation ต้องรอข้อมูล locked/settled จริงตาม protocol

## Verification result — 27 สิงหาคม 2026

- `npm test`: ผ่าน 53 tests จาก 17 test files
- `npm run lint`: ผ่าน ไม่มี errors/warnings
- `npx tsc --noEmit`: ผ่าน
- `npm run build`: ผ่าน production build
- `git diff --check`: ผ่าน
- เพิ่ม Twelve Data parser tests รวม test suite เป็น 64 tests จาก 20 test files; live endpoint ยังไม่ได้เรียกด้วย key จริงใน sandbox เพราะ key ไม่ได้ส่งเข้า session
- bundle secrecy check: ไม่พบ `TWELVEDATA_API_KEY` หรือ `api.twelvedata.com` ใน `.output/public`
- `supabase test db`: ยังไม่รัน เพราะ environment ไม่มี Supabase CLI/Docker และยังไม่มี staging project ref ที่เจ้าของยืนยัน

## Commits

| Commit | Milestone |
|---|---|
| `1a0b7bc` | Phase 0 settlement ownership, result immutability, observability foundation และ cloud migration preservation |
| `ae9fd33` | Phase 1–5 source implementation, tests, docs, pilot report และ in-app alerts |
| `4b191f1` | Home auth guard, explicit Demo flow, Login escape link, policy tests และ QA documentation |

commit หลักของ Phase 0–5 และ Home auth guard อยู่บน `origin/main` ตามตารางด้านบน; ไม่มีการเปิด PR และ migration/pgTAP ยังไม่ได้ execute ใน DB จริง

## Twelve Data read-only integration — 27 สิงหาคม 2026

เพิ่ม server-only Twelve Data adapter สำหรับ `XAU/EUR` interval `15min` timezone `UTC` โดยอ่าน key จาก `TWELVEDATA_API_KEY` เท่านั้น, timeout 8 วินาที, success-only cache 60 วินาที, closed-candle/OHLC/symbol/order validation และ minimum warmup 240 แท่ง. Home จะใช้ live feed เมื่อพร้อมและกลับ frozen demo พร้อมเหตุผลเมื่อ provider/plan/secret ไม่พร้อม. เพิ่ม auth gate ให้ `/` redirect ไป `/login`; ปุ่ม Demo สร้าง anonymous session ก่อนเข้า Home. Prediction แบบ live ถูกติดป้ายและไม่ถูก settlement ด้วย frozen demo.

`TWELVEDATA_SETUP.md` อธิบายการใส่ secret ใน Lovable; `TWELVEDATA_RESEARCH.md` บันทึก canonical symbol/endpoint จากเอกสาร provider. Parser/adapter tests เพิ่ม test suite เป็น 64 tests จาก 20 files. Live endpoint ยังไม่ได้เรียกด้วย key จริงใน sandbox เพราะ key ไม่ได้ส่งเข้ session. Bundle secrecy check ไม่พบ `TWELVEDATA_API_KEY` หรือ `api.twelvedata.com` ใน `.output/public`.


## Randomized workflow QA — 27 สิงหาคม 2026

สุ่ม smoke-test dashboard/onboarding, Settings, History, Performance และ News ผ่าน browser ใน dev server; พบและแก้ 2 ประเด็นสำคัญ ได้แก่ Settings ที่บันทึกแบบ fire-and-forget จนค่าหลุดข้าม route และ forecast timestamp ที่อาจไม่มากกว่า `asOf` เมื่อ `asOf` ไม่ตรง M15 boundary หรือ market data มี missing interval

การแก้ไขอยู่ใน `f20515a` (`fix: harden randomized workflows and settings persistence`) พร้อม `src/lib/randomized-workflow.test.ts` 2 randomized workflow cases, `src/lib/save-queue.test.ts` 2 queue cases และ Slider thumb accessibility fix. Full verification หลังแก้ผ่าน: 57 tests จาก 19 test files, lint ผ่าน, typecheck ผ่าน, build ผ่าน และ diff check ผ่าน

Commit `f20515a` ถูก push เข้า `origin/main` สำเร็จแล้ว; database migrations/pgTAP และ live market/pilot evaluation ยังคง pending ตามข้อจำกัดเดิม

## Milestone: Home authentication guard — 27 สิงหาคม 2026

สถานะ: committed และ pushed เข้า `origin/main` ใน `4b191f1` (`fix: redirect home to login unless demo selected`)

- เพิ่ม pure access policy ใน `src/lib/home-access.ts`: email/password account เข้า Home ได้, ผู้ใช้ที่ไม่มี account session จะไป `/login`, และ anonymous session อย่างเดียวไม่ bypass Login
- เพิ่ม client-side/hydration-safe guard ใน `src/routes/index.tsx` โดยไม่เรียก browser Supabase client ระหว่าง SSR; เพิ่ม `HomeGate` เพื่อไม่ render dashboard จนตรวจ access เสร็จ
- เพิ่ม explicit Demo flow ผ่าน `/?demo=true` และ localStorage flag; ปุ่ม `เข้าโหมด Demo` จาก Login เข้า dashboard ได้ และ reload ต่อได้โดยไม่เกิด redirect loop
- เพิ่มลิงก์ `เข้าสู่ระบบ` ใน `AppShell` เพื่อให้ผู้ใช้ Demo ไปสมัคร/เข้าสู่บัญชีได้ชัดเจน; account session มี precedence เหนือ Demo
- เพิ่ม `src/lib/home-access.test.ts` ครอบคลุม default Login, explicit/stored Demo, anonymous-session policy และ account precedence

หลักฐานที่ตรวจแล้ว:

- Browser local dev: เปิด `/` แบบไม่มี session/ไม่มี Demo flag → `/login` สำเร็จ และไม่พบ dashboard content หลัง hydration
- Browser local dev: ปุ่ม `เข้าโหมด Demo` → `/?demo=true` และ dashboard แสดงป้าย `ข้อมูลเดโม`; เปิด `/` ใหม่ยังเข้า dashboard ได้จาก stored flag
- `npm test`: ผ่าน 66 tests จาก 20 test files; `npm run lint`, `npx tsc --noEmit`, `npm run build` และ `git diff --check` ผ่าน; ไม่มีการ apply/deploy migration หรือเปลี่ยน DB

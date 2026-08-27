# Manus Progress Log — XAUEUR Signal Lab

อัปเดตล่าสุด: 27 สิงหาคม 2026
Branch: `manus/roadmap-phases-0-5` (push เข้า `origin/main` แล้ว)
Baseline: `e6519f5`; current `origin/main`: `8aec0b0`

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

สถานะ: implementation เสร็จใน feasible scope; dedicated screen-reader/contrast audit ยัง pending

- เพิ่ม first-run explanation/dismissal และ in-app alerts บน dashboard
- NewsPanel แสดง fetched time, provider health/version และ fallback reason
- เพิ่ม bounded structured operational metrics สำหรับ provider, AI fallback, stale feed, auth และ settlement โดยไม่เก็บ secrets/PII
- จัดการ Fast Refresh false positives ของ app component และ UI primitives ผ่าน ESLint override โดยไม่แก้ Supabase generated files
- route-level code-splitting มีหลักฐานจาก production build; browser evidence ครอบคลุม Home/Login/Demo/model accordion และ mobile viewport 360–412px

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
- `npm test`: ผ่าน 70 tests จาก 21 test files รวม home-access, Twelve Data parser/adapter และ settlement boundary; live endpoint ยังไม่ได้เรียกด้วย key จริงใน sandbox เพราะ key ไม่ได้ส่งเข้า session
- bundle secrecy check: ไม่พบ `TWELVEDATA_API_KEY` หรือ `api.twelvedata.com` ใน `.output/public`
- `supabase test db`: ยังไม่รัน เพราะ environment ไม่มี Supabase CLI/Docker และยังไม่มี staging project ref ที่เจ้าของยืนยัน

## Commits

| Commit | Milestone |
|---|---|
| `1a0b7bc` | Phase 0 settlement ownership, result immutability, observability foundation และ cloud migration preservation |
| `ae9fd33` | Phase 1–5 source implementation, tests, docs, pilot report และ in-app alerts |
| `4b191f1` | Home auth guard, explicit Demo flow, Login escape link, policy tests และ QA documentation |
| `e7eb36d` | Twelve Data read-only adapter, server fetch/cache, live/demo routing และ history safety |
| `8aec0b0` | Twelve Data progress documentation |
| `53fa27d` | Twelve Data integration and Lovable setup sync from remote main |
| `cd8497c` | UX/accessibility, mobile, provider and settlement hardening cherry-picked onto remote main |
| `50b29a4` | Stop tracking `.env` and add safe environment template |

commit หลักของ Phase 0–5, Home auth guard และ Twelve Data integration อยู่บน `origin/main` ตามตารางด้านบน; ไม่มีการเปิด PR และ migration/pgTAP ยังไม่ได้ execute ใน DB จริง

## Twelve Data read-only integration — 27 สิงหาคม 2026

เพิ่ม server-only Twelve Data adapter สำหรับ `XAU/EUR` interval `15min` timezone `UTC` โดยอ่าน key จาก `TWELVEDATA_API_KEY` เท่านั้น, timeout 8 วินาที, success-only cache 60 วินาที, closed-candle/OHLC/symbol/order validation และ minimum warmup 240 แท่ง. Home จะใช้ live feed เมื่อพร้อมและกลับ frozen demo พร้อมเหตุผลเมื่อ provider/plan/secret ไม่พร้อม. เพิ่ม auth gate ให้ `/` redirect ไป `/login`; ปุ่ม Demo สร้าง anonymous session ก่อนเข้า Home. Prediction แบบ live ถูกติดป้ายและไม่ถูก settlement ด้วย frozen demo.

`TWELVEDATA_SETUP.md` อธิบายการใส่ secret ใน Lovable; `TWELVEDATA_RESEARCH.md` บันทึก canonical symbol/endpoint จากเอกสาร provider. Parser/adapter tests รวมกับ home-access แล้วเป็น 69 tests จาก 21 files. Live endpoint ยังไม่ได้เรียกด้วย key จริงใน sandbox เพราะ key ไม่ได้ส่งเข้ session. Bundle secrecy check ไม่พบ `TWELVEDATA_API_KEY` หรือ `api.twelvedata.com` ใน `.output/public`.


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

## Milestone: Feasible backlog hardening — 27 สิงหาคม 2026

สถานะ: implementation และ full verification เสร็จ; รวมขึ้น branch sync แล้ว รอ fast-forward push เข้า `main`

- เพิ่ม `aria-controls` ที่เชื่อมกับ panel จริงใน `ModelVoteCard`; panel ที่ปิดยังอยู่ใน DOM ด้วย `hidden` เพื่อให้ screen reader ใช้ relationship ได้ถูกต้อง
- เพิ่ม `aria-controls`/`tabpanel` semantics ใน Login/Signup และปรับ NewsPanel ให้ event row ย่อได้บน mobile พร้อม accessible labels สำหรับลิงก์ต้นทาง
- ทำ visual QA ที่ viewport 360×800 และ 412×900; header, cards, chart และ bottom navigation ไม่เกิด horizontal overflow ในภาพที่ตรวจ
- ตรวจเอกสารทางการ MQL5/OANDA และยืนยัน contract read-only; เพิ่ม runtime guard ของ `complete` flag และ settlement filter ที่ไม่รับ candle เวลา `<= asOf`
- เพิ่ม pilot regression ให้ shuffled predictions ยัง split ตามเวลาเป็น tuning 30 + evaluation 50; ไม่สร้าง live provider, credential, scheduler หรือ trade path

หลักฐานที่ตรวจแล้ว:

- `npm test`: ผ่าน 67 tests จาก 20 test files; `npm run lint`, `npx tsc --noEmit`, `npm run build` และ `git diff --check` ผ่าน
- static audit ไม่พบ identifier สำหรับ order placement/trade execution ใน `src`/`supabase` และ `MarketDataProvider` มี read methods เท่านั้น
- Supabase CLI และ Docker ไม่มีใน sandbox; migration/pgTAP และ RLS REST allow/deny ยังต้องทำ manual ใน staging ที่เจ้าของยืนยัน

## Milestone: Remote main reconciliation and secret hygiene — 27 สิงหาคม 2026

- remote `main` มี Twelve Data read-only integration เพิ่มเข้ามาหลัง hardening รอบก่อน; นำ hardening มาต่อบน `origin/main` ด้วย cherry-pick โดยไม่ rebase/force-push
- ถอน `.env` ที่ remote เคย track ออกจาก tip และเพิ่ม `.env.example` ที่มีเฉพาะชื่อ variables ว่าง; ไม่อ่านหรือ commit ค่า secret
- full gate บน branch ที่รวม remote integration และ hardening ผ่าน: `npm test` 70 tests จาก 21 files, lint, typecheck, production build และ `git diff --check`
- ยังไม่ apply/deploy migration, ไม่รัน pgTAP/RLS against DB จริง และไม่เรียก Twelve Data live ด้วย credential ใน sandbox

## Milestone: Auth safety reconciliation — 27 สิงหาคม 2026

remote `main` เพิ่ม login-only UI และ `supabase/manual/create_fixed_login_user.sql` ที่มี password literal ระหว่างรอบ push. ตามข้อกำหนดความปลอดภัย ฉันไม่ได้นำ fixed credential มาใช้ และลบไฟล์ดังกล่าวออกจาก repository tip โดยไม่ rewrite ประวัติเดิม; คืน Signup + email-confirmation flow และ `signUpWithPassword` helper ให้ตรงกับ requirements เดิม พร้อม regression tests 2 กรณี

สถานะปัจจุบันของ authentication คือ Login/Signup ด้วย email/password, ปุ่ม Demo แบบ explicit และ Home guard ที่ส่งผู้ใช้ signed-out ไป `/login`; ห้าม commit secret หรือ fixed credentials. หาก password ที่เคยอยู่ใน remote file เป็น credential จริง ต้อง rotate/revoke ด้วยตนเองนอก repository.

หลัง reconcile remote `origin/main` ที่ `374bfc9` แล้ว ตรวจ source suite ได้ 69 tests จาก 21 files ก่อนเพิ่ม auth regression รอบนี้; targeted auth/home tests ผ่าน 17 tests และ typecheck/lint ผ่าน. ต้องรัน full gate อีกครั้งหลัง commit correction.

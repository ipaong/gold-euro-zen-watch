# Manus Progress Log — XAUEUR Signal Lab

อัปเดตล่าสุด: 27 สิงหาคม 2026
Historical branch: `manus/roadmap-phases-0-5` (บันทึก milestone เก่า; push เข้า `origin/main` แล้ว)
Current release-hardening baseline: branch `main`, `origin/main` และ local `0b18fb9` ก่อน overnight pass; active architecture คือ Yahoo Chart `GC=F`/`15m` ตาม section ล่าสุดด้านล่าง

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


## Milestone: Yahoo-first market provider migration — 27 สิงหาคม 2026

สถานะ: source implementation เสร็จใน feasible scope; active Home path เปลี่ยนเป็น Yahoo Chart `GC=F` 15m แบบ delayed และ fallback เป็น same-instrument frozen `GC=F` snapshot. ห้ามตีความ `GC=F` เป็นราคา execution ของ XM `XAUUSD`/`XAUEUR`.

- เพิ่ม `src/lib/market/yahoo.ts` เป็น pure parser สำหรับ Yahoo Chart parallel arrays, epoch-second timestamps, 15m close filtering, future/open filtering, duplicate replacement, OHLC/symbol/granularity validation และ bounded range policy
- เพิ่ม `src/lib/market.functions.ts` เป็น server-only Yahoo fetch path: timeout 8 วินาที, cache เฉพาะ success 60 วินาทีต่อ asset/timeframe, explicit HTTP/429/parse/provider failures และ provider health/fallback reason
- เพิ่ม normalized contract metadata: internal symbol, provider symbol, display name, timeframe, intervalMs, sourceType, delayed, fetchedAt และ source-matching checks
- เพิ่ม `src/lib/market/assets.ts` เป็น registry; เปิดใช้งานเฉพาะ `gold → GC=F → 15m` หลังมี response และ frozen fixture ที่ validate แล้ว. `5m/1h/1d` มี parser/range policy แต่ยัง disabled จนมี fixture/fallback tests ครบ
- เพิ่ม `src/data/gc-f-15m.json` จาก passive Yahoo response และ `src/lib/market/yahoo-frozen-provider.ts`; คง `src/data/xaueur-m15.json`/legacy provider แยกไว้ ห้ามผสม instrument
- Home แสดง asset/timeframe selector, `DELAYED · Yahoo · read-only`, `DEMO · frozen snapshot`, `STALE`/`ERROR` state, provider/display name, symbol/timeframe, timestamp และ reason; forecast cadence ใช้ interval จาก provider
- Prediction snapshot เก็บ `provider`, `providerSymbol`, `dataStatus`, `marketCandles`; History/Detail/Performance ไม่ใช้ euro prefix ตายตัวและไม่ settle live/delayed record ด้วย frozen data; detail chart ใช้ candles ณ lock time
- News model สำหรับ `GC=F` ใช้ gold bias เท่านั้น ไม่เปลี่ยน EUR-only strength ให้เป็นสัญญาณ Gold Futures; AI prompt ถูกทำให้เป็น asset/provider-neutral
- เพิ่ม `yahoo.test.ts`, `assets.test.ts`, `models/news.test.ts`; frozen XAUEUR regression suite ยังผ่าน
- เอกสารอัปเดต: `YAHOO_SETUP.md`, `MARKET_PROVIDER_RESEARCH.md`, `CODE_MAP.md`, `ROADMAP.md`

หลักฐานที่ตรวจแล้ว:

- Passive browser fetch ของ Yahoo Chart `GC=F` 15m คืน `symbol=GC=F`, `CMX/COMEX`, `instrumentType=FUTURE`, `dataGranularity=15m`, timestamps และ OHLC arrays
- `pnpm test`: ผ่าน 91 tests จาก 26 test files
- `pnpm lint`: ผ่าน
- `pnpm exec tsc --noEmit`: ผ่าน
- `pnpm build`: ผ่าน; Yahoo fetch อยู่ใน server chunk และ public bundle audit ไม่พบ Yahoo server endpoint, API key หรือ service-role secret
- `git diff --check`: ผ่าน
- Browser visual QA ใน sandbox ยังทำไม่ได้: local app route ค้างระหว่าง Supabase Auth/SSR และ browser session unavailable; จึงยังไม่เคลม deployed runtime, real account access, rate-limit behavior หรือ live Yahoo production smoke test

Open blockers:

- ต้องเปิด deployed Lovable environment แล้วตรวจ `DELAYED · Yahoo · read-only`, `GC=F/15m`, timestamp และ forced failure/429 fallback ด้วย account/environment จริง
- ต้องรอ/ยืนยัน 240 closed candles ของ Yahoo `GC=F/15m` ก่อนพิจารณา delayed feed เป็นแหล่งหลักของ analysis
- ต้องไม่ใช้ Yahoo `GC=F` เพื่อคำนวณราคา XM execution, spread, lot, stop, rollover หรือ settlement; live/delayed settlement ยังปิด
- หากจะเปิด asset/timeframe เพิ่ม ต้องมี validated response, source-matching parser test, same-instrument frozen fixture และ UI/fallback QA ครบก่อน


เพิ่มเติมหลัง hardening รอบสุดท้าย:

- เปลี่ยน market server functions ให้ใช้ `Date.now()` ฝั่ง server แทน `requestedAt` จาก client สำหรับ freshness/closed-candle decisions เพื่อกัน client clock/look-ahead manipulation
- เพิ่ม `findEnabledMarketAsset()` เพื่อให้ server ปฏิเสธ asset ที่ disabled/ยัง validate ไม่ครบ แทนการ fallback เงียบไปยัง Gold Futures คนละ asset
- เพิ่ม `src/lib/market.functions.test.ts` สำหรับ 239/240 warmup, stale feed และ candle source-symbol mismatch; เพิ่ม total เป็น 94 tests จาก 27 test files
- จำกัด active registry เป็น `gold/GC=F/15m`; parser รองรับ policy ของ interval อื่นเพื่อการขยายในอนาคต แต่ยังไม่เปิด UI/runtime จนกว่าจะมี fixture และ validation ครบ


## Milestone: Integrated Yahoo + Red-Team hardening — 27 สิงหาคม 2026

สถานะ: implementation, cross-architecture regression tests และ local browser smoke เสร็จบน branch `manus/red-team-yahoo-integration` ซึ่งสร้างจาก `origin/main@438c2cf`; ไม่ได้ merge หรือ force-push branch `manus/red-team-hardening` แบบกลไกตรง ๆ

- **F-01 STILL APPLICABLE:** เปลี่ยน news server cache และ Home/News React Query keys เป็น exact `asOf` โดยคง live/historical namespace และ success-only TTL 60 นาที
- **F-02 STILL APPLICABLE:** mask future economic-event actual ก่อน snapshot/AI; payload และ supporting-ID guard รับเฉพาะข้อมูลที่เปิดเผยและไม่ล้ำ `asOf`
- **F-03 NEEDS ADAPTATION:** real stale snapshot ยังคง `live=true` เพื่อสื่อว่า source เป็นข่าวจริง แต่ `NewsPanel` แสดง `ข่าวจริง (STALE)` และ stale ไม่ผ่าน successful-cache predicate
- **F-04 NEEDS ADAPTATION:** settlement ใช้ `provider.intervalMs`, ตรวจ instrument/provider symbol, OHLC geometry, ordering, duplicate และ contiguous horizon; timeout/invalid payload เป็น `not_ready`; History เลือก same-instrument frozen provider สำหรับ GC=F demo
- **F-05 STILL APPLICABLE:** normalized market contract ปฏิเสธ candle/fetchedAt ที่ล้ำ server observation time เกิน 60 วินาที tolerance
- **F-06 OBSOLETE ในรูป Twelve Data → Gold API:** ไม่ port provider code เก่า; ปรับ active root/Login/Settings/Guide/News/trend/Performance และ GDELT identity ให้ truthful ต่อ Yahoo GC=F; legacy parser/docs/fixture คงไว้เฉพาะ compatibility
- **F-07 STILL APPLICABLE:** explicit `/?demo=true` ทำงานได้เมื่อ auth/Supabase unavailable ขณะที่ผู้ใช้ที่ไม่ขอ Demo ยังใช้ Login policy เดิม

หลักฐานและไฟล์สำคัญ: `RED_TEAM_FINDINGS.md`, `YAHOO_INTEGRATION_BROWSER_NOTES.md`, `CODE_MAP.md`

Verification ล่าสุดบน integrated branch: `npm test` ผ่าน 107 tests จาก 28 files; `npm run lint` ผ่าน 0 errors/0 warnings; `npx tsc --noEmit` ผ่าน; `npm run build` ผ่าน production/Nitro build; `git diff --check` ผ่าน. Focused cross-architecture suite ผ่าน 42 tests จาก 11 files.

Browser smoke ตรวจ Home/explicit Demo, Login, History, prediction detail not-found, News, Performance, Settings และ Guide. Local console พบเฉพาะ expected missing `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`; ยังไม่ได้เคลม Supabase/RLS, authenticated Cloud persistence, live Yahoo production/rate-limit หรือ deployed runtime. Live/delayed settlement ยังปิดตาม policy.


## Current overnight release-hardening pass — 27 สิงหาคม 2026

รอบนี้เริ่มจาก `main` ที่ตรงกับ `origin/main@0b18fb9` และ working tree สะอาด โดยรักษา active architecture เป็น Yahoo Finance Chart → `GC=F` COMEX Gold Futures → `15m`, server-only delayed read, same-instrument frozen fallback และ no automatic trading. Sections ที่กล่าวถึง Twelve Data/Gold API ด้านบนเป็น historical record; ไม่ใช่ active runtime contract.

สิ่งที่แก้หลัง reproduce/source audit:

- Home route loader และ hydration guard honor explicit หรือ stored Demo เมื่อ auth backend unavailable; ผู้ใช้ที่ไม่มี Demo flag ยังถูกส่ง Login
- Home SettingsSheet ใช้ `createLatestSaveQueue` เดียวกับ Settings route เพื่อ serialize rapid changes และ suppress stale failure
- `MarketDataFeed.fetchedAt` ถูก document ให้หมายถึง latest accepted closed-candle timestamp ที่ใช้เป็น freshness anchor ไม่ใช่ response-receipt time; Home/Yahoo runbook copy แก้ให้ตรง semantics และเพิ่ม parser regression

Evidence รอบนี้คือ `npm test` ผ่าน 108 tests จาก 28 files, `npm run lint`, `npx tsc --noEmit`, `npm run build` และ `git diff --check` ผ่าน. Local browser smoke ตรวจ Login, explicit Demo, stored-Demo reload, History, nonexistent History deep link, News, Performance, Settings และ Guide. Delayed captures ที่ 360/390/412/768/1280px และ route screenshots ที่ 360/412px ไม่พบ page-level horizontal clipping; Performance scoreboard horizontal scroll เป็น trade-off ที่ตั้งใจ.

ยังห้ามเคลม production verification: Supabase migration/pgTAP/RLS, authenticated multi-user isolation, Yahoo public endpoint/rate limit/240-candle warmup ใน deployed environment, real credentials, scheduler และ live outcome settlement ยัง pending. รายละเอียด route evidence อยู่ใน `OVERNIGHT_BROWSER_NOTES.md`; issue disposition อยู่ใน `OVERNIGHT_ISSUES.md` และ final release assessment อยู่ใน `RELEASE_CANDIDATE_REPORT.md`.


## Milestone: Dual-Mode Cloud + XM Live source implementation — 28 สิงหาคม 2026

สถานะ: source implementation เสร็จใน feasible scope; ยังรอ Supabase/MT5 owner-environment verification และยังไม่เปิด automatic settlement หรือ trading path.

เริ่มจาก `origin/main@a613048` ซึ่งเป็นผลจาก overnight release-hardening pass ก่อนหน้า. เพิ่มโหมดให้ผู้ใช้เลือกเองสองแบบ:

- Cloud Mode: Yahoo Finance Chart `GC=F` COMEX Gold Futures `15m` แบบ delayed และ same-instrument frozen `GC=F` fallback ตาม contract เดิม
- XM Live Mode: MT5 terminal ที่ login XM อ่าน `GOLD` M15 ผ่าน Python read-only bridge ซึ่ง request position `1` เป็นต้นไป, ส่งปิดแล้วเท่านั้น และส่ง outbound ไป Supabase Edge Function
- XM Edge Function ตรวจ shared secret, POST-only, body size, schema, symbol/timeframe, OHLC, UTC alignment, future timestamp และ ordering ก่อนเรียก service-role ingestion RPC
- XM storage เป็น `xm_market_candles` แบบ append-only closed OHLC พร้อม primary key ตาม source/version/symbol/timeframe/bucket, RLS/grants, immutable trigger, idempotent duplicate และ conflicting-row rejection
- Home/History/AppShell/Disclaimer แสดง mode และ source ให้ตรงกัน; XM offline/stale/warming หยุด analysis และไม่สลับไป Yahoo/GC=F/XAUEUR โดยเงียบ ๆ. XM prediction เก็บ `marketMode` ใน immutable snapshot และยังไม่เปิด cross-source settlement

หลักฐานที่ตรวจใน sandbox:

- `npm test -- --run`: ผ่าน 119 tests จาก 30 test files
- `npm run lint`, `npx tsc --noEmit`, `npm run build` และ `git diff --check`: ผ่าน
- `python3 -m unittest discover -s bridge -p 'test_*.py'`: ผ่าน 3 bridge tests; Python syntax compile ผ่าน
- Local browser: Cloud error/DEMO fallback, XM offline, stored XM reload และ explicit XM→Cloud recovery แสดง source/status ตรง contract; route mobile captures 360/412px และ prior 768/1280px visual smoke ไม่พบ page-level overflow blocker; console พบเฉพาะ expected missing local Supabase environment errors
- เอกสารใหม่: `DUAL_MODE_DESIGN.md`, `DUAL_MODE_RESEARCH.md`, `DUAL_MODE_BROWSER_NOTES.md`, `bridge/README.md`

ข้อจำกัดที่ยัง pending:

- sandbox ไม่มี Supabase CLI/Docker และไม่มี project ref ที่เจ้าของยืนยัน จึงยังไม่ได้ apply migration, run pgTAP/RLS, deploy Edge Function หรือส่ง real MT5/XM payload
- ต้องตั้ง `XM_BRIDGE_SECRET` ใน Supabase และบน PC อย่างปลอดภัย, เปิด MT5/XM `GOLD`, ทดสอบ `--once`, ตรวจราคา/แท่งกับ terminal และสะสม warmup อย่างน้อย 240 closed bars
- Vercel/Nitro ไม่สามารถคุยกับ MT5 Desktop บน PC ได้เอง; XM Live จะ online เฉพาะเมื่อ PC/terminal/bridge ทำงานอยู่. Cloud Mode ยังคงทำงานได้โดยไม่เปิด PC
- ยังไม่มี source-faithful XM outcome provider/settlement path และไม่ควรสรุป prediction accuracy จาก source ที่ต่างกัน

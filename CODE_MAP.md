# CODE MAP — Market Prediction Playground

เอกสารนี้คือแผนที่โค้ดสำหรับนักพัฒนา/AI ตัวอื่น (เช่น Codex) ให้ต่องานต่อได้โดยไม่ต้องไล่อ่านทั้ง repo
แอป: ห้องทดลองพยากรณ์แบบ read-only ที่ใช้ Cloud `GC=F` ของ Yahoo กรอบเวลา 15 นาทีเป็นเส้นทางหลัก — เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน ส่วน XM/MT5 เก็บโค้ดไว้เป็นงานอนาคตและจะไม่เป็นตัวเลือกใช้งานปกติในระยะนี้
แผนงานตามลำดับ dependency และเกณฑ์จบแต่ละ phase อยู่ที่ `ROADMAP.md`

## Product direction — 28 Aug 2026

- **เป้าหมายหลัก:** ทำ Cloud Yahoo `GC=F/15m` ให้เสถียร อธิบายง่าย และตรวจสอบย้อนกลับได้ ก่อนขยาย data source อื่น
- **XM/MT5 ถูกพัก:** ไม่เดินหน้าต่อด้าน MT5 terminal, PC server, scheduler หรือ live settlement ในระยะนี้ โค้ด bridge/database เดิมคงไว้เพื่อไม่ทำลาย history และ compatibility
- **งาน UX รอบถัดไป:** ซ่อนทางเลือก XM จาก flow หลักและแสดงเป็น `กำลังพัฒนา`; ลดความสับสนเรื่อง source, delayed data, แท่งจริงที่ปิดแล้ว, 5 แท่งพยากรณ์, Demo fallback และความต่างระหว่าง `GC=F`, broker `GOLD` และ `XAUEUR`
- **ขอบเขตการเปรียบเทียบ:** `GC=F`, `GOLD` และ `XAUEUR` อาจมีทิศทาง M15 คล้ายกันมาก แต่ห้ามถือว่าเป็นราคา/แท่งเดียวกันหรือใช้ราคาเป้าหมายข้าม instrument โดยตรง
- การซ่อน XM เป็น **decision ที่บันทึกแล้วแต่ยังไม่ได้แก้ UI** ณ commit ปัจจุบัน; ห้ามเขียนว่า deploy เสร็จจนกว่าจะมี code change และ verification

## Implementation update — `main`

รอบนี้เพิ่ม measurement contract แบบ versioned (`scoreVersion: 1.0.0`) และผลประเมินแยก 5 voting models + Consensus โดย Ensemble ยังคงเป็น commentary; เพิ่ม readiness/idempotent settlement contract, Performance scoreboard แบบ Last 20/50/100/All, confidence calibration, sample-size warnings และ controlled pilot report พร้อม Wilson uncertainty

ชั้นข่าวทำ GDELT เป็น optional bounded request (timeout 8 วินาที), cache successful snapshots 60 นาทีโดยแยก live/historical namespace และ exact `asOf`, เก็บ provider health/fallback reason, mask future event actual ก่อน snapshot/AI payload และเพิ่ม tests สำหรับ normalize/cache/AI schema/id guard/no-look-ahead

ชั้นตลาดเพิ่ม normalized read-only contract และ frozen demo adapters สำหรับ OHLC, UTC timestamp, closed-candle, symbol/timeframe, source และ freshness validation; runtime ปัจจุบันอ่าน Yahoo Chart `GC=F` server-side และ fallback เป็น frozen `GC=F` snapshot โดยยังไม่มีเส้นทางส่งคำสั่งซื้อขาย

เพิ่ม in-app alerts, structured observability events และ UI แสดง provider health, latest accepted closed-candle timestamp และ fallback reason ทั้งหมดไม่มี external notification และไม่บันทึก secrets หรือ personal identifiers

Phase 0 database migrations รวม result immutability ถูก apply แล้วบน managed Supabase โปรเจกต์ GoldCompass; remote schema lint ไม่พบ error ส่วน pgTAP suite ยังไม่ได้รันบน remote environment

รอบล่าสุดเพิ่มปุ่ม `ดึงข้อมูลตอนนี้` เหนือกราฟใน `src/routes/index.tsx` สำหรับ manual refetch ผ่าน React Query; ปุ่ม disable/spinner ระหว่างโหลด และแจ้ง success/error ด้วย toast โดยไม่เพิ่ม polling รอบใหม่

รอบล่าสุดเพิ่ม **Home auth guard**: `/` ตรวจ email/password session ฝั่ง browser และส่งผู้ใช้ที่ยังไม่ login ไป `/login`; Demo ต้องเลือกอย่างชัดเจนผ่าน `/?demo=true` หรือปุ่ม `เข้าโหมด Demo` และเก็บ flag ใน localStorage เพื่อ reload ต่อได้ โดย account session มี precedence เหนือ Demo. เมื่อ auth backend unavailable ทั้ง route loader และ hydration guard จะ honor explicit หรือ stored Demo แต่ยังส่งผู้ใช้ที่ไม่มี Demo flag ไป Login. Dashboard shell มีลิงก์ `เข้าสู่ระบบ` สำหรับออกจาก Demo ไปสมัคร/เข้าสู่บัญชี. การ guard เป็น client-side/hydration-safe เพื่อไม่เรียก browser Supabase client ระหว่าง SSR และไม่มีการแก้ migration/DB. ModelVoteCard/Login tabs มี ARIA relationships ที่ตรวจใน browser แล้ว และ `.env` ถูก ignore โดยใช้ `.env.example` ที่ไม่มีค่า secret เป็น template. ห้ามใช้ fixed credentials หรือ commit secret ลง repository.

## Dual-mode implementation state และ product decision — 28 Aug 2026

- `Cloud Mode` คง Yahoo Finance Chart `GC=F` แบบ delayed และ same-instrument frozen `GC=F` DEMO fallback ตาม contract เดิม
- `Cloud Mode` เป็น product focus เดียวสำหรับรอบพัฒนาถัดไป โดยต้องรักษา closed-candle, freshness, 240-candle warmup, source metadata และ no-look-ahead contract
- `XM Live Mode` ในโค้ดปัจจุบันยังอ่าน `GOLD` `15m` จาก `xm_market_candles`; bridge ใช้ `copy_rates_from_pos(..., 1, ...)` เพื่อไม่ส่ง current/open bar และไม่เรียก trade API แต่เส้นทางนี้ถูกพักและจะถูกซ่อนเป็น `กำลังพัฒนา`
- XM mode ไม่ auto-fallback ไป Yahoo/GC=F หรือ XAUEUR เมื่อ bridge offline, stale หรือ warming. ผู้ใช้เป็นผู้กดกลับ Cloud Mode เอง
- `marketMode` ถูกเก็บใน immutable `Prediction` snapshot เพื่อไม่ให้ History จับคู่ XM prediction กับ Yahoo/XAUEUR settlement; XM settlement ยังปิดจนกว่าจะมี source-faithful outcome path
- Supabase migration/RLS/RPC และ Edge Functions `gold-api-collector`/`xm-bridge-ingest` ถูก deploy แล้วและผ่าน authenticated smoke test; synthetic XM smoke candle ถูกลบด้วย forward migration แล้ว แต่ไม่มี real XM terminal/scheduler และไม่ถือว่า XM Live พร้อมใช้งาน

## Stack

- **Frontend/SSR**: TanStack Start v1 (React 19
  ) + Vite 8, Tailwind CSS v4 (`src/styles.css`)
- **Backend**: managed Supabase โปรเจกต์ GoldCompass — Auth + Postgres + RLS + Edge Functions; server logic ใช้ `createServerFn` (ไฟล์ `*.functions.ts`)
- **Deployment**: GitHub `main` → Vercel production; Supabase URL/publishable/secret environment variables ถูกตั้งบน Vercel และ production redeploy ผ่านสถานะ Ready
- **AI**: Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1`) ผ่าน Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`), model ที่ใช้: `google/gemini-3.7-flash`
- **Charts**: SVG วาดเอง ไม่มี chart library

Yahoo read-only feed เป็น active product path: server function เรียก Yahoo Chart `GC=F` แบบ delayed ด้วย timeout/cache/validation และ Home อ่านผ่าน normalized feed; validation/warmup/rate-limit ไม่ผ่านจะ fallback เป็น frozen `GC=F` ที่ติดป้าย DEMO. XM bridge และ Gold API/XAUEUR path คงอยู่เป็น paused/legacy compatibility เท่านั้น; ห้ามให้ flow ปกติตีความว่าเป็น live source ที่พร้อมใช้ และ live settlement ยังปิดอยู่

## สถานะข้อมูลปัจจุบัน

| ส่วน                     | สถานะ                                               | แหล่ง                                                                                                               |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| ราคา Market หลัก         | **Cloud Yahoo GC=F delayed / frozen GC=F fallback** | `getYahooMarketFeed`; ผ่าน normalized validation และใช้เฉพาะ closed M15 candles |
| XM GOLD M15              | **PAUSED — จะซ่อนเป็นกำลังพัฒนา**                  | implementation ยังอยู่ที่ `getXmMarketFeed` → `xm_market_candles`; ไม่มี real terminal/scheduler |
| ข่าว ECB/Fed (RSS)       | **LIVE**                                            | `src/lib/news/sources.server.ts`                                                                                    |
| Macro (BLS/Eurostat/ECB) | **LIVE**                                            | `src/lib/news/sources.server.ts`                                                                                    |
| ข่าวทั่วไป GDELT         | **OPTIONAL LIVE**                                   | query สั้น + timeout 8 วินาที; error ไม่หยุด pipeline และไม่ cache ผลล้มเหลว                                        |
| AI News Interpretation   | **LIVE**                                            | `src/lib/news/interpret.server.ts`                                                                                  |
| AI Analyst อธิบายสัญญาณ  | **LIVE**                                            | `src/lib/ai.functions.ts`                                                                                           |

## Pipeline หลัก (ห้ามพลิกทิศ)

```text
active Cloud market snapshot (Yahoo GC=F delayed หรือ same-instrument frozen demo) + news (จริง/เดโม)
  → 5 voting models (trend, momentum, technical, news, volatility)
  → ensemble (วิเคราะห์แยก ห้ามโหวต/ห้าม override)
  → forecast engine (5 scenarios)
  → quality gate (consensus/index.ts) = Final Signal ตัวเดียว
  → narrative
```

## ไฟล์สำคัญตามชั้น

### Types & Pipeline

- `src/lib/types.ts` — types ทั้งหมด: Candle, ModelVote, NewsSnapshot (มี `interpretation?`, `live`, `errors`), Prediction (มี `newsSnapshot`), AiExplanation
- `src/lib/analysis.ts` — ฟังก์ชัน `analyze(asOf, settings, liveNews?, provider?)` จุดรวม pipeline ทางเดียว; provider ปัจจุบันถูกส่งเข้ามาแบบ read-only
- `src/lib/indicators/index.ts` — EMA, RSI, MACD, ATR, pivots (ต้องการ warmup ≥ 200 แท่ง)
- `src/lib/models/*.ts` — โมเดลโหวต 5 ตัว; `models/news.ts` ลด confidence ถ้าข่าว stale/provider ล่ม/ไม่มี interpretation
- `src/lib/consensus/index.ts` — Quality Gate เท่านั้นที่ตัดสิน Final Signal
- `src/lib/ensemble/index.ts` — ensemble commentary (แยกจากโหวต)
- `src/lib/forecast/engine.ts` — 5 scenarios จาก EMA/ATR/S-R + seeded random; `firstFutureCandleTime()` กัน forecast timestamp ย้อนก่อน `asOf` เมื่อมี missing interval (ไม่ใช่ random ล้วน)
- `src/lib/scoring.ts` — scoring contract version, readiness, `scorePrediction`, per-model scores, calibration และ `computeStats`
- `src/lib/settlement.ts` — pure settlement readiness/evaluation และ worker-safe job contract; settlement กรอง candle ที่เวลาไม่มากกว่า `asOf`, ตรวจ symbol/provider symbol, OHLC, order, duplicate และ contiguous `intervalMs` ก่อน scoring; timeout/invalid payload = not ready
- `src/lib/save-queue.ts` — serial latest-save queue สำหรับ settings persistence และ error ordering
- `src/lib/pilot.ts` — chronological tuning/evaluation split, Wilson interval และ pilot eligibility

### Market (Cloud Yahoo GC=F active; XM MT5 GOLD paused)

- `src/lib/market/provider.ts` — generic read-only provider interface, timeframe-to-ms map และ minimum warmup constant
- `src/lib/market/frozen-provider.ts` — legacy XAUEUR JSON fixture สำหรับ historical regression/compatibility
- `src/lib/market/yahoo-frozen-provider.ts` — same-instrument GC=F Yahoo snapshot สำหรับ explicit DEMO fallback
- `src/lib/market/assets.ts` — registry ของ asset/ticker/timeframe และ limitations; เปิดเฉพาะ combination ที่ validate แล้ว
- `src/lib/market/contract.ts` — normalized read-only contract, OHLC/closed-candle/freshness/order/future-timestamp validation, runtime `complete` boolean guard และ 60s clock-skew tolerance
- `src/lib/market/yahoo.ts` — pure Yahoo Chart parser, range policy, closed/future/duplicate/OHLC/symbol validation และ delayed metadata
- `src/lib/market/yahoo.test.ts` — Yahoo payload, range และ validation regression tests
- `src/lib/market/twelvedata.ts` — legacy pure parser ที่เก็บไว้เพื่อ historical regression เท่านั้น; ไม่ถูก import ใน active runtime และไม่ยิง API
- `src/lib/market/feed-provider.ts` — แปลง validated feed เข้า provider interface ให้ analysis ใช้ข้อมูล source เดียวกัน
- `src/lib/market/goldapi.ts` — pure parser สำหรับ response `XAU`/`EUR`/positive price/UTC `updatedAt`, freshness และ UTC M15 bucket
- `src/lib/market/readiness.ts` — readiness policy: 240 closed valid fresh candles ก่อน LIVE; 239 ยัง fallback
- `src/lib/market/xm.ts` — **paused implementation**: strict XM bridge payload/row parser, GOLD/M15/closed/UTC/OHLC/order/future guards และ source-faithful feed builder
- `src/lib/market/mode.ts` — Cloud/XM mode storage parser, labels และ instrument copy; รอบ UX ถัดไปต้องทำให้ XM ไม่ใช่ active selection
- `src/lib/market.functions.ts` — active `getYahooMarketFeed` server-only fetch/cache/timeout/health/fallback; `getXmMarketFeed` และ `getGoldApiMarketFeed` คงไว้เป็น paused/legacy code path; ไม่เรียก provider จาก browser
- `bridge/xm_mt5_bridge.py` — **paused** read-only PC bridge; ห้ามตั้ง terminal/PC server/scheduler เพิ่มจนกว่า product decision จะเปลี่ยน
- `supabase/functions/xm-bridge-ingest/index.ts` — deployed แต่ **paused** POST-only shared-secret endpoint; ไม่มี real bridge เรียกใช้งานต่อเนื่อง
- `supabase/migrations/20260828100000_xm_mt5_market_data.sql` — deployed append-only XM GOLD M15 table, RLS/grants, immutable trigger และ idempotent/strict ingestion RPC
- `supabase/functions/gold-api-collector/index.ts` — POST-only authenticated collector, timeout 8 วินาที, schema/freshness guard และ service-role RPC ingest; cache guard อย่างน้อย 30 วินาที
- `src/lib/market/goldapi.test.ts`, `src/lib/market/readiness.test.ts` — parser, invalid/stale/future, UTC bucket และ 239/240 regression tests
- `TWELVEDATA_SETUP.md`, `TWELVEDATA_RESEARCH.md`, `TWELVEDATA_PRICING_CHECK.md` — เอกสารเดิมทำเครื่องหมาย `DEPRECATED / REPLACED` และเก็บไว้เป็น historical audit
- `MARKET_PROVIDER_RESEARCH.md` — Yahoo Chart/GC=F trade-offs เทียบ Gold API, MT5 Python bridge และ OANDA official candle contract
- `YAHOO_SETUP.md` — runbook endpoint, interval policy, cache/fallback, verification และ XM non-equivalence warning

### News (ของจริง)

- `src/lib/news/provider.ts` — interface NewsProvider
- `src/lib/news/frozen-news.ts` — demo provider + Time Machine masking (actual=null จนกว่าจะถึงเวลา)
- `src/lib/news/sources.server.ts` — fetch จริง: GDELT optional (query สั้น, timeout 8s), Fed RSS, ECB RSS, BLS API, Eurostat HICP และ ECB Data Portal; provider health มี version/status/error metadata
- `src/lib/news/keywords.ts` — คัดกรองความเกี่ยวข้อง + tag (gold_up/down, eur_up/down)
- `src/lib/news/normalize.ts` — dedupe + mask อนาคต
- `src/lib/news/build-snapshot.ts` — ประกอบ NewsSnapshot จากข่าวจริง + fallback
- `src/lib/news/interpret.server.ts` — AI อ่านข่าว → JSON schema เดิมเพื่อ compatibility; payload และ supporting-ID guard รับเฉพาะ headline/event ที่เปิดเผยและไม่ล้ำ `asOf`, โดยไม่ใช้ field เดิมเพื่ออ้าง provider/ราคา
- `src/lib/news.functions.ts` — `getNewsSnapshot` server fn, cache successful snapshot 60 นาทีด้วย live/historical + exact `asOf` key และ content-hash กันเรียก AI ซ้ำ; future event actual ถูก mask ก่อน build/AI; optional GDELT failure ไม่ทำให้ required snapshot stale
- `src/lib/news/normalize.test.ts`, `build-snapshot.test.ts`, `sources.server.test.ts`, `interpret.server.test.ts` — resilience, no-look-ahead, bounded GDELT และ AI guard regression

### Cloud persistence (Supabase)

- `SUPABASE_PHASE0_RUNBOOK.md` — runbook/preflight เดิม; migrations ถูก apply บน GoldCompass แล้ว แต่ pgTAP remote suite ยัง pending
- Tables: `predictions` (immutable — trigger `enforce_prediction_lock` ห้ามเขียนทับและห้ามเปลี่ยน `user_id`; `marketMode` อยู่ใน snapshot), `prediction_results`, `app_settings`, legacy `market_price_samples`/`market_candles` และ `xm_market_candles` (append-only GOLD M15 closed OHLC)
- `src/lib/auth.ts` — `getAnonymousUserId()` สำหรับ Demo และ email/password helpers (`getAuthSession`, sign-in, update password, sign-out) พร้อม error metrics โดยไม่บันทึก email/token/user ID
- `src/lib/home-access.ts` — pure policy helper สำหรับ account/Demo/Login decision; anonymous session อย่างเดียวไม่ bypass Login
- `src/lib/cloud-store.ts` — list/save/attachOutcome/settings + `migrateLocalPredictions()` อิงตาม `user_id` จาก Supabase Auth (legacy `device_id` เหลือเป็น telemetry metadata เท่านั้น ไม่ใช่ security boundary)
- `src/lib/device.ts` — legacy `device_id` ใน localStorage (คงไว้เฉพาะ client telemetry ไม่เกี่ยวกับ auth/RLS)
- `supabase/migrations/20260827110000_phase0_auth_and_ownership.sql` — forward-only migration เพิ่ม `user_id`, ปรับ RLS per-operation `(select auth.uid()) = user_id`, แทนที่ PK เดิมของ `app_settings`, ห้าม cross-owner result, ป้องกันการแก้ `user_id`, และ revoke สิทธิ์ unauthenticated `anon`
- `supabase/migrations/20260827130000_gold_api_market_data.sql` — legacy forward-only XAUEUR market storage, unique idempotency, UTC bucket, transactional RPC, RLS/grants และ closed-candle immutability
- `supabase/migrations/20260828100000_xm_mt5_market_data.sql` — XM GOLD M15 append-only storage, strict contract RPC, RLS/grants และ immutable rows
- `supabase/migrations/20260828110000_remove_xm_smoke_test_candle.sql` — forward cleanup ของ synthetic XM smoke candle โดย match timestamp/OHLC แบบเจาะจง; apply แล้วบน GoldCompass
- `src/integrations/supabase/*` — ไฟล์ auto-gen **ห้ามแก้** (client.ts, client.server.ts, auth-middleware.ts, auth-attacher.ts, types.ts)
- `LOVABLE_APPLY_MIGRATION_PROMPT.md` — prompt สำหรับให้ Lovable ตรวจและ apply migrations/RLS/pgTAP/Gold API collector บน Supabase Cloud โดยไม่ reset หรือใช้ destructive change
- `GOLD_API_SETUP.md` — runbook migration, Edge Function, Vault/Cron, smoke test, warmup และ rollback

### AI Analyst (อธิบายผลหน้าแรก)

- `src/lib/observability.ts` — bounded structured operational metrics โดยไม่เก็บ secrets/PII
- `src/lib/alerts.ts`, `src/components/app/AlertPanel.tsx` — in-app alerts แบบไม่สร้าง urgency และไม่มี external channel
- `src/components/ui/slider.tsx` + `src/components/app/SettingsFields.tsx` — thumb-level aria-label สำหรับ keyboard/screen-reader settings workflow
- `WORKFLOW_FINDINGS.md` — ผล randomized UI smoke tests และบัคที่แก้แล้ว
- `src/lib/ai-gateway.server.ts` — provider helper + run-id propagation
- `src/lib/ai.functions.ts` — `explainAnalysis` (system prompt ไทย, ห้าม AI override engine), fallback = `templateExplanation` ใน `src/lib/ai-input.ts`

### Tests & Verification

- `src/lib/auth.test.ts` — Vitest unit tests: anonymous session reuse, concurrency in-flight promise deduplication, email/password sign-in/sign-out, error handling และ missing user validation
- `src/lib/home-access.test.ts` — regression tests สำหรับ default Login, explicit/stored Demo, auth-failure Demo preservation, anonymous-session policy และ account precedence
- `src/lib/cloud-store.test.ts` — Vitest unit tests: การ query/insert/delete/upsert ผ่าน `user_id` และ onConflict บน `user_id`
- `src/lib/scoring.test.ts` — scoring regression: horizon ว่าง/ไม่ครบ, BUY, SELL, WAIT, ATR edge case, score version, model outcomes และ calibration
- `src/lib/randomized-workflow.test.ts` — seeded randomized analyze/forecast/settlement invariants และ no-look-ahead workflow regression
- `src/lib/save-queue.test.ts` — rapid settings update serialization และ stale failure suppression
- `src/lib/settlement.test.ts`, `src/lib/market/contract.test.ts`, `src/lib/alerts.test.ts`, `src/lib/observability.test.ts`, `src/lib/pilot.test.ts` — settlement, market boundary, alerts, metrics และ pilot protocol
- `src/lib/news/sources.server.test.ts`, `src/lib/news/build-snapshot.test.ts`, `src/lib/news.functions.test.ts` — optional provider, stale/fallback และ cache contract
- `src/lib/market/goldapi.test.ts`, `src/lib/market/readiness.test.ts` — Gold API parser/freshness/UTC bucket และ 239/240 warmup gate
- `src/lib/forecast/engine.test.ts` — input snapshot เดิมต้องได้ forecast/scenario เดิม และ weights รวม 100
- `src/lib/ai-input.test.ts` — Final Signal ที่ส่งให้ AI มาจาก Quality Gate และ template fallback deterministic เมื่อเวลาเดิม
- `supabase/tests/database.test.sql` — pgTAP test suite: existing ownership/immutability, legacy market assertions และ XM RLS denial, source/OHLC/order/duplicate/future/open guards, idempotency และ append-only immutability
- `src/lib/market/xm.test.ts`, `src/lib/market/mode.test.ts`, `bridge/test_xm_mt5_bridge.py` — XM payload/read-row, mode preference และ bridge position-1/read-only regression tests
- `src/lib/consensus/index.test.ts` — regression tests ของ Quality Gate: ออก BUY เมื่อผ่านครบ, บังคับ WAIT ก่อนข่าวแรง, และไม่ออกสัญญาณเมื่อเสียงแตก
- `src/lib/time-machine.test.ts` — regression tests กัน look-ahead ของแท่งราคา ข่าว และ actual ของ economic events
- คำสั่งหลัก: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`; bridge tests: `python3 -m unittest discover -s bridge -p 'test_*.py'`
- Remote migration history บน GoldCompass ตรงกับ local ทั้ง 8 migrations และ `supabase db lint --linked --level warning` ไม่พบ schema error; pgTAP suite ยังต้องรันแยกตาม runbook

### UI

- `src/routes/index.tsx` — Home auth guard + hydration-safe `HomeGate`; explicit หรือ stored Demo ยังเข้า Demo ได้เมื่อ auth backend unavailable แต่ผู้ใช้ปกติยังถูกส่ง Login; SettingsSheet ใช้ latest-save queue เดียวกับ Settings route; **ปัจจุบันยังมี mode switch Cloud/XM และนี่คือจุดที่ต้องแก้รอบ UX ถัดไปให้ XM แสดงเป็นกำลังพัฒนา**; status copy แยก latest accepted closed-candle timestamp จาก response-receipt time; news query ใช้ exact `asOf`
- `src/routes/news.tsx`, `history.tsx`, `history.$id.tsx`, `performance.tsx`, `settings.tsx`, `guide.tsx`, `login.tsx` — active pages use mode-aware/generic product copy; History labels XM provenance and blocks cross-source settlement; Performance shows locked source metadata
- `src/components/app/*` — SignalHero, CandleChart (SVG, forecast zone ~45%), NewsPanel (มี AI block + source links, mobile-safe event rows และ status `LIVE`/`STALE`/`DEMO`), GatePanel, ModelVoteCard (expandable พร้อม `aria-controls`/hidden panel), EnsemblePanel, WhyPanel, TimeMachineBar, AiAnalystPanel และ AppShell ที่มีทางไป Login จาก Demo
- `src/routes/login.tsx` — Login ด้วย email/password เท่านั้น, authenticated-session panel, logout, friendly auth errors และทางเลือกเข้า Demo; ไม่มีหน้า/ปุ่มสมัครบัญชี
- `src/routes/settings.tsx` — ตั้งค่าเกณฑ์คุณภาพและส่วนเปลี่ยนรหัสผ่านสำหรับบัญชีที่ Login อยู่; โหมด Demo จะแสดงทางไปหน้า Login แทนฟอร์มเปลี่ยนรหัสผ่าน
- `src/styles.css` — ธีม Warm Paper (oklch), ฟอนต์ IBM Plex Sans Thai

## กฎเหล็กที่ต้องรักษา

1. AI ทุกตัว **อธิบายเท่านั้น** ห้ามเดาราคา/แต่งข่าว/override Final Signal; ทุก AI call ต้องมี deterministic fallback
2. Time Machine: ห้ามเห็นข้อมูลหลัง `asOf` ทั้งราคา ข่าว และ actual ของ economic events
3. Prediction ที่ lock แล้ว immutable (บังคับที่ DB trigger) — เก็บ `newsSnapshot` + `AiExplanation` ณ เวลานั้นด้วย
4. เพิ่ม asset/timeframe ใหม่ได้เฉพาะผ่าน registry หลัง validate response, fallback fixture และ tests ครบ; ห้ามขยาย/เปิดใช้ MT5, PC server, scheduler หรือ trade path จนกว่าเจ้าของจะเปลี่ยน product direction อย่างชัดเจน
5. ไฟล์ `src/integrations/supabase/*` auto-gen ห้ามแตะ
6. หน้า public route loader ห้ามเรียก server fn ที่ต้อง auth (ใช้ useQuery ใน component แทน); Home guard ห้ามเรียก browser Supabase client ระหว่าง SSR

## งานค้างตามลำดับใหม่

1. **Cloud-first UX pass** — ซ่อน XM selection จาก flow หลักและแสดงเป็น `กำลังพัฒนา`; ทำให้ผู้ใช้แยกให้ออกระหว่าง historical closed candles, เส้นแบ่ง `asOf`, 5 forecast candles, Yahoo delayed, freshness และ Demo fallback
2. **Yahoo production hardening** — ตรวจ freshness/cache/fallback บน Vercel ต่อเนื่อง, ทำ error copy ให้ตัดสินใจได้ และยืนยันว่า active `GC=F/15m` ใช้ ≥240 completed candles โดยไม่ปน fixture/live source
3. **Source/instrument explanation** — อธิบายว่า `GC=F` ใช้เป็น directional proxy ของ broker `GOLD`/`XAUEUR` ได้ แต่ raw price, wick, basis, FX conversion, timezone และ session ไม่เท่ากัน
4. **Cloud settlement path** — ยังไม่มี source-faithful live outcome provider สำหรับปิดผล `GC=F`; ต้องออกแบบโดยรักษา symbol/timeframe/source/no-look-ahead contract
5. **Database verification remainder** — migrations และ Edge Functions deploy แล้ว; เหลือรัน pgTAP remote suite และบันทึกผลตาม runbook
6. **Auth operations** — ตรวจ Anonymous Sign-In, CAPTCHA/Turnstile, rate limit และ cleanup policy ก่อนเปิด Demo สาธารณะ; email/password users สร้างผ่าน Supabase Auth ไม่ insert `auth.users` ตรง ๆ
7. **XM/MT5** — พักแบบไม่มีกำหนด; เก็บ implementation/tests/migrations ไว้ แต่ไม่ตั้ง PC server, scheduler หรือแสดงเป็นฟีเจอร์พร้อมใช้
8. **GDELT/alerts** — GDELT เป็น optional bounded source แล้ว; ยังไม่มี external LINE/Telegram/email alerts มีเฉพาะ in-app alerts และ pilot reporting


## Integrated Yahoo + Red-Team hardening — 27 สิงหาคม 2026

การรวมรอบนี้สร้างบน `origin/main@438c2cf` และไม่ได้ merge branch Red-Team เก่าแบบกลไกตรง ๆ. หลักคือรักษา Yahoo Finance Chart → `GC=F` COMEX Gold Futures → `15m`, same-instrument frozen fallback, source metadata และ read-only boundary ไว้ แล้ว port เฉพาะ regression/hardening ที่ยังเข้ากับสถาปัตยกรรมปัจจุบัน

| Finding | สถานะเทียบ latest Yahoo main | การ port/adaptation | หลักฐาน |
|---|---|---|---|
| F-01 cache/asOf isolation | **STILL APPLICABLE** | เปลี่ยน server cache key และ Home/News React Query key เป็น exact `asOf`; ยังคง live/historical namespace และ TTL 60 นาที | `news.functions.test.ts`, Home/News route query keys |
| F-02 future event เข้า AI | **STILL APPLICABLE** | เพิ่ม `maskNewsEventsForAsOf`, pure `buildInterpretationPayload` และ visible-ID guard ที่รับเฉพาะ event/headline ก่อน `asOf` | `news.functions.test.ts`, `interpret.server.test.ts` |
| F-03 stale news แสดง LIVE | **NEEDS ADAPTATION** | คง `live=true` เพื่อบอกว่า source เป็นข่าวจริง แต่แยก presentation เป็น `ข่าวจริง (STALE)`; stale snapshot ไม่เข้า successful cache | `news/status.ts`, `NewsPanel.test.tsx`, `build-snapshot.test.ts` |
| F-04 settlement ข้อมูลเสีย | **NEEDS ADAPTATION** | ใช้ `provider.intervalMs` แทน M15 hard-code; ตรวจ source symbol, OHLC, order, duplicate, contiguous horizon และจับ timeout เป็น `not_ready` | `settlement.ts`, `settlement.test.ts`, History same-instrument provider selection |
| F-05 future candle/fetchedAt | **STILL APPLICABLE** | เพิ่ม 60 วินาที clock-skew tolerance ใน normalized market contract เพื่อปฏิเสธ timestamp อนาคตโดยไม่ทำลาย Yahoo server-observation semantics | `contract.ts`, `contract.test.ts`, Yahoo/market.functions suite |
| F-06 provider wording | **OBSOLETE ในรูปเดิม; NEEDS ADAPTATION สำหรับ active copy audit** | ไม่ port Twelve Data → Gold API เดิม; แก้ active route metadata, News, Guide, Login, Settings, root, trend, Performance และ GDELT identity ให้ truthful ต่อ Yahoo/GC=F; legacy parser/docs คงไว้เป็น compatibility | static scan + browser smoke `/`, `/login`, `/news`, `/guide`, `/settings`, `/performance` |
| F-07 explicit Demo/auth failure | **STILL APPLICABLE** | เมื่อ auth backend unavailable อนุญาตเฉพาะ `/?demo=true`; normal user ที่ไม่ขอ Demo ยังไป Login ตาม policy เดิม | `index.tsx`, `home-access.test.ts`, Home/Login browser smoke |

Full source verification ของ integrated state ณ 27 สิงหาคมผ่าน `npm test` 107 tests จาก 28 files, lint, typecheck, production build และ `git diff --check`. Browser smoke ตรวจ Home/explicit Demo, Login, History, prediction detail not-found, News, Performance และ Settings/Guide ใน local environment; ข้อความว่า Supabase/RLS และ production ยัง pending เป็นสถานะ ณ วันนั้นเท่านั้น—สถานะ deployment ปัจจุบันให้ยึดหัวข้อ Product direction, Stack และ Cloud persistence ด้านบน

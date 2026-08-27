# CODE MAP — XAUEUR Signal Lab

เอกสารนี้คือแผนที่โค้ดสำหรับนักพัฒนา/AI ตัวอื่น (เช่น Codex) ให้ต่องานต่อได้โดยไม่ต้องไล่อ่านทั้ง repo
แอป: เครื่องมือทดลองพยากรณ์ XAUEUR (ทองคำ/ยูโร) กรอบเวลา 15 นาที — เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน
แผนงานตามลำดับ dependency และเกณฑ์จบแต่ละ phase อยู่ที่ `ROADMAP.md`

## Implementation update — `main`

รอบนี้เพิ่ม measurement contract แบบ versioned (`scoreVersion: 1.0.0`) และผลประเมินแยก 5 voting models + Consensus โดย Ensemble ยังคงเป็น commentary; เพิ่ม readiness/idempotent settlement contract, Performance scoreboard แบบ Last 20/50/100/All, confidence calibration, sample-size warnings และ controlled pilot report พร้อม Wilson uncertainty

ชั้นข่าวทำ GDELT เป็น optional bounded request (timeout 8 วินาที), cache successful snapshots 60 นาทีโดยแยก live/historical key, เก็บ provider health/fallback reason และเพิ่ม tests สำหรับ normalize/cache/AI schema/id guard/no-look-ahead

ชั้นตลาดเพิ่ม normalized read-only contract และ frozen demo adapter สำหรับ OHLC, UTC timestamp, closed-candle, symbol/timeframe, source และ freshness validation; Twelve Data ต่อแบบ server-only สำหรับ `XAU/EUR` M15 แล้ว โดยยังไม่มีเส้นทางส่งคำสั่งซื้อขาย

เพิ่ม in-app alerts, structured observability events และ UI แสดง provider health/fetched time/fallback reason ทั้งหมดไม่มี external notification และไม่บันทึก secrets หรือ personal identifiers

Phase 0 database migration/pgTAP เพิ่ม result immutability และมี runbook แยกต่างหาก แต่ยังรอ execute บน Supabase environment ที่ยืนยันแล้ว

รอบล่าสุดเพิ่ม **Home auth guard**: `/` ตรวจ email/password session ฝั่ง browser และส่งผู้ใช้ที่ยังไม่ login ไป `/login`; Demo ต้องเลือกอย่างชัดเจนผ่าน `/?demo=true` หรือปุ่ม `เข้าโหมด Demo` และเก็บ flag ใน localStorage เพื่อ reload ต่อได้ โดย account session มี precedence เหนือ Demo. Dashboard shell มีลิงก์ `เข้าสู่ระบบ` สำหรับออกจาก Demo ไปสมัคร/เข้าสู่บัญชี. การ guard เป็น client-side/hydration-safe เพื่อไม่เรียก browser Supabase client ระหว่าง SSR และไม่มีการแก้ migration/DB. ModelVoteCard/Login tabs มี ARIA relationships ที่ตรวจใน browser แล้ว และ `.env` ถูก ignore โดยใช้ `.env.example` ที่ไม่มีค่า secret เป็น template. ห้ามใช้ fixed credentials หรือ commit secret ลง repository.

## Stack

- **Frontend/SSR**: TanStack Start v1 (React 19
) + Vite 8, Tailwind CSS v4 (`src/styles.css`)
- **Backend**: Lovable Cloud (Supabase) — DB + RLS; server logic ใช้ `createServerFn` (ไฟล์ `*.functions.ts`)
- **AI**: Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1`) ผ่าน Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`), model ที่ใช้: `google/gemini-3.7-flash`
- **Charts**: SVG วาดเอง ไม่มี chart library

เพิ่ม Twelve Data live feed แบบ optional: Home ขอ `XAU/EUR` interval `15min` timezone `UTC` ทุก 5 นาทีสำหรับการใช้งานส่วนตัว 1 tab; key อยู่ใน server secret `TWELVEDATA_API_KEY`, validation ไม่ผ่านจะ fallback Demo และ live settlement ยังปิดอยู่

## สถานะข้อมูลปัจจุบัน

| ส่วน | สถานะ | แหล่ง |
|---|---|---|
| ราคา Market | **OPTIONAL LIVE / DEMO fallback** | Twelve Data ผ่าน `src/lib/market.functions.ts`; fallback `src/data/xaueur-m15.json` |
| ข่าว ECB/Fed (RSS) | **LIVE** | `src/lib/news/sources.server.ts` |
| Macro (BLS/Eurostat/ECB) | **LIVE** | `src/lib/news/sources.server.ts` |
| ข่าวทั่วไป GDELT | **OPTIONAL LIVE** | query สั้น + timeout 8 วินาที; error ไม่หยุด pipeline และไม่ cache ผลล้มเหลว |
| AI News Interpretation | **LIVE** | `src/lib/news/interpret.server.ts` |
| AI Analyst อธิบายสัญญาณ | **LIVE** | `src/lib/ai.functions.ts` |

## Pipeline หลัก (ห้ามพลิกทิศ)

```text
snapshot (Twelve Data live หรือ frozen demo) + news (จริง/เดโม)
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
- `src/lib/settlement.ts` — pure settlement readiness/evaluation และ worker-safe job contract; settlement กรอง candle ที่เวลาไม่มากกว่า `asOf` ก่อน scoring
- `src/lib/save-queue.ts` — serial latest-save queue สำหรับ settings persistence และ error ordering
- `src/lib/pilot.ts` — chronological tuning/evaluation split, Wilson interval และ pilot eligibility

### Market (Twelve Data live แบบ optional + frozen demo fallback)
- `src/lib/market/provider.ts` — generic read-only provider interface, `M15_MS`, และ minimum warmup constant
- `src/lib/market/frozen-provider.ts` — อ่าน JSON ตรึง, `getCandlesUpTo(ts)` กัน look-ahead และใช้เป็น fallback
- `src/lib/market/contract.ts` — normalized read-only contract, OHLC/closed-candle/freshness/order validation และ runtime `complete` boolean guard
- `src/lib/market/twelvedata.ts` — pure parser สำหรับ response `XAU/EUR`/`15min`/UTC; กรองแท่งไม่ปิดและตรวจ symbol, OHLC, order, gap, stale
- `src/lib/market/feed-provider.ts` — แปลง validated feed เข้า provider interface ให้ analysis ใช้ข้อมูล source เดียวกัน
- `src/lib/market.functions.ts` — server-only fetch ผ่าน `TWELVEDATA_API_KEY`, timeout 8 วินาที, success-only cache, warmup/health/fallback; ห้ามย้าย key ไป client
- `src/lib/market/twelvedata.test.ts` — parser/closed-candle/UTC/order/no-look-ahead regression tests
- `TWELVEDATA_SETUP.md`, `TWELVEDATA_RESEARCH.md`, `TWELVEDATA_PRICING_CHECK.md` — วิธีตั้งค่า, canonical symbol/endpoint และ quota/เงื่อนไขที่ตรวจแล้ว
- `MARKET_PROVIDER_RESEARCH.md` — trade-off ของ MT5 Python bridge กับ OANDA official candle contract; MT5 ยังไม่ต่อ

### News (ของจริง)
- `src/lib/news/provider.ts` — interface NewsProvider
- `src/lib/news/frozen-news.ts` — demo provider + Time Machine masking (actual=null จนกว่าจะถึงเวลา)
- `src/lib/news/sources.server.ts` — fetch จริง: GDELT optional (query สั้น, timeout 8s), Fed RSS, ECB RSS, BLS API, Eurostat HICP และ ECB Data Portal; provider health มี version/status/error metadata
- `src/lib/news/keywords.ts` — คัดกรองความเกี่ยวข้อง + tag (gold_up/down, eur_up/down)
- `src/lib/news/normalize.ts` — dedupe + mask อนาคต
- `src/lib/news/build-snapshot.ts` — ประกอบ NewsSnapshot จากข่าวจริง + fallback
- `src/lib/news/interpret.server.ts` — AI อ่านข่าว → JSON {goldBias, eurBias, xaueurBias, confidence, keyDrivers, risks, supportingNewsIds/EventIds}; parse แบบทนทาน, guard id ที่ AI อ้างต้องมีจริง
- `src/lib/news.functions.ts` — `getNewsSnapshot` server fn, cache successful snapshot 60 นาที แยก live/historical + content-hash กันเรียก AI ซ้ำ; optional GDELT failure ไม่ทำให้ required snapshot stale
- `src/lib/news/normalize.test.ts`, `build-snapshot.test.ts`, `sources.server.test.ts`, `interpret.server.test.ts` — resilience, no-look-ahead, bounded GDELT และ AI guard regression

### Cloud persistence (Supabase)
- `SUPABASE_PHASE0_RUNBOOK.md` — preflight, staging-only deployment และหลักฐานที่ต้องบันทึก; production execution ยัง pending
- Tables: `predictions` (immutable — trigger `enforce_prediction_lock` ห้ามเขียนทับและห้ามเปลี่ยน `user_id`), `prediction_results`, `app_settings`
- `src/lib/auth.ts` — `getAnonymousUserId()` สำหรับ Demo และ email/password helpers (`getAuthSession`, sign-in, update password, sign-out) พร้อม error metrics โดยไม่บันทึก email/token/user ID
- `src/lib/home-access.ts` — pure policy helper สำหรับ account/Demo/Login decision; anonymous session อย่างเดียวไม่ bypass Login
- `src/lib/cloud-store.ts` — list/save/attachOutcome/settings + `migrateLocalPredictions()` อิงตาม `user_id` จาก Supabase Auth (legacy `device_id` เหลือเป็น telemetry metadata เท่านั้น ไม่ใช่ security boundary)
- `src/lib/device.ts` — legacy `device_id` ใน localStorage (คงไว้เฉพาะ client telemetry ไม่เกี่ยวกับ auth/RLS)
- `supabase/migrations/20260827110000_phase0_auth_and_ownership.sql` — forward-only migration เพิ่ม `user_id`, ปรับ RLS per-operation `(select auth.uid()) = user_id`, แทนที่ PK เดิมของ `app_settings`, ห้าม cross-owner result, ป้องกันการแก้ `user_id`, และ revoke สิทธิ์ unauthenticated `anon`
- `src/integrations/supabase/*` — ไฟล์ auto-gen **ห้ามแก้** (client.ts, client.server.ts, auth-middleware.ts, auth-attacher.ts, types.ts)
- `LOVABLE_APPLY_MIGRATION_PROMPT.md` — prompt สำหรับให้ Lovable ตรวจและ apply migrations/RLS/pgTAP บน Supabase Cloud โดยไม่ reset หรือใช้ destructive change

### AI Analyst (อธิบายผลหน้าแรก)
- `src/lib/observability.ts` — bounded structured operational metrics โดยไม่เก็บ secrets/PII
- `src/lib/alerts.ts`, `src/components/app/AlertPanel.tsx` — in-app alerts แบบไม่สร้าง urgency และไม่มี external channel
- `src/components/ui/slider.tsx` + `src/components/app/SettingsFields.tsx` — thumb-level aria-label สำหรับ keyboard/screen-reader settings workflow
- `WORKFLOW_FINDINGS.md` — ผล randomized UI smoke tests และบัคที่แก้แล้ว
- `src/lib/ai-gateway.server.ts` — provider helper + run-id propagation
- `src/lib/ai.functions.ts` — `explainAnalysis` (system prompt ไทย, ห้าม AI override engine), fallback = `templateExplanation` ใน `src/lib/ai-input.ts`

### Tests & Verification
- `src/lib/auth.test.ts` — Vitest unit tests: anonymous session reuse, concurrency in-flight promise deduplication, email/password sign-in/sign-out, error handling และ missing user validation
- `src/lib/home-access.test.ts` — regression tests สำหรับ default Login, explicit/stored Demo, anonymous-session policy และ account precedence
- `src/lib/cloud-store.test.ts` — Vitest unit tests: การ query/insert/delete/upsert ผ่าน `user_id` และ onConflict บน `user_id`
- `src/lib/scoring.test.ts` — scoring regression: horizon ว่าง/ไม่ครบ, BUY, SELL, WAIT, ATR edge case, score version, model outcomes และ calibration
- `src/lib/randomized-workflow.test.ts` — seeded randomized analyze/forecast/settlement invariants และ no-look-ahead workflow regression
- `src/lib/save-queue.test.ts` — rapid settings update serialization และ stale failure suppression
- `src/lib/settlement.test.ts`, `src/lib/market/contract.test.ts`, `src/lib/alerts.test.ts`, `src/lib/observability.test.ts`, `src/lib/pilot.test.ts` — settlement, market boundary, alerts, metrics และ pilot protocol
- `src/lib/news/sources.server.test.ts`, `src/lib/news/build-snapshot.test.ts`, `src/lib/news.functions.test.ts` — optional provider, stale/fallback และ cache contract
- `src/lib/forecast/engine.test.ts` — input snapshot เดิมต้องได้ forecast/scenario เดิม และ weights รวม 100
- `src/lib/ai-input.test.ts` — Final Signal ที่ส่งให้ AI มาจาก Quality Gate และ template fallback deterministic เมื่อเวลาเดิม
- `supabase/tests/database.test.sql` — pgTAP test suite: anon denial, user A/B isolation, cross-owner result denial, snapshot/user_id immutability, duplicate result rejection
- `src/lib/consensus/index.test.ts` — regression tests ของ Quality Gate: ออก BUY เมื่อผ่านครบ, บังคับ WAIT ก่อนข่าวแรง, และไม่ออกสัญญาณเมื่อเสียงแตก
- `src/lib/time-machine.test.ts` — regression tests กัน look-ahead ของแท่งราคา ข่าว และ actual ของ economic events
- คำสั่งหลัก: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`
- Database migration/pgTAP ยังต้องรันใน Supabase environment ที่ยืนยันแล้วตาม `SUPABASE_PHASE0_RUNBOOK.md`

### UI
- `src/routes/index.tsx` — Home auth guard + hydration-safe `HomeGate`; เมื่อผ่านแล้วแสดง Dashboard: Twelve Data/demo status → SignalHero → CandleChart → accordion (models/ensemble/gate/news); live feed refresh ทุก 5 นาทีสำหรับการใช้งานส่วนตัว 1 tab
- `src/routes/news.tsx`, `history.tsx`, `history.$id.tsx`, `performance.tsx`, `settings.tsx`, `guide.tsx`, `login.tsx`
- `src/components/app/*` — SignalHero, CandleChart (SVG, forecast zone ~45%), NewsPanel (มี AI block + source links และ mobile-safe event rows), GatePanel, ModelVoteCard (expandable พร้อม `aria-controls`/hidden panel), EnsemblePanel, WhyPanel, TimeMachineBar, AiAnalystPanel และ AppShell ที่มีทางไป Login จาก Demo
- `src/routes/login.tsx` — Login ด้วย email/password เท่านั้น, authenticated-session panel, logout, friendly auth errors และทางเลือกเข้า Demo; ไม่มีหน้า/ปุ่มสมัครบัญชี
- `src/routes/settings.tsx` — ตั้งค่าเกณฑ์คุณภาพและส่วนเปลี่ยนรหัสผ่านสำหรับบัญชีที่ Login อยู่; โหมด Demo จะแสดงทางไปหน้า Login แทนฟอร์มเปลี่ยนรหัสผ่าน
- `src/styles.css` — ธีม Warm Paper (oklch), ฟอนต์ IBM Plex Sans Thai

## กฎเหล็กที่ต้องรักษา

1. AI ทุกตัว **อธิบายเท่านั้น** ห้ามเดาราคา/แต่งข่าว/override Final Signal; ทุก AI call ต้องมี deterministic fallback
2. Time Machine: ห้ามเห็นข้อมูลหลัง `asOf` ทั้งราคา ข่าว และ actual ของ economic events
3. Prediction ที่ lock แล้ว immutable (บังคับที่ DB trigger) — เก็บ `newsSnapshot` + `AiExplanation` ณ เวลานั้นด้วย
4. ห้ามเพิ่มคู่เงิน/timeframe อื่น, ห้ามต่อ MT5 (จนกว่าเจ้าของจะสั่ง)
5. ไฟล์ `src/integrations/supabase/*` auto-gen ห้ามแตะ
6. หน้า public route loader ห้ามเรียก server fn ที่ต้อง auth (ใช้ useQuery ใน component แทน); Home guard ห้ามเรียก browser Supabase client ระหว่าง SSR

## งานค้างที่รู้แล้ว

- **GDELT เป็น optional แล้ว** — query สั้น, timeout 8 วินาที, error เป็น annotation และ News Model ลดความมั่นใจ; successful snapshot cache 60 นาทีโดยแยก live/historical key
- **Migration & DB Tests deployment** — migration SQL และ pgTAP 22 tests ของ Phase 0 เขียนเสร็จแล้ว รวม result immutability migration และ runbook; รอนำไป execute บน Supabase Dashboard/CLI ใน environment จริง
- **Anonymous Auth operations** — ต้องเปิด Anonymous Sign-In และกำหนด CAPTCHA/Turnstile, rate limit และ cleanup policy ใน Supabase ก่อนเปิดสาธารณะ
- Twelve Data ต่อแล้วแบบ optional read-only และ refresh ทุก 5 นาทีสำหรับ 1 tab; ต้องใส่ `TWELVEDATA_API_KEY` ใน Lovable server secrets และยืนยันว่า plan/key เปิด `XAU/EUR` intraday ได้จริง
- MT5/OANDA bridge ยังไม่ได้ต่อ และยังไม่มี live outcome provider สำหรับ settlement; frozen demo ยังคงเป็น fallback
- ยังไม่มี external LINE/Telegram/email alerts; มีเฉพาะ in-app alerts และ pilot protocol/reporting

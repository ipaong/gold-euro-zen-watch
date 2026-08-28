# Market Prediction Playground — Roadmap

อัปเดต: 28 สิงหาคม 2026

## หลักตัดสินใจ

คุณค่าของระบบนี้ไม่ใช่ “AI บอกให้ซื้อ” แต่คือ:

```text
Prediction → Lock → Wait → Reveal actual → Score → Measure → Improve
```

ดังนั้นต้องสร้างความน่าเชื่อถือของข้อมูลและการวัดก่อนต่อราคาจริง เพิ่ม alerts หรือขยาย UI

## สถานะปัจจุบัน

### ทำแล้วใน source branch

- Dashboard, News, History, Performance, Settings และ Guide ใช้งานเป็นโครงครบ
- Pipeline ราคา/ข่าว → 5 models → ensemble commentary → forecast → quality gate → narrative ยังคงทิศทางเดิม
- Scoring contract `1.0.0` มี readiness rule, per-model + Consensus outcomes, MAE/candle metrics, confidence calibration และ sample-size warnings
- Settlement contract แยก pure readiness/evaluation, manual reveal ใช้ได้ และ duplicate result retry ไม่ overwrite ผลเดิม
- Performance scoreboard รองรับ Last 20 / 50 / 100 / All และมี controlled pilot report แยก tuning/evaluation พร้อม Wilson interval
- GDELT เป็น optional bounded request timeout 8 วินาที; successful news cache 60 นาที แยก live/historical namespace ด้วย exact `asOf`, mask future actual ก่อน AI และเก็บ provider health/fallback reason
- AI news parser มี schema validation และ supporting-ID guard ที่รับเฉพาะข้อมูลก่อน/ถึง `asOf`; เพิ่ม normalize/cache/provider/no-look-ahead/stale-presentation regression tests
- เพิ่ม normalized read-only market contract + frozen demo adapters ตรวจ OHLC, closed candles, UTC order, missing interval, stale feed และ future timestamp tolerance; เปลี่ยน active path เป็น Yahoo Chart `GC=F` แบบ delayed พร้อม same-instrument frozen fallback และ health panel แล้ว
- เพิ่ม Dual-Mode: Cloud `GC=F`/Yahoo delayed และ XM Live `GOLD`/M15 จาก MT5 read-only bridge ผ่าน Supabase append-only store; user เลือก source เองและ XM offline/stale/warming ไม่ fallback ข้าม instrument
- เพิ่ม `marketMode` ใน immutable prediction snapshot, mode-aware Home/History/Disclaimer, XM settlement guard, strict XM payload/row parser, Edge Function shared-secret boundary และ bridge คู่มือ/automated tests
- เพิ่ม in-app alerts และ structured operational metrics โดยไม่มี external notification, trade execution หรือ secrets/PII ใน logs
- โค้ด Anonymous Auth (`src/lib/auth.ts`) และ `src/lib/cloud-store.ts` ผูกสิทธิ์และคัดกรองข้อมูลตาม `auth.uid()` / `user_id` เรียบร้อย
- เขียน forward-only migrations ด้าน ownership/RLS และ result immutability พร้อม runbook `SUPABASE_PHASE0_RUNBOOK.md`
- Vitest source suite ล่าสุดผ่าน 119 tests จาก 30 test files; รวม randomized workflow, settlement boundary, source matching, home-access policy, auth-failure Demo preservation, Gold API legacy parser/freshness, Yahoo parser timestamp semantics, asset registry, asset-aware news, exact-asOf cache, market readiness/fallback และ XM mode/parser coverage; Python bridge suite ผ่าน 3 tests
- Overnight hardening ยืนยันและแก้ Home auth-failure path ให้ honor stored Demo, ย้าย Home SettingsSheet ไป latest-save queue เพื่อกัน stale overwrite และแก้ timestamp copy ให้หมายถึง latest accepted closed candle; เพิ่ม regression tests และ local browser/mobile smoke evidence ใน `OVERNIGHT_BROWSER_NOTES.md`
- Roadmap hardening (28 ส.ค. 2026):
  1. News freshness: `/news` ดึง Cloud Yahoo market feed เป็น `asOf`, แสดง 3 เวลาแยกกัน (วิเคราะห์ ณ, ข่าวล่าสุดเผยแพร่เมื่อ, ดึงข้อมูลเมื่อ), เพิ่มปุ่ม refresh ข่าว และติดป้ายเตือน archive ไม่ครบ
  2. Time Machine proof UX: CandleChart มี banner จำลองเวลาติดกราฟ, แสดงวัน+เวลาบนแกน X เมื่อข้ามวัน, แสดง forecast window ชัดเจน, TimeMachineBar มี quick jump (-1 ชม., -6 ชม., เมื่อวาน) และแสดง timezone Asia/Bangkok
  3. Cloud-first UX pass: ปรับปุ่ม XM ใน MarketModeSelector เป็น disabled พร้อมป้าย `กำลังพัฒนา`, normalize stored 'xm' เป็น 'cloud', และปรับ status copy แยก historical candles, asOf, forecast candles ชัดเจน
  4. Yahoo hardening: MarketDataStatus แสดง candle count (`354/240 แท่ง ✓`), มี freshness warning (>30 นาที), เพิ่ม near-miss warming metric (`provider_warming_near_miss`), ปรับ warming copy ให้ระบุจำนวนแท่งที่ขาดอย่างชัดเจน
  5. Source explanation: เพิ่ม collapsible อธิบาย GC=F vs GOLD/XAUEUR บนหน้าแรก และเพิ่มหัวข้ออธิบายอย่างละเอียดใน `/guide`
  6. Cloud settlement & Inline reveal: ทำปุ่ม "เปิดเฉลย 5 แท่งจริง" บนหน้าแรกเมื่อมีแท่งจริงหลัง asOf พร้อมการ์ดสรุปผลคะแนน, CandleChart แสดง Forecast(ประ) และ Actual(ทึบ) เคียงข้างกันในแต่ละ slot, หน้า History Detail รองรับการ settle คำพยากรณ์จริงของ Yahoo GC=F ผ่าน getYahooMarketFeed และบันทึกลง Cloud ถาวร, พร้อม strict no-look-ahead auto-reset
  7. News GC=F alignment & Supabase Archive: ปรับสโคปน้ำหนักข่าวเน้น Gold/USD, Fed, DXY, Yields, Safe-Haven แทน EUR; สร้างตาราง `market_news_articles` บน Supabase รองรับ auto-archive ข่าวสด และให้ Time Machine ดึงข่าวย้อนหลังจริงจาก Supabase Archive
- Vitest suite ผ่าน 133 tests จาก 33 test files; lint ไม่มี error, typecheck และ production build ผ่านหลังแก้ไข; route-level build output แยก chunk ของ `login`, `history`, `performance`, `settings`, `news` และ `guide` ออกจาก entry; local browser smoke ครอบคลุม primary routes ที่ 360/412px หลัง hydration และ desktop-like viewport พร้อม Cloud/XM offline/reload/explicit-recovery evidence ใน `DUAL_MODE_BROWSER_NOTES.md`

### ความเสี่ยงและ blocker ที่ต้องแก้ก่อนเปิดใช้จริง

- Migrations และ pgTAP database tests เขียนเสร็จแล้ว แต่**ยังไม่ได้ deploy และรันจริงบน Supabase environment** เพราะ sandbox ไม่มี Supabase CLI/Docker และยังไม่มี environment ที่เจ้าของยืนยัน
- Anonymous Sign-In, CAPTCHA/Turnstile, rate limit และ cleanup policy ต้องตั้งค่าใน Supabase ก่อนเปิดสาธารณะ
- Yahoo Chart `GC=F` server read path และ frozen fallback อยู่ใน source แล้วแบบ read-only; ต้อง verify deployed runtime, public-endpoint availability/rate limit และ 240-candle warmup ใน environment จริง; Gold API/Supabase migration/collector ยังคง legacy สำหรับ XAUEUR และต้อง deploy แยกหากจะใช้
- XM Live source implementation, migration, RLS/RPC, Edge Function และ bridge ทำเสร็จใน source แต่ยังต้อง deploy migration/function, ตั้ง `XM_BRIDGE_SECRET`, ส่ง payload จาก MT5/XM `GOLD`, ตรวจ 240-candle warmup และตรวจราคากับ M15 บน terminal จริง
- การเปิดผลยังเป็น manual reveal; worker contract พร้อมแต่ยังไม่เปิด scheduler กับราคาเดโมหรือ XM outcome source เดิม
- LINE/Telegram/email ยังไม่ทำ เป็น backlog หลัง in-app alerts และข้อมูลจริงนิ่ง
- Pilot evaluation ยัง pending จนกว่าจะมี locked + settled predictions ตาม protocol

---

## Phase 0 — Trust & Safety Foundation (เริ่มก่อน)

### เป้าหมาย

ทำให้วงจร Prediction → Lock → Reveal → Score ตรวจสอบซ้ำได้ และให้ฐานข้อมูลบังคับการแยกข้อมูลจริง

### สถานะความคืบหน้า

1. ทำ checkpoint ของ baseline ปัจจุบัน [เสร็จแล้ว: commit `c5441ce` และ push แบบ commit ใหม่]
2. เปลี่ยนจาก random `device_id` เป็น Supabase Anonymous Auth [โค้ดเสร็จแล้ว: `src/lib/auth.ts`, `src/lib/cloud-store.ts`, `src/lib/auth.test.ts`]
   - [x] Helper `getAnonymousUserId()` พร้อม session reuse และ in-flight promise deduplication
   - [x] ใช้ `user_id` เป็น security boundary และคัดกรองข้อมูลทุกตาราง
   - [x] `app_settings` upsert บน `onConflict: "user_id"`
   - [x] ไม่มีการเรียก auth จาก SSR หรือ route loaders
3. เพิ่ม migration ด้าน ownership/RLS [ไฟล์ SQL เสร็จแล้ว: `supabase/migrations/20260827110000_phase0_auth_and_ownership.sql` และ `20260827120000_phase0_result_immutability.sql`]
   - [x] เพิ่ม `user_id uuid references auth.users(id) on delete cascade`
   - [x] แทนที่ primary key เดิมของ `app_settings` ด้วย surrogate id และ `UNIQUE (user_id)`
   - [x] Revoke สิทธิ์ unauthenticated `anon` และ Grant เฉพาะ operations ที่แอปใช้ให้ `authenticated`
   - [x] เพิ่ม RLS per-operation `(select auth.uid()) = user_id`
   - [x] `prediction_results` INSERT บังคับตรวจความเป็นเจ้าของของ prediction ที่อ้างอิง
   - [x] Trigger `enforce_prediction_lock()` และ `enforce_prediction_result_lock()` ล็อก snapshot, owner และผล settlement
   - [ ] **รอรันจริง**: นำ SQL migrations ไป execute บน Supabase Dashboard/CLI ตาม `SUPABASE_PHASE0_RUNBOOK.md`
4. เพิ่ม database tests [ไฟล์ SQL เสร็จแล้ว: `supabase/tests/database.test.sql`]
   - [x] เขียน pgTAP test suite 22 tests: user A/B isolation, anon denial, least privilege, own-row allow, cross-owner result denial, prediction/result immutability, duplicate result rejection และ cascade
   - [ ] **รอรันจริง**: รัน pgTAP tests บน DB environment เมื่อ deploy migration แล้ว (ไม่เคลมว่ารันแล้วจนกว่าจะได้ execute จริง)
5. เพิ่ม core regression tests [ส่วนที่อยู่ใน Phase 0 เสร็จแล้ว]
   - [x] Anonymous auth session reuse, concurrency, error, missing user (Vitest 7 tests)
   - [x] Cloud store user_id scoping, deletion, onConflict (Vitest 5 tests)
   - [x] Scoring: actual ว่าง/ไม่ครบ, BUY, SELL, WAIT และ ATR edge case
   - [x] Forecast determinism: snapshot เดิมได้ output เดิม, horizon และ weight invariants
   - [x] AI boundary/fallback: Final Signal จาก Quality Gate และ deterministic template fallback
6. ป้องกัน anonymous-auth abuse
   - [ ] กำหนด CAPTCHA/Turnstile, rate limit และแผน cleanup anonymous users ก่อนเปิดสาธารณะ
   - [x] เขียน preflight/staging runbook และไม่บันทึก secret ลง repo

### เกณฑ์จบ

- RLS tests แบบ allow/deny ผ่านครบ (บน DB จริงหลัง deploy)
- ผู้ใช้หนึ่งรายไม่สามารถเห็นหรือเปลี่ยนข้อมูลอีกรายผ่าน API โดยตรง
- scoring, immutability, forecast determinism และ AI fallback มี regression tests
- migration ที่ deploy จริงตรงกับ migration ใน Git
- test, lint, typecheck และ build ผ่าน

### Dependency

ไม่มี — ต้องจบ phase นี้ก่อนทำระบบวัดผล/ตลาดจริง

---

## Phase 1 — Measurement Integrity

### เป้าหมาย

ตอบได้อย่างซื่อตรงว่าแต่ละโมเดลและ Consensus แม่นแค่ไหน โดยไม่ทำให้ตัวอย่างน้อยดูน่าเชื่อถือเกินจริง

### งาน

1. กำหนด scoring contract และ version
   - สูตร direction, MAE, high/low error และ candle-direction accuracy
   - readiness rule: ต้องมีแท่งจริงครบกี่แท่งจึง settle ได้
   - idempotency: settle ซ้ำต้องไม่เปลี่ยนผลเดิม
2. เก็บผลแยกสำหรับ 5 models และ Consensus
   - Trend, Momentum, Technical, News, Volatility และ Consensus
   - Ensemble ยังคงเป็น commentary ไม่เพิ่มเป็น vote
3. สร้าง Performance scoreboard
   - Last 20 / 50 / 100 / All
   - BUY accuracy, SELL accuracy, WAIT frequency
   - confidence calibration เป็นช่วงคะแนน
   - จำนวนตัวอย่างและคำเตือนเมื่อ sample size ต่ำ
   - เปรียบเทียบโมเดลโดยไม่อ้างว่า scenario weights เป็น calibrated probabilities
4. แยก calculation ออกจาก UI
   - ให้สูตรคะแนนอยู่ใน domain layer
   - UI อ่านผลที่บันทึกแล้ว ไม่คำนวณนิยามใหม่คนละแบบ
5. ออกแบบ settlement interface
   - manual reveal ยังใช้ได้
   - เตรียม idempotent worker contract แต่ยังไม่เปิด scheduler กับราคาตรึง

### เกณฑ์จบ

- Scoreboard เปรียบเทียบ 5 models + Consensus ได้จากข้อมูล locked
- ทุกสถิติแสดง sample size และมี minimum-sample warning
- manual reveal กดซ้ำแล้วไม่ทำให้ข้อมูลหรือคะแนนเปลี่ยน
- สูตรคะแนนมี version และ tests

### สถานะ implementation

- [x] scoring contract, readiness, per-model results, scoreboard และ calibration อยู่ใน `src/lib/scoring.ts`
- [x] manual reveal ใช้ `src/lib/settlement.ts`; cloud duplicate result เป็น idempotent no-overwrite
- [x] source regression tests ผ่าน; database/real-user sample evaluation ยัง pending

### Dependency

Phase 0

---

## Phase 2 — News Resilience

### เป้าหมาย

ทำให้ข่าวเป็น input ที่ตรวจ freshness/reproducibility ได้ และไม่ทำให้ pipeline ไม่นิ่งเมื่อ GDELT ล่ม

### สถานะ implementation

- [x] GDELT optional, query สั้น, timeout 8 วินาที และ error annotation
- [x] cache successful snapshot 60 นาที แยก live/historical namespace ด้วย exact `asOf`; ไม่ cache required-provider failure
- [x] provider health, fetched time, stale state และ fallback reason แสดงใน `NewsPanel`
- [x] AI schema parsing, supporting-ID guard, future-event masking และ stale presentation มี unit tests

### งาน

1. ทำ GDELT เป็น optional provider
2. ลด query ให้สั้นและจำกัด timeout ประมาณ 8 วินาที
3. cache เฉพาะผลสำเร็จ 60 นาที โดยแยก live bucket กับ historical `asOf`
4. แสดง provider health, fetched time, stale state และ fallback reason
5. เก็บ provider/version/source ids ที่ใช้ไว้ใน locked snapshot
6. เพิ่ม tests
   - normalize/dedupe
   - cache hit/miss/expiry
   - provider บางตัวล่มแต่ pipeline ไม่พัง
   - ข่าวอนาคตและ actual event อนาคตไม่รั่ว
   - AI อ้างได้เฉพาะ news/event ids ที่มีอยู่จริง

### เกณฑ์จบ

- GDELT ล่มแล้วแอปยังวิเคราะห์ได้โดยลด confidence และบอกเหตุผลชัดเจน
- snapshot เก่าสามารถอธิบายได้ว่าใช้ข่าว/ผู้ให้บริการชุดใด
- tests ของ freshness, cache และ no-look-ahead ผ่าน

### Dependency

Phase 1 เพื่อให้วัดได้ว่าการเปลี่ยนข่าวส่งผลต่อคุณภาพจริงหรือไม่

---

## Phase 3 — Real Read-Only Market Data

### เป้าหมาย

เปลี่ยนจากราคาตรึงเป็นข้อมูล Yahoo Gold Futures `GC=F` 15m แบบ delayed โดยยังไม่มีเส้นทางส่งคำสั่งซื้อขาย และไม่อ้างว่าเท่ากับ XM XAUUSD/XAUEUR

### สถานะ implementation

- [x] ศึกษา official MT5/OANDA contracts และบันทึก trade-offs ใน `MARKET_PROVIDER_RESEARCH.md`
- [x] เพิ่ม normalized read-only contract, frozen adapter และ validation/no-look-ahead tests; runtime guard ตรวจ `complete` flag, future timestamp tolerance และ settlement กรอง/validate candle ที่ strictly after `asOf` ตาม provider interval/source
- [x] เพิ่ม Yahoo Chart parser/range policy: epoch timestamps, parallel OHLC, closed/future filtering, duplicate/order/OHLC/symbol validation และ delayed metadata
- [x] เพิ่ม asset registry และ active `GC=F/15m` selector; future assets/timeframes ยัง disabled จนกว่าจะมี response + fixture + tests ครบ
- [x] เพิ่ม Gold API parser/readiness เดิมไว้เป็น legacy compatibility: XAU/EUR schema, positive price, source timestamp freshness, UTC M15 bucket และ minimum 240-candle warmup
- [x] เพิ่ม Supabase migration สำหรับ append-only samples, unique updatedAt, transactional OHLC M15, RLS/grants และ closed-candle immutability
- [x] เพิ่ม `gold-api-collector` Edge Function: POST + collector secret, timeout, HTTP/schema/freshness validation, service-role RPC และ 30s provider cache guard
- [x] ต่อ Home dashboard ให้อ่าน closed Yahoo `GC=F` candles ผ่าน server function ทุก 1 นาที/เมื่อกด refresh และ fallback ไป same-instrument frozen snapshot เมื่อไม่ครบ/ค้าง/rate-limited/ล้มเหลว
- [x] prediction จาก live feed ถูกติดป้ายและไม่ถูก settlement ด้วย frozen demo
- [ ] Verify Yahoo delayed feed, public endpoint rate limit, deployment runtime และ 240-candle warmup ใน environment จริง
- [ ] Legacy Gold API/Supabase migration, Edge Function, Vault/Cron ยังต้อง apply/deploy เฉพาะกรณีต้องใช้ XAUEUR
- [ ] ยังไม่มี live outcome provider/automatic settlement หรือ MT5 bridge

### งาน

1. เลือก provider และนิยาม data contract
   - [x] Yahoo Chart: `GET /v8/finance/chart/GC%3DF?interval=15m&range=5d`, `symbol=GC=F`, delayed quote
   - [x] map source เป็น `yahoo-finance-gc=f` / version `1.0.0` และ instrument เป็น `GC=F` / `15m`
   - [x] เก็บ source/provider symbol/display name/timeframe/interval/delayed/fetchedAt ใน normalized feed
   - [x] ยืนยัน response shape จาก endpoint จริงแบบ passive; deployed smoke test และ rate-limit behavior ยัง pending
   - [x] Gold API mapping เดิมเก็บเป็น legacy compatibility ไม่ใช้เติมข้อมูลข้าม instrument
2. หากเลือก MT5 ให้ใช้สถาปัตยกรรม

   ```text
   MetaTrader 5 → Python read-only bridge → authenticated API → backend → app
   ```

3. เก็บข้อมูลย้อนหลังพอสำหรับ EMA200 warmup และ Time Machine
4. [x] ตรวจ freshness, missing candles, duplicate samples/candles และ timezone ใน parser, RPC และ normalized adapter
5. [ ] เปิด automatic settlement เมื่อมีแท่งจริงปิดครบ 5 แท่ง หลังมี live outcome source ที่เชื่อถือได้และ source/version policy
6. [ ] รัน shadow mode เปรียบเทียบ demo/live ก่อนเปิดให้ผู้ใช้เชื่อผลจริง
7. เพิ่ม integration/no-look-ahead tests ของ live provider

### เกณฑ์จบ

- ทุก prediction อ้างอิงแท่งที่ปิดแล้วและ source timestamp ชัดเจน
- settlement ใช้เฉพาะ 5 แท่งที่เกิดหลัง snapshot
- provider สดผ่าน missing/duplicate/timezone/no-look-ahead tests
- ไม่มี API หรือ UI สำหรับส่งคำสั่งเทรด

### Dependency

Phase 0 และ 1; Phase 2 ควรจบหรือมีข่าวสำรองที่เสถียร

---

## Phase 4 — UX, Performance & Observability

### เป้าหมาย

ทำให้มือใหม่เข้าใจผลภายในประมาณ 10 วินาที และทำให้ทีมเห็น failure/freshness ได้โดยไม่เปลี่ยนกฎการตัดสินใจ

### สถานะ implementation

- [x] แสดงสถานะ provider/fetched time/fallback และ label `DELAYED`/`DEMO`/`STALE`/`ERROR` ในพื้นที่ที่เกี่ยวข้อง; NewsPanel แยกข่าวจริง stale จาก LIVE และ active pages ใช้ Yahoo/GC=F copy
- [x] เพิ่ม structured metrics สำหรับ provider, AI fallback, stale feed, auth และ settlement
- [x] แก้ Fast Refresh false positives ของ app component และจัดการ UI primitive exports ผ่าน ESLint override โดยไม่แก้ Supabase generated files
- [x] route-level code splitting มีหลักฐานจาก production build ที่สร้าง route chunks แยก; [ ] Home entry หลักยังมีขนาดราว 522 kB จึงควรพิจารณา component-level splitting/งบ bundle ในรอบถัดไป
- [x] browser smoke รอบ integrated state ครอบคลุม Home/explicit Demo/Login/History/detail not-found/News/Performance/Settings/Guide และ fallback/error states; [ ] ยังไม่มีการตรวจด้วย screen reader จริงหรือ contrast audit แบบ dedicated tool

### งาน

1. ทดสอบข้อความและลำดับข้อมูลกับผู้ใช้มือใหม่
2. ทำ first-run explanation และสถานะ DEMO/LIVE/STALE ให้ชัด
3. code-split client chunk หลักที่เกิน 500 kB ตาม route/component
4. จัดการ Fast Refresh warnings โดยไม่แก้ไฟล์ auto-generated
5. เพิ่ม monitoring
   - provider failures/timeouts
   - AI fallback rate
   - settlement lag/failure
   - stale-market/news rate
6. ไม่ถอด Vite path plugin ที่ Lovable จัดการเอง จนกว่าจะมีแนวทาง upstream

### เกณฑ์จบ

- ผู้ใช้แยก historical/current/forecast และ DEMO/LIVE ได้ทันที
- primary client chunk เล็กลงและทุก route ยังทำงาน
- failure สำคัญมี metric/log ที่ตามสาเหตุได้
- build, typecheck, lint และ tests ผ่าน

### Dependency

ทำบางงานคู่ขนานได้ แต่ห้ามแทรกจนทำให้ Phase 0–1 ช้า

---

## Phase 5 — Controlled Pilot & Alerts

### เป้าหมาย

ทดลองใช้กับกลุ่มเล็ก วัดผลจริงตาม protocol ที่ล็อกไว้ แล้วค่อยเพิ่มการแจ้งเตือนที่ไม่สร้างความเร่งรีบเทียม

### สถานะ implementation

- [x] pilot protocol แยก tuning 30 / evaluation 50 จากขั้นต่ำ locked 80 รายการ
- [x] Wilson 95% interval, settlement completeness, warnings และ eligibility อยู่ใน `src/lib/pilot.ts`
- [x] in-app alerts สำหรับ signal changed, high-impact news, forecast/settlement states
- [ ] pilot evaluation จริงยัง pending เพราะยังไม่มี settled live dataset; dry-run ของ shuffled 80 predictions ยืนยัน chronological split tuning 30 + evaluation 50 และ Wilson metric ตาม protocol

### งาน

1. กำหนด pilot protocol ล่วงหน้า
   - ระยะเวลา/จำนวน prediction ขั้นต่ำ
   - metric หลักและเกณฑ์หยุด
   - แยก tuning set กับ evaluation set เพื่อลด overfitting
2. ติดตาม calibration, accuracy, WAIT rate, data failures และ settlement completeness
3. ปรับ threshold/model จากผลที่วัดได้ ไม่ปรับย้อนหลังให้ดูดี
4. เพิ่ม in-app alerts ก่อน
   - signal changed
   - high-impact news approaching
   - forecast ready for scoring/settled
5. LINE/Telegram/email เป็นงานภายหลังเมื่อ in-app alerts และข้อมูลจริงนิ่งแล้ว
6. คงข้อห้าม automatic trade execution

### เกณฑ์จบ

- มีจำนวนตัวอย่างถึงขั้นต่ำและรายงาน uncertainty/sample size
- ไม่มี data-isolation incident หรือ settlement ที่แก้ย้อนหลัง
- AI ยังอธิบายเท่านั้น และ Quality Gate ยังตัด Final Signal เพียงจุดเดียว
- ตัดสินใจ go/no-go จากผล pilot ที่กำหนดไว้ล่วงหน้า

### Dependency

Phase 3; Phase 4 แนะนำให้จบก่อนขยายผู้ใช้

---

## ลำดับงานถัดไปที่เลือกให้แล้ว

1. เจ้าของยืนยัน environment ที่ใช้ deploy และทดสอบ Yahoo Chart runtime
2. เปิด Home ใน deployed environment, ยืนยัน `DELAYED · Yahoo · read-only`, symbol `GC=F`, timestamp และ fallback reason
3. ตรวจ rate-limit/timeout/failure path และยืนยัน same-instrument frozen fallback ไม่ปน XAUEUR
4. รอ 240 completed Yahoo `GC=F/15m` candles หรือราว 2.5–3 วันทำการก่อนพิจารณา delayed feed เป็นแหล่งหลัก และเก็บ locked + settled predictions ตาม pilot protocol
5. ค่อยพิจารณา component-level bundle optimization, external alerts หรือ automatic settlement เมื่อ data integrity พร้อม

## ยังไม่ทำตอนนี้

- ต่อ MT5/OANDA หรือเปิด market API อื่นนอก Yahoo active path
- อ้างว่า Yahoo GC=F เป็นราคา XM หรือเปิดสถานะ LIVE ก่อนมี 240 closed candles และ deployed validation จริง
- scheduler settle อัตโนมัติกับข้อมูลเดโมหรือก่อนมี future outcome source/version contract
- LINE/Telegram/email alerts (in-app เท่านั้นในรอบนี้)
- เปิด asset/timeframe ใหม่ก่อนมี provider response, frozen fixture และ regression tests ครบ
- automatic trade execution
- ปรับโมเดลเพื่อไล่ตามผลย้อนหลังโดยไม่มี evaluation protocol

## เอกสารอ้างอิงด้าน security

- Supabase Anonymous Sign-Ins: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security

หมายเหตุ: ใช้ Grok เป็นความเห็นที่สองในการท้าทายลำดับ phase; Codex ตรวจข้อเสนอเทียบกับโค้ดและเอกสารทางการก่อนจัดทำ roadmap ฉบับนี้

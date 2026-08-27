# XAUEUR Signal Lab — Roadmap

อัปเดต: 27 สิงหาคม 2026

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
- GDELT เป็น optional bounded request timeout 8 วินาที; successful news cache 60 นาที แยก live/historical key และเก็บ provider health/fallback reason
- AI news parser มี schema validation และ supporting-ID guard; เพิ่ม normalize/cache/provider/no-look-ahead regression tests
- เพิ่ม normalized read-only market contract + frozen demo adapter ตรวจ OHLC, closed candles, UTC order, missing interval และ stale feed; ยังไม่มี live credential
- เพิ่ม in-app alerts และ structured operational metrics โดยไม่มี external notification, trade execution หรือ secrets/PII ใน logs
- โค้ด Anonymous Auth (`src/lib/auth.ts`) และ `src/lib/cloud-store.ts` ผูกสิทธิ์และคัดกรองข้อมูลตาม `auth.uid()` / `user_id` เรียบร้อย
- เขียน forward-only migrations ด้าน ownership/RLS และ result immutability พร้อม runbook `SUPABASE_PHASE0_RUNBOOK.md`
- Vitest source suite เดิมผ่าน 53 tests จาก 17 test files; randomized workflow เพิ่ม coverage ของ analyze/forecast/settlement และ latest-save queue
- Bug hunt พบและแก้ forecast timestamp ที่อาจไม่มากกว่า `asOf` เมื่อ missing interval และ Settings persistence race จาก fire-and-forget save; เพิ่ม regression tests และ browser smoke evidence ใน `WORKFLOW_FINDINGS.md`
- lint ไม่มี error และ typecheck ผ่านหลังแก้ไข

### ความเสี่ยงและ blocker ที่ต้องแก้ก่อนเปิดใช้จริง

- Migrations และ pgTAP database tests เขียนเสร็จแล้ว แต่**ยังไม่ได้ deploy และรันจริงบน Supabase environment** เพราะ sandbox ไม่มี Supabase CLI/Docker และยังไม่มี environment ที่เจ้าของยืนยัน
- Anonymous Sign-In, CAPTCHA/Turnstile, rate limit และ cleanup policy ต้องตั้งค่าใน Supabase ก่อนเปิดสาธารณะ
- ราคาจริง/MT5 ยังไม่ต่อ; contract ผ่าน fixture tests เท่านั้น และต้องมี provider/credential/bridge ที่เจ้าของอนุมัติ
- การเปิดผลยังเป็น manual reveal; worker contract พร้อมแต่ยังไม่เปิด scheduler กับราคาเดโม
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
- [x] cache successful snapshot 60 นาที แยก live/historical key; ไม่ cache required-provider failure
- [x] provider health, fetched time, stale state และ fallback reason แสดงใน `NewsPanel`
- [x] AI schema parsing และ supporting ID guard มี unit tests

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

เปลี่ยนจากราคาตรึงเป็นข้อมูล XAUEUR M15 จริง โดยยังไม่มีเส้นทางส่งคำสั่งซื้อขาย

### สถานะ implementation

- [x] ศึกษา official MT5/OANDA contracts และบันทึก trade-offs ใน `MARKET_PROVIDER_RESEARCH.md`
- [x] เพิ่ม normalized read-only contract, frozen adapter และ validation/no-look-ahead tests
- [ ] ยังไม่มี live provider/credential/bridge จึงยังไม่เคลม real market data หรือ automatic settlement

### งาน

1. เลือก provider และนิยาม data contract
   - OHLC, UTC timestamp, closed-candle status, spread/source metadata
   - mapping ชื่อ symbol ของ broker ให้เป็น XAUEUR ภายในระบบ
2. หากเลือก MT5 ให้ใช้สถาปัตยกรรม

   ```text
   MetaTrader 5 → Python read-only bridge → authenticated API → backend → app
   ```

3. เก็บข้อมูลย้อนหลังพอสำหรับ EMA200 warmup และ Time Machine
4. ตรวจ freshness, missing candles, duplicate candles และ timezone
5. เปิด automatic settlement เมื่อมีแท่งจริงปิดครบ 5 แท่ง
6. รัน shadow mode เปรียบเทียบ demo/live ก่อนเปิดให้ผู้ใช้เชื่อผลจริง
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

- [x] แสดงสถานะ provider/fetched time/fallback และ label demo/live ในพื้นที่ที่เกี่ยวข้อง
- [x] เพิ่ม structured metrics สำหรับ provider, AI fallback, stale feed, auth และ settlement
- [x] แก้ Fast Refresh false positives ของ app component และจัดการ UI primitive exports ผ่าน ESLint override โดยไม่แก้ Supabase generated files
- [ ] route/component code-splitting ยังเป็นงานต่อเนื่อง; browser smoke test ครอบคลุม dashboard/onboarding/settings/history/performance/news และแก้ slider thumb aria-label แล้ว

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
- [ ] pilot evaluation จริงยัง pending เพราะยังไม่มี settled live dataset

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

1. เจ้าของยืนยัน staging Supabase project และอนุมัติการ deploy migration จาก `SUPABASE_PHASE0_RUNBOOK.md`
2. รัน `supabase test db` จริงและบันทึกผลลง `MANUS_PROGRESS.md`
3. เลือกและอนุมัติ live market provider/bridge พร้อม credential policy ก่อนสร้าง adapter จริง
4. เก็บ locked + settled predictions ตาม pilot protocol แล้วค่อยตัดสิน go/no-go จาก evaluation set
5. ค่อยพิจารณา code-splitting, external alerts หรือ automatic settlement เมื่อ data integrity พร้อม

## ยังไม่ทำตอนนี้

- ต่อ MT5 หรือ market API จริงโดยไม่มี provider/credential/architecture approval
- scheduler settle อัตโนมัติกับข้อมูลเดโม
- LINE/Telegram/email alerts (in-app เท่านั้นในรอบนี้)
- เพิ่มคู่เงินหรือ timeframe
- automatic trade execution
- ปรับโมเดลเพื่อไล่ตามผลย้อนหลังโดยไม่มี evaluation protocol

## เอกสารอ้างอิงด้าน security

- Supabase Anonymous Sign-Ins: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security

หมายเหตุ: ใช้ Grok เป็นความเห็นที่สองในการท้าทายลำดับ phase; Codex ตรวจข้อเสนอเทียบกับโค้ดและเอกสารทางการก่อนจัดทำ roadmap ฉบับนี้

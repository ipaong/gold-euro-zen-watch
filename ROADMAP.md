# XAUEUR Signal Lab — Roadmap

อัปเดต: 27 สิงหาคม 2026

## หลักตัดสินใจ

คุณค่าของระบบนี้ไม่ใช่ “AI บอกให้ซื้อ” แต่คือ:

```text
Prediction → Lock → Wait → Reveal actual → Score → Measure → Improve
```

ดังนั้นต้องสร้างความน่าเชื่อถือของข้อมูลและการวัดก่อนต่อราคาจริง เพิ่ม alerts หรือขยาย UI

## สถานะปัจจุบัน

### ทำแล้ว

- Dashboard, News, History, Performance, Settings และ Guide ใช้งานเป็นโครงครบ
- Pipeline ราคา/ข่าว → 5 models → ensemble commentary → forecast → quality gate → narrative
- ราคาเดโมแบบตรึง, ข่าว/macro สด, AI interpretation/explanation พร้อม deterministic fallback
- Supabase เก็บ prediction snapshot แบบล็อก และเก็บผลจริงแยกหนึ่งครั้ง
- Build และ TypeScript ผ่าน
- Lint ไม่มี error เหลือ Fast Refresh warnings 7 จุด
- Regression tests 24 กรณีผ่าน: Quality Gate 3, Time Machine/no-look-ahead 3, Anonymous Auth 7, Cloud Store 5, Scoring 3, Forecast determinism 1 และ AI boundary/fallback 2
- โค้ด Anonymous Auth (`src/lib/auth.ts`) และ `src/lib/cloud-store.ts` ผูกสิทธิ์และคัดกรองข้อมูลตาม `auth.uid()` / `user_id` เรียบร้อย
- เขียนไฟล์ forward-only migration `supabase/migrations/20260827110000_phase0_auth_and_ownership.sql` (RLS per-operation, app_settings unique user_id, cross-owner result check, trigger lock user_id, revoke anon)
- เขียนชุดทดสอบ pgTAP `supabase/tests/database.test.sql` (20 tests: anon denial, least privilege, user A/B isolation, cross-owner denial, immutability, duplicate result rejection และ cascade)

### ความเสี่ยงที่ต้องแก้ก่อนเปิดใช้จริง

- Migration `20260827110000_phase0_auth_and_ownership.sql` และ pgTAP DB tests เขียนเสร็จแล้ว แต่**ยังไม่ได้ deploy และรันจริงบน Supabase environment** (ต้องนำ SQL ไป execute บน Supabase Dashboard หรือ CLI)
- ยังไม่มี test ของ news normalization และ AI schema parsing/id guard
- Performance ยังสรุป Consensus เป็นหลัก ไม่ได้เปรียบเทียบโมเดลทั้ง 5 อย่างครบถ้วน
- การเปิดผลยังต้องกดเอง และราคายังเป็นข้อมูลเดโม
- GDELT ล้ม/429/timeout ได้บ่อย แม้แอปรองรับ graceful failure แล้ว

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
3. เพิ่ม migration ด้าน ownership/RLS [ไฟล์ SQL เสร็จแล้ว: `supabase/migrations/20260827110000_phase0_auth_and_ownership.sql`]
   - [x] เพิ่ม `user_id uuid references auth.users(id) on delete cascade`
   - [x] แทนที่ primary key เดิมของ `app_settings` ด้วย surrogate id และ `UNIQUE (user_id)`
   - [x] Revoke สิทธิ์ unauthenticated `anon` และ Grant เฉพาะ operations ที่แอปใช้ให้ `authenticated`
   - [x] เพิ่ม RLS per-operation `(select auth.uid()) = user_id`
   - [x] `prediction_results` INSERT บังคับตรวจความเป็นเจ้าของของ prediction ที่อ้างอิง
   - [x] Trigger `enforce_prediction_lock()` ล็อกไม่ให้แก้ `user_id`
   - [ ] **รอรันจริง**: นำ SQL migration ไป execute บน Supabase Dashboard/CLI
4. เพิ่ม database tests [ไฟล์ SQL เสร็จแล้ว: `supabase/tests/database.test.sql`]
   - [x] เขียน pgTAP test suite 20 tests: user A/B isolation, anon denial, least privilege, own-row allow, cross-owner result denial, immutability, duplicate result rejection และ cascade
   - [ ] **รอรันจริง**: รัน pgTAP tests บน DB environment เมื่อ deploy migration แล้ว (ไม่เคลมว่ารันแล้วจนกว่าจะได้ execute จริง)
5. เพิ่ม core regression tests [ส่วนที่อยู่ใน Phase 0 เสร็จแล้ว]
   - [x] Anonymous auth session reuse, concurrency, error, missing user (Vitest 7 tests)
   - [x] Cloud store user_id scoping, deletion, onConflict (Vitest 5 tests)
   - [x] Scoring: actual ว่าง/ไม่ครบ, BUY, SELL, WAIT และ ATR edge case
   - [x] Forecast determinism: snapshot เดิมได้ output เดิม, horizon และ weight invariants
   - [x] AI boundary/fallback: Final Signal จาก Quality Gate และ deterministic template fallback
6. ป้องกัน anonymous-auth abuse
   - กำหนด CAPTCHA/Turnstile และแผน cleanup anonymous users ก่อนเปิดสาธารณะ

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

### Dependency

Phase 0

---

## Phase 2 — News Resilience

### เป้าหมาย

ทำให้ข่าวเป็น input ที่ตรวจ freshness/reproducibility ได้ และไม่ทำให้ pipeline ไม่นิ่งเมื่อ GDELT ล่ม

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

ไม่ต้องเลือกหลายอย่างพร้อมกัน ให้ทำตามนี้:

1. ตรวจและ checkpoint baseline/tests ที่ยังไม่ commit
2. ออกแบบ migration จาก `device_id` → `auth.uid()` พร้อม data-migration decision
3. เพิ่ม Supabase Anonymous Auth และ RLS tests
4. deploy migration ไป environment ทดสอบและพิสูจน์ cross-user deny
5. เพิ่ม scoring/immutability/determinism/AI-fallback tests

เมื่อห้าข้อนี้ผ่าน จึงเริ่ม Phase 1

## ยังไม่ทำตอนนี้

- ต่อ MT5 หรือ market API จริง
- scheduler settle อัตโนมัติกับข้อมูลเดโม
- LINE/Telegram/email alerts
- เพิ่มคู่เงินหรือ timeframe
- automatic trade execution
- ปรับโมเดลเพื่อไล่ตามผลย้อนหลังโดยไม่มี evaluation protocol

## เอกสารอ้างอิงด้าน security

- Supabase Anonymous Sign-Ins: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security

หมายเหตุ: ใช้ Grok เป็นความเห็นที่สองในการท้าทายลำดับ phase; Codex ตรวจข้อเสนอเทียบกับโค้ดและเอกสารทางการก่อนจัดทำ roadmap ฉบับนี้

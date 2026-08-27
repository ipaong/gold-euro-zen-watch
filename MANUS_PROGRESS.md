# Manus Progress Log — XAUEUR Signal Lab

อัปเดตล่าสุด: 27 สิงหาคม 2026
Branch: `manus/roadmap-phases-0-5`
Baseline: `main` ที่ `e6519f5` (`Secure anonymous ownership and add Phase 0 tests`)

## Milestone: Phase 0 review + source implementation

สถานะ: implementation อยู่ใน branch และยังไม่ commit ณ เวลาสร้าง log นี้

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

สถานะ: contract/fixture เท่านั้น; live provider pending approval/credential

- ศึกษา official MT5 `copy_rates_from` และ OANDA v20 candle contract; trade-offs อยู่ใน `MARKET_PROVIDER_RESEARCH.md`
- เพิ่ม normalized XAUEUR/M15 contract, OHLC validation, closed-candle-only, ordering, missing interval, UTC timestamp และ stale checks
- เพิ่ม frozen demo adapter; ไม่มี order/trade path และไม่อ้างว่า live

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
- Live XAUEUR provider/MT5 bridge ต้องมี architecture/credential approval; ปัจจุบันมีเฉพาะ normalized contract และ demo fixture
- Pilot evaluation ต้องรอข้อมูล locked/settled จริงตาม protocol

## Verification result — 27 สิงหาคม 2026

- `npm test`: ผ่าน 53 tests จาก 17 test files
- `npm run lint`: ผ่าน ไม่มี errors/warnings
- `npx tsc --noEmit`: ผ่าน
- `npm run build`: ผ่าน production build
- `git diff --check`: ผ่าน
- `supabase test db`: ยังไม่รัน เพราะ environment ไม่มี Supabase CLI/Docker และยังไม่มี staging project ref ที่เจ้าของยืนยัน

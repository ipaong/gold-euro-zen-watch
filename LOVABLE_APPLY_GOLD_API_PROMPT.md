# Prompt สำหรับให้ Lovable apply Gold API collector

โปรดทำงานกับ repository `ipaong/gold-euro-zen-watch` และ Supabase project ที่เชื่อมอยู่จริงเท่านั้น โปรดตรวจ environment และ migration history ก่อนเปลี่ยนแปลง ห้ามเดา project URL, project ref, secrets หรือสิทธิ์ของ environment

## เป้าหมาย

เปลี่ยน market-data runtime ของ XAUEUR M15 จาก Twelve Data เป็น Gold API แบบไม่ใช้ API key โดยให้ Edge Function ฝั่ง Supabase เรียก `GET https://api.gold-api.com/price/XAU/EUR` แล้วสะสม price samples และ aggregate เป็น closed OHLC M15 ใน Supabase แอปต้องอ่าน closed candles จาก Supabase ผ่าน server-only path เท่านั้น ห้ามให้ browser เรียก Gold API หรือรับ service-role credential

## ไฟล์ที่ต้องใช้

1. Apply migration แบบ forward-only จาก `supabase/migrations/20260827130000_gold_api_market_data.sql` หลัง migration เดิมตามลำดับ timestamp
2. Deploy `supabase/functions/gold-api-collector/index.ts` เป็น Edge Function ชื่อ `gold-api-collector`
3. คง parser/readiness/provider/UI/tests ตาม source ใน repository ได้แก่ `src/lib/market/goldapi.ts`, `src/lib/market/readiness.ts`, `src/lib/market.functions.ts`, `src/lib/market/feed-provider.ts`, `src/routes/index.tsx` และ tests ที่เกี่ยวข้อง
4. ใช้ `GOLD_API_SETUP.md` เป็น runbook หลัก และเก็บเอกสาร Twelve Data เดิมไว้ในสถานะ `DEPRECATED / REPLACED`

## ข้อห้ามด้าน database

ห้าม `supabase db reset`, `DROP TABLE`, `TRUNCATE`, destructive migration, การลบข้อมูลเดิม หรือการแก้/rewrite migration ที่ published แล้ว หาก migration apply ไม่ได้ให้หยุดตรงจุดนั้นและรายงาน error จริง ห้ามแก้ปัญหาด้วยการปิด RLS หรือ recreate table เพื่อกลบ schema drift

Migration ใหม่นี้ต้องสร้างและตรวจให้ครบ:

- `public.market_price_samples` สำหรับ append-only source samples
- unique idempotency key `(source, version, symbol, provider_updated_at)`
- `public.market_candles` สำหรับ source/version/symbol/timeframe/bucket เดียวต่อ UTC M15
- OHLC: open ราคาแรก, high สูงสุด, low ต่ำสุด, close ราคาล่าสุดใน bucket
- source/version contract `gold-api-xau-eur` / `1.0.0`, `XAUEUR` / `M15`
- RPC `public.ingest_gold_api_price(numeric, timestamptz, timestamptz)` แบบ transactional และ `SECURITY DEFINER` พร้อม `SET search_path = public`
- duplicate `updatedAt` ต้องเป็น no-op และห้ามเพิ่ม sample_count
- candle ที่ `is_closed = true` ห้ามเปลี่ยน OHLC, sample timestamps หรือ sample_count
- ตาราง market เปิด RLS และไม่มี grant สำหรับ `anon`/`authenticated`; ให้ service role ใช้เฉพาะ trusted server/Edge Function
- RPC execute ได้เฉพาะ `service_role`; ห้ามเปิด public ingest endpoint

## ข้อห้ามด้าน Edge Function และ secrets

ตรวจ HTTP status, JSON schema, `symbol=XAU`, `currency=EUR`, `price` เป็น finite positive number, `updatedAt` เป็น ISO-8601 ที่มี timezone และ freshness ไม่เกิน 5 นาที ใช้ timeout 8 วินาที และไม่เขียนข้อมูลที่ไม่ผ่าน validation

Function ต้องรับเฉพาะ POST และต้องตรวจ header `x-gold-api-collector-secret` เทียบกับ `GOLD_API_COLLECTOR_SECRET` ใน Function Secrets หากไม่ตรงให้ตอบ `401`; method อื่นให้ `405`; secret/runtime ขาดให้ `503`; upstream หรือ RPC ล้มเหลวให้ `502` โดยห้ามคืนหรือ log secret

ห้ามสร้างหรือ commit `TWELVEDATA_API_KEY`, Gold API key หรือ service-role key ใด ๆ ห้ามใช้ `VITE_` prefix กับ secret ห้ามแก้ไฟล์ `src/integrations/supabase/*` ซึ่งเป็น auto-generated และห้ามส่ง secret ใน response/client bundle

## Cron

ตั้ง Cron ให้เรียก Function ทุก 1 นาทีผ่าน `pg_cron` + `pg_net` และเก็บ project URL, publishable key และ collector secret ใน Supabase Vault หรือ secret manager ตามที่ project ใช้อยู่ อย่า hardcode ค่าจริงลง migration/repository และอย่าสร้าง Cron ที่เรียก ingest RPC หรือ endpoint โดยตรงโดยไม่มี custom header secret

ใน repository มี `supabase/config.toml` ระบุ `[functions.gold-api-collector] verify_jwt = false` เพื่อให้ Cron ใช้ custom header secret ของ collector เป็น authentication boundary ที่ตรวจใน handler เอง ห้ามลบ header check หรือ deploy Function โดยไม่มี `GOLD_API_COLLECTOR_SECRET`; หาก project policy ต้องใช้ gateway JWT เพิ่ม ให้กำหนดทั้งสองชั้นและทดสอบจริง อย่าเปิด endpoint ingest แบบไม่ตรวจ secret

## App behavior

Home ต้องอ่านเฉพาะ closed candles จาก Supabase และไม่ยิง Gold API จาก browser ปุ่ม refresh ต้อง refetch Supabase read path เท่านั้น ใช้ feed source/version เดียวกัน ห้ามผสม frozen Demo, Twelve Data, BiQuote, MT5, OANDA หรือ provider อื่นในชุดเดียวกัน

- น้อยกว่า 240 แท่ง: แสดง `กำลังสะสมข้อมูลจริง X/240 แท่ง` และใช้ frozen `DEMO fallback`
- stale, invalid, query error หรือ provider error: ใช้ `DEMO fallback` พร้อมเหตุผลที่ไม่สร้าง urgency
- ครบอย่างน้อย 240 closed valid fresh candles: แสดง `LIVE · Gold API · read-only`
- แสดง latest source timestamp และคำเตือน market closure/gap ตามจริง ไม่สร้างแท่งเทียม
- คง no-look-ahead และ Time Machine contract เดิม
- ห้ามเปิด live settlement จนกว่าจะมี future outcome data จาก source/version policy เดียวกันครบตาม contract
- ห้ามเพิ่มคู่เงิน/timeframe และห้ามเพิ่ม trade execution

## Verification ที่ต้องทำและรายงานตามจริง

รัน source checks:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

รัน database tests จาก `supabase/tests/database.test.sql` ใน Supabase environment ที่ยืนยันแล้วหลัง migration apply สำเร็จ ตรวจ anon denial, service-role ingestion, OHLC aggregation, UTC boundary, duplicate updatedAt, incomplete exclusion และ closed-candle immutability ห้ามเขียนว่า DB test ผ่านหากยังไม่ได้ execute จริง

ตรวจ client bundle ด้วยการค้นหา output build ว่าไม่มี `SUPABASE_SERVICE_ROLE_KEY`, `GOLD_API_COLLECTOR_SECRET`, `x-gold-api-collector-secret` หรือ secret value ตรวจ `git diff --check`, `git diff`, `git status` และยืนยันว่าไม่มี `src/integrations/supabase/*` ถูกแก้

## สิ่งที่ต้องรายงานกลับ

รายงานชื่อ migration/function/cron, schema และ grants จริงหลังตรวจ environment, ผล test พร้อมจำนวน, และรายการที่ยัง pending หาก deployment ทำไม่ได้ ห้ามบอกว่า production เสร็จ ให้ระบุ blocker และหยุดโดยไม่ใช้ force push, rebase, amend, squash หรือ reset

ต้องรอข้อมูล **240 completed M15 candles หรือประมาณ 2.5–3 วันทำการเป็นอย่างน้อย** ก่อน LIVE; ตลาดปิด, weekend, holiday, stale response และ gap อาจทำให้ใช้เวลานานขึ้น ห้ามลด minimum warmup เพื่อให้ status ผ่าน

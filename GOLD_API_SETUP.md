# Gold API → Supabase setup/runbook

> **สถานะของเอกสาร:** implementation พร้อมใน repository แต่ **ยังไม่ถือว่า production deployment เสร็จ** จนกว่าจะ apply migration, deploy Edge Function, ตั้ง Cron และตรวจหลักฐานจาก Supabase project จริงครบถ้วน

เอกสารนี้เปลี่ยนเส้นทาง market-data ของ XAUEUR M15 จากการยิง Twelve Data ใน runtime เป็นการอ่านแท่งที่สะสมใน Supabase โดย `gold-api-collector` จะเรียก `GET https://api.gold-api.com/price/XAU/EUR` ฝั่ง Edge Function แล้วส่งราคาเข้า RPC แบบ transactional เท่านั้น ส่วน browser จะอ่าน closed candles ผ่าน server function ของแอปและจะไม่เรียก Gold API โดยตรง [1] [2]

## 1. Contract และ security boundary

| ส่วน | สัญญาที่บังคับใช้ |
|---|---|
| Provider | `symbol = XAU`, `currency = EUR`, `price > 0`, `updatedAt` เป็น ISO-8601 ที่มี `Z` หรือ offset และสดไม่เกิน 5 นาที |
| Source identity | `source = gold-api-xau-eur`, `version = 1.0.0`, `symbol = XAUEUR`, `timeframe = M15` |
| Timestamp | ใช้ `updatedAt` ของ Gold API เป็น source timestamp และ bucket ด้วย UTC เท่านั้น |
| Sample idempotency | unique `(source, version, symbol, provider_updated_at)`; `updatedAt` ซ้ำเป็น no-op |
| OHLC | `open` ราคาแรก, `high` สูงสุด, `low` ต่ำสุด, `close` ราคาล่าสุดใน bucket |
| Candle lifecycle | ก่อนจบ 15 นาทีเป็น incomplete; หลังจบแล้ว `is_closed = true` และ OHLC แก้ไม่ได้ |
| Client access | `anon` และ `authenticated` ไม่มีสิทธิ์อ่าน/เขียนตาราง market โดยตรง; server function เท่านั้นที่อ่าน และ Edge Function/RPC เท่านั้นที่ ingest |
| Secrets | `GOLD_API_COLLECTOR_SECRET` และ `SUPABASE_SERVICE_ROLE_KEY` อยู่ใน Supabase Function Secrets/Vault เท่านั้น ไม่อยู่ใน `.env.example`, source หรือ client bundle |

Supabase แนะนำให้ใช้ `pg_cron` ร่วมกับ `pg_net` เพื่อเรียก Edge Function เป็นระยะ และแนะนำให้เก็บ token สำหรับการเรียกไว้ใน Supabase Vault [1] ส่วน secret ของ Edge Function ตั้งได้จากหน้า Secrets Management หรือ CLI โดยไม่ต้อง commit ไฟล์ `.env` [2] Vault เก็บค่าลับแบบเข้ารหัสและเปิดค่าถอดรหัสผ่าน view สำหรับงานที่ได้รับสิทธิ์เท่านั้น [3]

## 2. ไฟล์ใน repository

| ไฟล์ | หน้าที่ |
|---|---|
| `supabase/migrations/20260827130000_gold_api_market_data.sql` | สร้าง `market_price_samples`, `market_candles`, constraints, indexes, RLS/grants, immutable trigger และ RPC `ingest_gold_api_price` |
| `supabase/functions/gold-api-collector/index.ts` | POST-only collector, ตรวจ header secret, timeout, HTTP status, response schema, freshness และเรียก RPC |
| `src/lib/market/goldapi.ts` | pure parser, freshness guard และ UTC M15 boundary helper |
| `src/lib/market.functions.ts` | server-only read ของ closed Gold API candles จาก Supabase; ไม่มี Gold API call ใน browser |
| `src/lib/market/readiness.ts` | readiness contract: 239 แท่งยัง warming/fallback, 240 แท่งที่ valid และ fresh จึงมีสิทธิ์ LIVE |
| `src/lib/market/goldapi.test.ts` | parser, invalid payload, stale/future response และ UTC boundary tests |
| `src/lib/market/readiness.test.ts` | 239/240, stale และ invalid feed tests |
| `supabase/tests/database.test.sql` | pgTAP tests สำหรับ anon denial, OHLC transaction, duplicate timestamp, bucket closure, incomplete exclusion และ closed-candle immutability |

## 3. Apply migration แบบ forward-only

ใช้ environment ของ Supabase project ที่เจ้าของยืนยันแล้วเท่านั้น ไม่ใช้ `reset`, `truncate`, `drop table`, destructive migration หรือการแก้ประวัติ migration เดิม หาก migration error ให้หยุดและเก็บ error จริงไว้ตรวจสอบ

ใน Supabase Dashboard ให้เปิด SQL Editor แล้วรันเนื้อหาของ `supabase/migrations/20260827130000_gold_api_market_data.sql` ตามลำดับหลัง migration เดิมทั้งหมด จากนั้นตรวจด้วย SQL ที่ไม่เปิดเผยค่า secret:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('market_price_samples', 'market_candles');

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'ingest_gold_api_price';

select relname, relrowsecurity
from pg_class
where oid in ('public.market_price_samples'::regclass, 'public.market_candles'::regclass);

select source, version, symbol, timeframe, count(*)
from public.market_candles
group by source, version, symbol, timeframe;
```

ต้องเห็น RLS เปิดอยู่, source/version ตรงกับ contract และไม่มี client grant ที่ทำให้ browser อ่านหรือเขียน raw tables ได้ การตรวจนี้เป็น static/database verification เท่านั้น จนกว่าจะรันกับ project จริง

## 4. Deploy Edge Function

สร้างหรือ deploy Function ชื่อ `gold-api-collector` จาก `supabase/functions/gold-api-collector/index.ts` ผ่าน flow ที่ project ใช้อยู่ เช่น Lovable/Supabase Dashboard หรือ Supabase CLI ที่ผูกกับ project ที่ยืนยันแล้ว ห้ามเดา project URL, project ref หรือ credential

ตั้งค่า secret ใน Supabase Edge Function Secrets:

```text
GOLD_API_COLLECTOR_SECRET=<สุ่มค่า entropy สูงและเก็บไว้นอก Git>
```

`SUPABASE_URL` และ service-role credential ควรใช้ค่าที่ Supabase จัดให้ใน runtime ของ Edge Function หาก environment ต้องตั้งเอง ให้ใส่ `SUPABASE_SERVICE_ROLE_KEY` ใน Function Secrets เท่านั้น ห้ามใส่ `VITE_` prefix ห้ามใส่ใน `.env.example` และห้ามส่งกลับ response/client

Function ต้องรับเฉพาะ `POST` และต้องมี header ต่อไปนี้ทุกครั้ง:

```text
x-gold-api-collector-secret: <ค่าจริงที่ตั้งใน Function Secrets>
```

โค้ดจะตอบ `401` หาก header หายหรือไม่ตรง, `405` หาก method ไม่ใช่ POST, `503` หาก runtime secret ขาด และ `502` หาก upstream/RPC/validation ล้มเหลว การตอบ error จะตัดข้อความให้สั้นและไม่พิมพ์ secret

## 5. Configure Cron ทุก 1 นาทีอย่างปลอดภัย

การตั้ง Cron ต้องทำใน project ที่ยืนยันแล้ว ไม่ commit secret ลง migration หรือไฟล์ runbook ให้ใช้ Vault เก็บ project URL, publishable key และ collector secret แล้วให้ `pg_cron` + `pg_net` อ่านค่าผ่าน `vault.decrypted_secrets` ตามรูปแบบทางการของ Supabase [1] ตัวอย่างต่อไปนี้ใช้ชื่อ secret เป็น placeholder ต้องแทนด้วยค่าจริงใน Dashboard/Vault ก่อนรัน และไม่ควร paste ค่าจริงกลับเข้า Git:

```sql
-- ทำครั้งเดียวใน project ที่ยืนยันแล้ว หาก extension ยังไม่เปิด
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- สร้างผ่าน Vault UI หรือใช้ vault.create_secret() ด้วยค่าจริงที่ไม่ commit
-- ชื่อที่ runbook นี้คาดหวัง:
--   gold_api_project_url
--   gold_api_publishable_key
--   gold_api_collector_secret

select cron.schedule(
  'gold-api-collector-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'gold_api_project_url' limit 1)
      || '/functions/v1/gold-api-collector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'gold_api_publishable_key' limit 1),
      'x-gold-api-collector-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gold_api_collector_secret' limit 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

Custom header secret เป็น mandatory authentication ของ handler และต้องไม่ถูกลบแม้จะมี gateway/API-key protection อยู่แล้ว หาก deployment flow ของ project ตั้งค่า gateway JWT ต่างจากตัวอย่าง ให้ตรวจจาก Dashboard ก่อน และห้ามเปลี่ยนเป็น endpoint ingest ที่ยอมรับ request โดยไม่มี collector secret การใช้ publishable key ใน Cron เป็นเพียงการเรียก gateway และไม่แทนที่ custom secret; service-role key ต้องไม่ใส่ใน browser หรือ response [2]

ก่อนสร้าง schedule ให้ตรวจว่าไม่มี job ชื่อเดียวกันอยู่แล้ว หลังสร้างแล้วตรวจด้วย:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'gold-api-collector-every-minute';
```

หากต้องหยุดการสะสม ให้ disable job หรือยกเลิกตาม workflow ของ Supabase แล้วแอปจะกลับ `DEMO fallback`; อย่าลบข้อมูล market เดิมเพื่อ rollback

## 6. Smoke test และ operational verification

ทดสอบ unauthenticated request โดยไม่ใช้ค่าจริงใน Git และไม่แสดง secret ใน log:

```bash
curl -i -X POST \
  "https://<PROJECT_REF>.supabase.co/functions/v1/gold-api-collector" \
  -H "content-type: application/json"
```

ผลที่คาดหวังคือ `401`. จากนั้นทดสอบ authenticated request ด้วยค่าที่อ่านจาก secret manager โดยตรงในเครื่องที่ปลอดภัย ผลสำเร็จควรเป็น JSON ที่มี `ok: true`, `source: gold-api-xau-eur`, `version: 1.0.0` และข้อมูลผล RPC โดยไม่คืน service-role key

ตรวจ database หลัง Cron ทำงานอย่างน้อยหนึ่งรอบ:

```sql
select count(*) as sample_count,
       min(provider_updated_at) as first_provider_time,
       max(provider_updated_at) as latest_provider_time
from public.market_price_samples
where source = 'gold-api-xau-eur' and version = '1.0.0';

select bucket_start, open, high, low, close, sample_count, is_closed, last_sample_at
from public.market_candles
where source = 'gold-api-xau-eur' and version = '1.0.0'
order by bucket_start desc
limit 10;
```

ตรวจ duplicate timestamp ด้วย:

```sql
select provider_updated_at, count(*)
from public.market_price_samples
where source = 'gold-api-xau-eur' and version = '1.0.0'
group by provider_updated_at
having count(*) > 1;
```

ผลต้องไม่มี duplicate จาก unique constraint, candle ใหม่ต้องมี bucket UTC ทุก 15 นาที และ incomplete candle ต้องไม่ถูกอ่านเข้า app provider เมื่อยังไม่ปิด หากตลาดปิดหรือ upstream ค้าง ระบบต้องคง gap/stale warning และไม่สร้างแท่งเทียม

## 7. App readiness และระยะ warmup

Home อ่านเฉพาะ closed candles ที่มี source/version เดียวกันจาก Supabase และจะใช้ frozen demo ต่อไปจนกว่า feed จะผ่านทุก validation และมีอย่างน้อย **240 แท่ง M15 ที่ปิดแล้ว** จึงจะแสดง:

```text
LIVE · Gold API · read-only
```

ระหว่างสะสมจะแสดงจำนวนจริง เช่น `กำลังสะสมข้อมูลจริง 137/240 แท่ง` และยังใช้ `DEMO fallback` ไม่ผสมแท่ง demo, Twelve Data หรือ provider อื่นเข้าชุดวิเคราะห์เดียวกัน ค่า 239/240 ยังไม่ผ่าน readiness โดยตั้งใจ

เนื่องจากต้องรอ **240 completed M15 candles หรือประมาณ 2.5–3 วันทำการ** เป็นอย่างน้อย ระยะจริงอาจนานขึ้นเมื่อมีตลาดปิด, weekend, holiday, upstream stale หรือ gap ระบบจึงไม่เร่งให้ LIVE และไม่สร้างแท่งปลอมเพื่อเติมจำนวน

แม้ market feed จะครบ readiness แล้ว live settlement ยังไม่เปิด การเปิดผลต้องรอ outcome data ในอนาคตจาก source/version policy ที่เชื่อถือได้และครบตาม Time Machine contract เดิม ห้ามนำ frozen demo outcome มา settle prediction ที่อ้างอิง Gold API

## 8. Troubleshooting และ rollback

| อาการ | ตรวจอะไร | การกระทำที่ปลอดภัย |
|---|---|---|
| `401` | header secret ใน Cron/Vault ไม่ตรงหรือหาย | แก้ secret reference ใน Vault/Function Secrets; อย่าเปิด endpoint โดยตัด auth ออก |
| `503 collector_not_configured` | Function Secrets/runtime env | ตั้งค่าใน Supabase เท่านั้น แล้วทดสอบใหม่ |
| `502 Gold API HTTP` หรือ timeout | upstream status, timeout และ Function logs | ปล่อยให้ app ใช้ fallback; อย่าเขียนค่าที่ไม่ผ่าน validation |
| จำนวนแท่งต่ำกว่า 240 | warmup ยังไม่ครบหรือมี gap/ตลาดปิด | รอต่อไปและตรวจ `provider_updated_at`; ห้ามลด gate |
| stale ใน Home | Cron หยุด, Vault read ไม่ได้ หรือ upstream timestamp ค้าง | ตรวจ `cron.job`, `cron.job_run_details`, Function logs และ latest source timestamp; อย่าสร้างแท่งปลอม |
| candle ปิดแล้วเปลี่ยนไม่ได้ | เป็น invariant ที่ตั้งใจไว้ | หยุดและตรวจ error จริง; ห้ามแก้ด้วย destructive SQL |

Rollback ของ application path คือหยุด/disable Cron และคง app fallback ไว้ ไม่ใช่การลบตารางหรือ reset database ถ้าต้องแก้ schema ให้สร้าง migration ใหม่แบบ forward-only และอัปเดตเอกสาร/หลักฐานตามลำดับ

## References

[1]: https://supabase.com/docs/guides/functions/schedule-functions "Supabase Docs — Scheduling Edge Functions"
[2]: https://supabase.com/docs/guides/functions/secrets "Supabase Docs — Environment Variables and Edge Function Secrets"
[3]: https://supabase.com/docs/guides/database/vault "Supabase Docs — Vault"
[4]: https://api.gold-api.com/price/XAU/EUR "Gold API — XAU/EUR price endpoint"

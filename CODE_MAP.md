# CODE MAP — Market Prediction Playground

เอกสารนี้คือแผนที่โค้ดสำหรับนักพัฒนา/AI ตัวอื่น (เช่น Codex) ให้ต่องานต่อได้โดยไม่ต้องไล่อ่านทั้ง repo
แอป: ห้องทดลองพยากรณ์แบบ read-only ที่ใช้ Cloud `GC=F` ของ Yahoo กรอบเวลา 15 นาทีเป็นเส้นทางหลัก — เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน ส่วน XM/MT5 เก็บโค้ดไว้เป็นงานอนาคตและจะไม่เป็นตัวเลือกใช้งานปกติในระยะนี้
แผนงานตามลำดับ dependency และเกณฑ์จบแต่ละ phase อยู่ที่ `ROADMAP.md`

## Product direction — 28 Aug 2026

- **เป้าหมายหลัก:** ทำ Cloud Yahoo `GC=F/15m` ให้เสถียร อธิบายง่าย และตรวจสอบย้อนกลับได้ ก่อนขยาย data source อื่น
- **XM/MT5 ถูกพัก:** ไม่เดินหน้าต่อด้าน MT5 terminal, PC server, scheduler หรือ live settlement ในระยะนี้ โค้ด bridge/database เดิมคงไว้เพื่อไม่ทำลาย history และ compatibility
- **งาน UX ที่ทำเสร็จแล้ว (28 ส.ค. 2026):** ซ่อนปุ่มเลือก XM จาก flow หลักด้วยสถานะ disabled + badge `กำลังพัฒนา`, normalize stored preference `xm` → `cloud` อัตโนมัติ, เพิ่ม banner และ quick jump ใน Time Machine, ดึง Cloud Yahoo candle เป็น asOf ในหน้า News พร้อมแสดง 3 เวลา และเพิ่มคำอธิบายความต่างของ `GC=F`, broker `GOLD` และ `XAUEUR`
- **ขอบเขตการเปรียบเทียบ:** `GC=F`, `GOLD` และ `XAUEUR` อาจมีทิศทาง M15 คล้ายกันมาก แต่ห้ามถือว่าเป็นราคา/แท่งเดียวกันหรือใช้ราคาเป้าหมายข้าม instrument โดยตรง

## Implementation update — `main`

### Nerd Gold Oracle — branch `codex/nerd-gold-oracle`

- เปลี่ยน Time Machine ให้เป็นเกมท้า AI เดาทอง 5 แท่ง: มีปุ่มสุ่มโจทย์, ล็อกคำทายก่อนเฉลย และผลแบบ symbol-first `▲ / ◆ / ▼`
- `src/lib/learning-calibration.ts` สร้าง walk-forward calibration จาก locked + settled predictions เฉพาะผลที่เกิดครบก่อน replay `asOf`; dedupe เวลาเดิม, ใช้ Beta shrinkage, ต้องมีอย่างน้อย 8 ตัวอย่าง และจำกัดอิทธิพลโมเดลไว้ ±25%
- `analyze()` รับ learning history แบบ optional แล้วส่ง profile เข้า Quality Gate; ผู้ใช้ใหม่จึงได้ผลเดิม ส่วนผู้ใช้ที่เล่นย้อนหลังพอจะเริ่มถ่วงน้ำหนักโมเดลจากผลงานจริง
- หน้า Time Machine ซ่อน alerts, risk calculator และ AI prose จาก flow หลัก รายละเอียด 5 โมเดลยังเปิดดูได้ใน bottom sheet
- ห้ามเปลี่ยน calibration เป็นการกลับ BUY↔SELL อัตโนมัติ และห้ามใช้ prediction ที่ actual candle สุดท้ายอยู่หลัง replay `asOf`

รอบนี้เพิ่ม measurement contract แบบ versioned (`scoreVersion: 1.0.0`) และผลประเมินแยก 5 voting models + Consensus โดย Ensemble ยังคงเป็น commentary; เพิ่ม readiness/idempotent settlement contract, Performance scoreboard แบบ Last 20/50/100/All, confidence calibration, sample-size warnings และ controlled pilot report พร้อม Wilson uncertainty

ชั้นข่าวทำ GDELT เป็น optional bounded request (timeout 8 วินาที), cache successful snapshots 60 นาทีโดยแยก live/historical namespace และ exact `asOf`, เก็บ provider health/fallback reason, mask future event actual ก่อน snapshot/AI payload และเพิ่ม tests สำหรับ normalize/cache/AI schema/id guard/no-look-ahead

ชั้นตลาดเพิ่ม normalized read-only contract และ frozen demo adapters สำหรับ OHLC, UTC timestamp, closed-candle, symbol/timeframe, source และ freshness validation; runtime ปัจจุบันอ่าน Yahoo Chart `GC=F` server-side และ fallback เป็น frozen `GC=F` snapshot โดยยังไม่มีเส้นทางส่งคำสั่งซื้อขาย

เพิ่ม in-app alerts, structured observability events และ UI แสดง provider health, latest accepted closed-candle timestamp และ fallback reason ทั้งหมดไม่มี external notification และไม่บันทึก secrets หรือ personal identifiers

Phase 0 database migrations รวม result immutability ถูก apply แล้วบน managed Supabase โปรเจกต์ GoldCompass; remote schema lint ไม่พบ error ส่วน pgTAP suite ยังไม่ได้รันบน remote environment

รอบล่าสุดเพิ่มปุ่ม `ดึงข้อมูลตอนนี้` เหนือกราฟใน `src/routes/index.tsx` สำหรับ manual refetch ผ่าน React Query; ปุ่ม disable/spinner ระหว่างโหลด และแจ้ง success/error ด้วย toast โดยไม่เพิ่ม polling รอบใหม่

รอบล่าสุดเพิ่ม **Home auth guard**: `/` ตรวจ email/password session ฝั่ง browser และส่งผู้ใช้ที่ยังไม่ login ไป `/login`; Demo ต้องเลือกอย่างชัดเจนผ่าน `/?demo=true` หรือปุ่ม `เข้าโหมด Demo` และเก็บ flag ใน localStorage เพื่อ reload ต่อได้ โดย account session มี precedence เหนือ Demo. เมื่อ auth backend unavailable ทั้ง route loader และ hydration guard จะ honor explicit หรือ stored Demo แต่ยังส่งผู้ใช้ที่ไม่มี Demo flag ไป Login. Dashboard shell มีลิงก์ `เข้าสู่ระบบ` สำหรับออกจาก Demo ไปสมัคร/เข้าสู่บัญชี. การ guard เป็น client-side/hydration-safe เพื่อไม่เรียก browser Supabase client ระหว่าง SSR และไม่มีการแก้ migration/DB. ModelVoteCard/Login tabs มี ARIA relationships ที่ตรวจใน browser แล้ว และ `.env` ถูก ignore โดยใช้ `.env.example` ที่ไม่มีค่า secret เป็น template. ห้ามใช้ fixed credentials หรือ commit secret ลง repository.

รอบล่าสุดเพิ่ม **small reversal hardening** โดย `src/lib/reversal-risk.ts` รวมบริบทเสี่ยงกลับตัวแบบต่อเนื่องให้ทั้ง 5 voting models และ Forecast ใช้ลด conviction โดยไม่บังคับพลิกทิศ; Quality Gate ต้องมี Technical หรือ News ยืนยันเพื่อไม่นับ Trend/Momentum/Volatility ที่สัมพันธ์กันเป็นหลักฐานอิสระ 3 ชุด. `src/lib/entry-risk.ts` เพิ่ม pre-entry guard ที่เปลี่ยน BUY/SELL เป็น WAIT เมื่อ 3 แท่งล่าสุด, Momentum หรือบริบทกลับตัวสวนแรง หรือราคาเหยียดชิดแนวสำคัญ โดยไม่เคยพลิกทิศให้เอง. Regression fixture ล็อกเคส `GC=F/15m` 28 ส.ค. 2026 12:45 Asia/Bangkok โดยไม่อ่านแท่งอนาคต.

รอบล่าสุดเพิ่ม **CandleChart reveal zoom**: เมื่อเปิดเฉลยย้อนหลังและมีแท่งจริงยาวถึงปัจจุบัน กราฟจะเริ่มด้วย 5 แท่งที่ใช้ให้คะแนน; ปุ่มซูมเข้า/ออกเลือก 5/15/30/60/ทั้งหมด และปุ่ม `ทั้งหมด` คืนภาพรวมเดิม. ทุกระดับเริ่มจากแท่งแรกหลังจุดทำนาย. เมื่อ Final Signal เป็น WAIT จะซ่อน heuristic forecast และบอกว่า “ระบบงดทาย” เพื่อไม่ให้เส้น audit ดูเหมือน BUY/SELL.

หน้า Performance เพิ่ม **Replay Accuracy Audit** จาก locked + settled predictions เท่านั้น: รายงาน directional coverage โดยแยก WAIT, เปรียบเทียบทิศเดิมกับ Inverse BUY↔SELL, เทียบ baseline ตามทิศ 5 แท่งที่มองเห็นก่อน `asOf` และเตือน possible sign/label bug เมื่อ inverse เหนือกว่าชัดเจนโดยมีตัวอย่างขั้นต่ำ. Audit ไม่กลับสัญญาณอัตโนมัติและไม่แก้ locked score ย้อนหลัง.

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

| ส่วน                     | สถานะ                                               | แหล่ง                                                                                                    |
| ------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ราคา Market หลัก         | **Cloud Yahoo GC=F delayed / frozen GC=F fallback** | `getYahooMarketFeed`; ผ่าน normalized validation และใช้เฉพาะ closed M15 candles                          |
| XM GOLD M15              | **PAUSED — ซ่อนเป็นกำลังพัฒนาใน UI แล้ว**           | implementation ยังอยู่ที่ `getXmMarketFeed` → `xm_market_candles`; UI เป็น disabled + badge `กำลังพัฒนา` |
| ข่าว ECB/Fed (RSS)       | **LIVE**                                            | `src/lib/news/sources.server.ts`                                                                         |
| Macro (BLS/Eurostat/ECB) | **LIVE**                                            | `src/lib/news/sources.server.ts`                                                                         |
| ข่าวทั่วไป GDELT         | **OPTIONAL LIVE**                                   | query สั้น + timeout 8 วินาที; error ไม่หยุด pipeline และไม่ cache ผลล้มเหลว                             |
| คลังข่าวย้อนหลัง Archive | **LIVE + ARCHIVED**                                 | `Supabase market_news_articles`; auto-archive ข่าวสด และ query ย้อนหลังให้ Time Machine                  |
| AI News Interpretation   | **LIVE**                                            | `src/lib/news/interpret.server.ts` (ปรับสโคปเน้น Gold/USD COMEX GC=F Macro Focus)                        |
| AI Analyst อธิบายสัญญาณ  | **LIVE**                                            | `src/lib/ai.functions.ts`                                                                                |

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
- `src/lib/replay-audit.ts` — diagnostic จากผล settled: coverage, direct/inverse accuracy, 5-candle continuation baseline และ possible-inverse warning โดยกรอง baseline candles ที่ `t <= asOf`
- `src/lib/entry-risk.ts` — conservative pre-entry guard ของ Quality Gate; ระงับเป็น WAIT เมื่อบริบทสั้นสวนแรง/เสี่ยงไล่ราคา แต่ไม่สร้างหรือพลิกทิศ
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
- `src/lib/news/keywords.ts` — คัดกรองความเกี่ยวข้อง + tag (gold_up/down, eur_up/down) มุ่งเน้นปัจจัย Gold/USD, Fed, Treasury Yields, DXY และ Safe-Haven
- `src/lib/news/normalize.ts` — dedupe + mask อนาคต
- `src/lib/news/build-snapshot.ts` — ประกอบ NewsSnapshot จากข่าวจริง + fallback
- `src/lib/news/interpret.server.ts` — AI อ่านข่าวเน้นราคาทองคำโลก (COMEX Gold Futures · GC=F / USD) 4 เสาหลัก (Fed/ดอกเบี้ย, ดอลลาร์/Yields, ภูมิรัฐศาสตร์/Safe-Haven, ข่าวยุโรปเป็นบริบทเสริม); payload และ supporting-ID guard รับเฉพาะ headline/event ที่เปิดเผยและไม่ล้ำ `asOf`
- `src/lib/news/archive.server.ts` — ระบบ Supabase News Archive: auto-archive ข่าวสดเข้า Supabase แบบ bulk upsert เบื้องหลัง และดึงข่าวย้อนหลังสำหรับ Time Machine (`fetchArchivedNews`)
- `src/lib/news/archive.server.test.ts` — unit tests ทดสอบการ auto-archive และการ query ข่าวย้อนหลังตาม `published_at <= asOf`
- `src/lib/news.functions.ts` — `getNewsSnapshot` server fn, cache successful snapshot 60 นาทีด้วย live/historical + exact `asOf` key และ content-hash กันเรียก AI ซ้ำ; auto-archive ข่าวสดลง Supabase และดึงข่าวจาก Supabase Archive เมื่อย้อนเวลาใน Time Machine หรือเมื่อ external source ว่าง
- `src/lib/news/normalize.test.ts`, `build-snapshot.test.ts`, `sources.server.test.ts`, `interpret.server.test.ts` — resilience, no-look-ahead, bounded GDELT และ AI guard regression

### Cloud persistence (Supabase)

- `SUPABASE_PHASE0_RUNBOOK.md` — runbook/preflight เดิม; migrations ถูก apply บน GoldCompass แล้ว แต่ pgTAP remote suite ยัง pending
- Tables: `predictions` (immutable — trigger `enforce_prediction_lock` ห้ามเขียนทับและห้ามเปลี่ยน `user_id`; `marketMode` อยู่ใน snapshot), `prediction_results`, `app_settings`, legacy `market_price_samples`/`market_candles`, `xm_market_candles` (append-only GOLD M15 closed OHLC) และ `market_news_articles` (historical news archive สำหรับ Time Machine query ย้อนหลัง)
- `src/lib/auth.ts` — `getAnonymousUserId()` สำหรับ Demo และ email/password helpers (`getAuthSession`, sign-in, update password, sign-out) พร้อม error metrics โดยไม่บันทึก email/token/user ID
- `src/lib/home-access.ts` — pure policy helper สำหรับ account/Demo/Login decision; anonymous session อย่างเดียวไม่ bypass Login
- `src/lib/cloud-store.ts` — list/save/attachOutcome/settings + `migrateLocalPredictions()` อิงตาม `user_id` จาก Supabase Auth (legacy `device_id` เหลือเป็น telemetry metadata เท่านั้น ไม่ใช่ security boundary)
- `src/lib/device.ts` — legacy `device_id` ใน localStorage (คงไว้เฉพาะ client telemetry ไม่เกี่ยวกับ auth/RLS)
- `supabase/migrations/20260827110000_phase0_auth_and_ownership.sql` — forward-only migration เพิ่ม `user_id`, ปรับ RLS per-operation `(select auth.uid()) = user_id`, แทนที่ PK เดิมของ `app_settings`, ห้าม cross-owner result, ป้องกันการแก้ `user_id`, และ revoke สิทธิ์ unauthenticated `anon`
- `supabase/migrations/20260827130000_gold_api_market_data.sql` — legacy forward-only XAUEUR market storage, unique idempotency, UTC bucket, transactional RPC, RLS/grants และ closed-candle immutability
- `supabase/migrations/20260828100000_xm_mt5_market_data.sql` — XM GOLD M15 append-only storage, strict contract RPC, RLS/grants และ immutable rows
- `supabase/migrations/20260828110000_remove_xm_smoke_test_candle.sql` — forward cleanup ของ synthetic XM smoke candle โดย match timestamp/OHLC แบบเจาะจง; apply แล้วบน GoldCompass
- `supabase/migrations/20260828120000_market_news_articles_archive.sql` — ตาราง `market_news_articles` (id, title, source, url, published_at, tag, impact), index บน `published_at DESC`, และ RLS policies ให้ทุกคนอ่านได้และระบบ upsert ได้
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
- `src/lib/reversal-risk.test.ts` — regression ของ continuous reversal context และเคสเด้งสวนเทรนด์ `GC=F/15m` 28 ส.ค. 2026 12:45; ยืนยันว่าลด conviction เป็น WAIT โดยไม่ใช้ future candles
- `src/lib/replay-audit.test.ts`, `src/lib/entry-risk.test.ts` — regression ของ WAIT exclusion, inverse diagnostic, pre-asOf continuation baseline และ no-flip entry guard
- `src/lib/chart-zoom.test.ts` — regression ระดับซูมแท่งเฉลย, default 5 แท่งตาม scoring horizon, ป้องกันการขอแท่งเกินที่มี และลด history window เมื่อซูมเข้า
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
- `src/lib/risk-calculator.ts`, `src/lib/risk-calculator.test.ts` — Pure calculation engine สำหรับคำนวณเงินทุนกันพอร์ตแตก, ATR noise swing, Stop loss risk, survival multiplier, และ 4 ระดับเกราะป้องกันพอร์ต (safe, moderate, warning, danger) หน่วยบาท
- คำสั่งหลัก: `npm test` (150 tests จาก 38 test files ผ่านครบ), `npm run lint`, `npx tsc --noEmit`, `npm run build`; bridge tests: `python3 -m unittest discover -s bridge -p 'test_*.py'`
- Remote migration history บน GoldCompass ตรงกับ local ทั้ง 8 migrations และ `supabase db lint --linked --level warning` ไม่พบ schema error; pgTAP suite ยังต้องรันแยกตาม runbook

### UI

- `src/routes/index.tsx` — Home auth guard + hydration-safe `HomeGate`; explicit หรือ stored Demo ยังเข้า Demo ได้เมื่อ auth backend unavailable แต่ผู้ใช้ปกติยังถูกส่ง Login; SettingsSheet ใช้ latest-save queue เดียวกับ Settings route; **MarketModeSelector ปรับปุ่ม XM เป็น disabled พร้อม badge "กำลังพัฒนา" ชัดเจน**; status copy แสดง candle count (`354/240 แท่ง ✓`), freshness warning (>30 นาที), latest accepted closed-candle timestamp และ collapsible อธิบาย GC=F vs broker instruments; TimeMachineBar มี quick jump (-1 ชม., -6 ชม., เมื่อวาน, -5 แท่ง) และ CandleChart แสดง Time Machine context banner ติดกราฟ; news query ใช้ exact `asOf`
- `src/routes/news.tsx`, `history.tsx`, `history.$id.tsx`, `performance.tsx`, `settings.tsx`, `guide.tsx`, `login.tsx` — active pages use mode-aware/generic product copy; History labels XM provenance and blocks cross-source settlement; Performance shows locked source metadata พร้อม Replay Accuracy Audit/Inverse Test
- `src/components/app/*` — SignalHero, CandleChart (SVG วาดเอง, รองรับแท่งจริงต่อเนื่องถึงปัจจุบัน, ซูมเฉลย 5/15/30/60/ทั้งหมด, แบนเนอร์เวลาแท่งล่าสุด + หมุดเวลาสีทองบนแกน X, ปรับสเกลกว้างสัดส่วนอัตโนมัติ), SafeBufferCard (คำนวณเงินทุนกันพอร์ตแตกหน่วยบาท 100% + อธิบายระดับราคาภาษาคน), NewsPanel (มี AI block + source links, mobile-safe event rows และ status `LIVE`/`STALE`/`DEMO`), GatePanel, ModelVoteCard (expandable พร้อม `aria-controls`/hidden panel), EnsemblePanel, WhyPanel, TimeMachineBar (3 จังหวะ: เลือกวัน ➔ ดึงข้อมูล ➔ ทำนาย พร้อมปุ่ม [-5 แท่ง] และระบบล้างเฉลยเก่าอัตโนมัติ), AiAnalystPanel และ AppShell ที่มีทางไป Login จาก Demo
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

## Implementation: ข่าวสดและ Time Machine UX — ทำเสร็จแล้ว 28 สิงหาคม 2026

> สถานะหัวข้อนี้: **Implement และ Verify ผ่านเรียบร้อยแล้ว** (Vitest 124 tests, ESLint, TypeScript, Production Build ผ่านครบ 100%) โดยรักษา no-look-ahead และ source-faithful contract อย่างเคร่งครัด

### ปัญหา A — ข่าวที่เห็นอาจเก่าและความสดไม่ชัด [แก้ไขแล้ว]

- หน้า `/news` เปลี่ยนไปใช้ `getYahooMarketFeed` หา latest accepted candle timestamp มาเป็น `asOf` แทนการผูกกับ frozen fixture snapshot
- หน้า `/news` และ `NewsPanel` แสดง 3 เวลาชัดเจน: `วิเคราะห์ ณ`, `ข่าวล่าสุดเผยแพร่เมื่อ`, `ดึงข้อมูลเมื่อ` พร้อม source health และ fallback reason
- เพิ่มปุ่ม `ดึงข่าวใหม่` (manual refresh) พร้อมแจ้งเตือน toast และ cache policy
- แสดงคำเตือนเด่นชัดเมื่ออยู่ในโหมดประวัติศาสตร์/เดโมว่า RSS archive เก่าอาจไม่สมบูรณ์
- fallback/rate-limit/stale แสดงตามจริง ไม่คงป้าย LIVE แบบทำให้เข้าใจว่าข่าวใหม่

### ปัญหา B — Time Machine ย้อนจริงแต่ผู้ใช้พิสูจน์ไม่ได้จาก UI [แก้ไขแล้ว]

- วาง context banner ติดกับกราฟใน `CandleChart`: `⏳ กำลังจำลอง ณ <วัน-เวลา Asia/Bangkok> ระบบเห็นข้อมูลถึงเวลานี้เท่านั้น` พร้อมระบุ symbol และ timeframe ใน figcaption
- แกน X ของ `CandleChart` แสดงวัน+เวลา (Asia/Bangkok) เมื่อช่วงแท่งเทียนข้ามวัน พร้อมระบุ forecast window ชัดเจน (เช่น `คาดการณ์ 06:15–07:15`)
- `TimeMachineBar` เพิ่มปุ่ม quick jump `-1 ชม.`, `-6 ชม.`, `เมื่อวาน` นอกเหนือจากปุ่มปรับละเอียด ±1 แท่ง
- ปรับ copy คำอธิบายให้สะท้อน active provider อย่างสัตย์ซื่อ (ไม่กล่าวถึงเดโมเมื่อใช้ Yahoo จริง)
- เพิ่ม collapsible `เกี่ยวกับแหล่งข้อมูลราคา` อธิบายความต่างระหว่าง `GC=F` COMEX Futures และ broker instruments
- ข้อกำหนด no-look-ahead: ข้อมูลก่อน `asOf` เท่านั้นที่ส่งเข้าโมเดลและ AI, ตัวเลข actual ของ economic events ถูก mask จนกว่าจะถึงเวลาประกาศ

## งานค้างตามลำดับใหม่

1. **News freshness truthfulness** — [เสร็จแล้ว 28 ส.ค. 2026] `/news` ดึง latest accepted candle จาก `getYahooMarketFeed` เป็น `asOf` แทน frozen fixture, แสดง 3 เวลาแยกชัดเจน (วิเคราะห์ ณ, ข่าวล่าสุดเผยแพร่เมื่อ, ดึงข้อมูลเมื่อ) พร้อมปุ่ม refresh ข่าว และคำเตือน archive ไม่ครบ
2. **Time Machine proof UX** — [เสร็จแล้ว 28 ส.ค. 2026] เพิ่ม banner `กำลังจำลอง ณ ... (Asia/Bangkok)` ติด CandleChart, แกน X แสดงวัน+เวลาเมื่อข้ามวัน, แสดง forecast window ชัดเจน, เพิ่มปุ่ม quick jump (-1 ชม., -6 ชม., เมื่อวาน) ใน TimeMachineBar
3. **Cloud-first UX pass** — [เสร็จแล้ว 28 ส.ค. 2026] ซ่อน XM จาก active selection ด้วยปุ่ม disabled + badge `กำลังพัฒนา`, normalize stored 'xm' preference เป็น 'cloud', และปรับ status copy แยก closed candles, เส้นแบ่ง asOf, 5 forecast candles
4. **Yahoo production hardening** — [เสร็จแล้ว 28 ส.ค. 2026] แสดง candle count (`354/240 แท่ง ✓`) บน MarketDataStatus, เพิ่ม freshness warning เมื่อข้อมูลเก่าเกิน 30 นาที, เพิ่ม near-miss warming metric (`provider_warming_near_miss` สำหรับ 200–239 แท่ง), ปรับ copy บอกจำนวนแท่งที่ขาดอย่างชัดเจน
5. **Source/instrument explanation** — [เสร็จแล้ว 28 ส.ค. 2026] เพิ่ม collapsible section ใน MarketDataStatus และหัวข้อใน `/guide` อธิบายว่า GC=F (COMEX Gold Futures) เป็น directional proxy แต่ราคา, wick, basis, FX conversion, timezone และ session ไม่เท่ากับ broker GOLD/XAUEUR
6. **Cloud settlement path & Inline reveal** — [เสร็จแล้ว 28 ส.ค. 2026] ทำปุ่ม "เปิดเฉลย 5 แท่งจริง" บนหน้าแรกเมื่อมีแท่งจริงหลัง asOf พร้อมการ์ดสรุปผล (ทายทิศทาง, ทิศจริง, MAE, ทายรายแท่ง), CandleChart แสดง Forecast(ประ) และ Actual(ทึบ) เคียงข้างกันในแต่ละ slot, หน้า History Detail รองรับการ settle คำพยากรณ์จริงของ Yahoo GC=F ผ่าน getYahooMarketFeed และบันทึกลง Cloud ถาวร, พร้อม strict no-look-ahead auto-reset
7. **News GC=F scope alignment & Supabase Historical News Archive** — [เสร็จแล้ว 28 ส.ค. 2026] ปรับสโคปน้ำหนักข่าวให้เข้ากับ GC=F (COMEX Gold Futures - USD) มุ่งเน้น Fed, Bond Yields, Dollar Index และ Safe-Haven; สร้างตาราง `market_news_articles` บน Supabase บันทึกข่าวสดอัตโนมัติ (auto-archiving) และให้ Time Machine ดึงข่าวย้อนหลังจาก Supabase Archive แทนการพึ่งพา GDELT ในอดีต พร้อม unit tests ผ่าน 100%
8. **SafeBufferCard & Anti-Bust Risk Calculator (100% บาท)** — [เสร็จแล้ว 28 ส.ค. 2026] ยกระดับตารางระดับราคาเดิมให้เป็นการ์ดคำนวณเงินทุนกันพอร์ตแตกและการบริหารความเสี่ยงแบบ Interactive (`src/components/app/SafeBufferCard.tsx` + `src/lib/risk-calculator.ts`) หน่วยเงินบาท 100% ไร้สิ่งรบกวน USD คำนวณแรงสะบัดปกติจาก ATR, ขาดทุนสูงสุดเมื่อคิดผิด (Stop Loss) และตัวคูณเกราะทนแรงเหวี่ยง (Survival Multiplier) ตามขนาด Lot (0.01-0.10) และเงินทุน พร้อมคำอธิบายระดับราคาแนวรับ/แนวต้านฉบับภาษาคน
9. **CandleChart Continuous Actuals, Proportional Scaling & Reveal Zoom** — [เสร็จแล้ว 28 ส.ค. 2026] วาดแท่งจริงต่อเนื่องได้ถึงปัจจุบัน (สูงสุด 120 แท่ง), คงกรอบ 5 แท่งแรกที่ใช้ให้คะแนน, ปรับ SVG แบบสัดส่วน และเพิ่มปุ่มซูมเข้า/ออก/ทั้งหมดที่เน้นแท่ง 5/15/30/60 หรือคืนภาพรวมเต็ม
10. **Real-Time Latest Candle Timestamp Marker** — [เสร็จแล้ว 28 ส.ค. 2026] แสดงเวลาของแท่งเทียนล่าสุดชัดเจน ทั้งแถบสถานะด้านบน (เวลาเริ่มแท่ง + เวลาปิดแท่งถัดไป + วันที่ + Timeframe) และหมุดเวลาสีทอง (Gold Pin Marker) ใต้แท่งเทียนล่าสุดบนแกนเวลาของกราฟ
11. **Time Machine 3-Step Workflow & Fast Replay** — [เสร็จแล้ว 28 ส.ค. 2026] ปรับ UX โหมดย้อนเวลาเป็น 3 จังหวะชัดเจน (1. เลือกวันเวลา ➔ 2. ดึงกราฟ+ข่าว ➔ 3. เริ่มทำนาย), ตั้งค่าเริ่มต้นให้ถอยหลัง 5 แท่งพอดี (`maxIndex - 5`), เพิ่มปุ่มด่วน `[-5 แท่ง]`, และมีระบบเคลียร์เฉลยเก่าทันทีเมื่อเปลี่ยนเวลาเพื่อป้องกันบั๊กแสดงผลค้าง
12. **Model Accuracy & Confluence Engine (Phase 6)** — [small hardening + diagnostic ทำแล้ว; งานใหญ่รอพัฒนา] เพิ่ม continuous reversal context, correlated-vote guard, pre-entry contradiction/anti-chase guard, truthful WAIT chart, Replay Accuracy Audit + Inverse/Baseline comparison และ regression แล้ว; formal Divergence, H1/H4, session/DST, regime calibration, walk-forward learning และ uncertainty fan อยู่ใน `ROADMAP.md`
13. **Database verification remainder** — migrations และ Edge Functions deploy แล้ว; รอ setup remote runner รัน pgTAP remote suite และบันทึกผลตาม runbook
14. **Auth operations** — ตรวจ Anonymous Sign-In, CAPTCHA/Turnstile, rate limit และ cleanup policy บน Supabase Dashboard ก่อนเปิด Demo สาธารณะ; email/password users สร้างผ่าน Supabase Auth ไม่ insert auth.users ตรง ๆ
15. **XM/MT5** — พักแบบไม่มีกำหนด; UI ปรับเป็น disabled + กำลังพัฒนา แล้ว เก็บ implementation/tests/migrations ไว้ แต่ไม่ตั้ง PC server, scheduler หรือเปิดใช้งาน
16. **External alerts** — GDELT เป็น optional bounded source แล้ว; เตรียมแผนเชื่อมต่อ Telegram bot สำหรับ mobile alerts ในอนาคต

## Integrated Yahoo + Red-Team hardening — 27 สิงหาคม 2026

การรวมรอบนี้สร้างบน `origin/main@438c2cf` และไม่ได้ merge branch Red-Team เก่าแบบกลไกตรง ๆ. หลักคือรักษา Yahoo Finance Chart → `GC=F` COMEX Gold Futures → `15m`, same-instrument frozen fallback, source metadata และ read-only boundary ไว้ แล้ว port เฉพาะ regression/hardening ที่ยังเข้ากับสถาปัตยกรรมปัจจุบัน

| Finding                         | สถานะเทียบ latest Yahoo main                                      | การ port/adaptation                                                                                                                                                                                                | หลักฐาน                                                                                   |
| ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| F-01 cache/asOf isolation       | **STILL APPLICABLE**                                              | เปลี่ยน server cache key และ Home/News React Query key เป็น exact `asOf`; ยังคง live/historical namespace และ TTL 60 นาที                                                                                          | `news.functions.test.ts`, Home/News route query keys                                      |
| F-02 future event เข้า AI       | **STILL APPLICABLE**                                              | เพิ่ม `maskNewsEventsForAsOf`, pure `buildInterpretationPayload` และ visible-ID guard ที่รับเฉพาะ event/headline ก่อน `asOf`                                                                                       | `news.functions.test.ts`, `interpret.server.test.ts`                                      |
| F-03 stale news แสดง LIVE       | **NEEDS ADAPTATION**                                              | คง `live=true` เพื่อบอกว่า source เป็นข่าวจริง แต่แยก presentation เป็น `ข่าวจริง (STALE)`; stale snapshot ไม่เข้า successful cache                                                                                | `news/status.ts`, `NewsPanel.test.tsx`, `build-snapshot.test.ts`                          |
| F-04 settlement ข้อมูลเสีย      | **NEEDS ADAPTATION**                                              | ใช้ `provider.intervalMs` แทน M15 hard-code; ตรวจ source symbol, OHLC, order, duplicate, contiguous horizon และจับ timeout เป็น `not_ready`                                                                        | `settlement.ts`, `settlement.test.ts`, History same-instrument provider selection         |
| F-05 future candle/fetchedAt    | **STILL APPLICABLE**                                              | เพิ่ม 60 วินาที clock-skew tolerance ใน normalized market contract เพื่อปฏิเสธ timestamp อนาคตโดยไม่ทำลาย Yahoo server-observation semantics                                                                       | `contract.ts`, `contract.test.ts`, Yahoo/market.functions suite                           |
| F-06 provider wording           | **OBSOLETE ในรูปเดิม; NEEDS ADAPTATION สำหรับ active copy audit** | ไม่ port Twelve Data → Gold API เดิม; แก้ active route metadata, News, Guide, Login, Settings, root, trend, Performance และ GDELT identity ให้ truthful ต่อ Yahoo/GC=F; legacy parser/docs คงไว้เป็น compatibility | static scan + browser smoke `/`, `/login`, `/news`, `/guide`, `/settings`, `/performance` |
| F-07 explicit Demo/auth failure | **STILL APPLICABLE**                                              | เมื่อ auth backend unavailable อนุญาตเฉพาะ `/?demo=true`; normal user ที่ไม่ขอ Demo ยังไป Login ตาม policy เดิม                                                                                                    | `index.tsx`, `home-access.test.ts`, Home/Login browser smoke                              |

Full source verification ของ integrated state ณ 27 สิงหาคมผ่าน `npm test` 107 tests จาก 28 files, lint, typecheck, production build และ `git diff --check`. Browser smoke ตรวจ Home/explicit Demo, Login, History, prediction detail not-found, News, Performance และ Settings/Guide ใน local environment; ข้อความว่า Supabase/RLS และ production ยัง pending เป็นสถานะ ณ วันนั้นเท่านั้น—สถานะ deployment ปัจจุบันให้ยึดหัวข้อ Product direction, Stack และ Cloud persistence ด้านบน


## Handoff update — 29 Aug 2026

การเปลี่ยนแปลงล่าสุดที่ Claude ต้องทราบ:

| ส่วน | ไฟล์ | สถานะล่าสุด |
|---|---|---|
| Zen Time Machine | `src/routes/index.tsx`, `src/components/app/TimeMachineBar.tsx` | รวมการเตรียมข้อมูลและทำนายเป็น action เดียว; Time Machine prediction auto-save แบบ append-only |
| Forecast ตอน WAIT | `src/components/app/CandleChart.tsx` | ถ้ามี forecast จะยังวาดเป็น exploratory forecast แม้ Final Signal เป็น WAIT |
| Zen history | `src/routes/history.tsx`, `src/routes/history.$id.tsx` | ถอดปุ่มลบ/ล้างผล; เปิดเฉลยแล้วพยายามบันทึก feedback ต่อท้าย |
| Consensus | `src/lib/consensus/index.ts` | confidence-weighted voting, directional strength และ lead margin; 2 เสียงมั่นใจสูงชนะเสียงอ่อน ๆ ได้ แต่เสียงสูสียัง WAIT |
| Regression | `src/lib/consensus/index.test.ts` | เพิ่มกรณี weighted lead และ weighted tie |
| Supabase schema | `supabase/migrations/20260829003000_zen_cache_learning.sql` | เพิ่ม `market_snapshot_cache` และ `prediction_learning_feedback`; ไม่มี DELETE policy/grant |
| Learning Edge Function | `supabase/functions/prediction-learning/index.ts` | รับ feedback แบบ idempotent และคืน profile accuracy รวม/แยก direction/model |
| Client feedback | `src/lib/cloud-store.ts` | `saveLearningFeedback()` บันทึกผลเฉลยและ per-model scores แบบ best-effort |

Validation ล่าสุดผ่าน: `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` และ `pnpm build`

สถานะ Git หลัง update นี้: branch `main` มี commit local ที่ยังไม่ push คือ `48afbb5 feat: sharpen consensus with confidence weighted votes` และ `origin/main` อยู่ที่ `f771a6e` ก่อนการ push รอบนี้ ไฟล์ handoff นี้ถูกเพิ่มเพื่อให้ Claude เห็นสถานะล่าสุดและจะถูกรวมใน commit ถัดไป

ข้อควรทำต่อที่สำคัญที่สุดคือ apply migration ใหม่ใน Supabase, deploy Edge Function, เชื่อม `market_snapshot_cache` เข้า `getYahooMarketFeed`, และนำ learning profile มาใช้เป็น calibration หลังมี settled samples เพียงพอ โดยต้องรักษา locked prediction, append-only result และ no-look-ahead contract

หากต้องการ push ชุดนี้ ให้ใช้ author/committer `Pong Bioscience <pongbioscience2555@gmail.com>` และตรวจ `git status`, `git log` และ remote branch ก่อน force-push ทุกครั้ง

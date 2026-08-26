# แผนงาน: สร้าง CODE_MAP.md เพื่อส่งต่องาน

สร้างไฟล์ `CODE_MAP.md` ที่ root ของโปรเจกต์ เพียงไฟล์เดียว ไม่แตะโค้ดอื่น เนื้อหาดังนี้:

---

# CODE MAP — XAUEUR Signal Lab

เอกสารนี้คือแผนที่โค้ดสำหรับนักพัฒนา/AI ตัวอื่น (เช่น Codex) ให้ต่องานต่อได้โดยไม่ต้องไล่อ่านทั้ง repo
แอป: เครื่องมือทดลองพยากรณ์ XAUEUR (ทองคำ/ยูโร) กรอบเวลา 15 นาที — เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน

## Stack

- **Frontend/SSR**: TanStack Start v1 (React 19) + Vite 7, Tailwind CSS v4 (`src/styles.css`)
- **Backend**: Lovable Cloud (Supabase) — DB + RLS; server logic ใช้ `createServerFn` (ไฟล์ `*.functions.ts`)
- **AI**: Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1`) ผ่าน Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`), model ที่ใช้: `google/gemini-3.7-flash`
- **Charts**: SVG วาดเอง ไม่มี chart library

## สถานะข้อมูลปัจจุบัน

| ส่วน | สถานะ | แหล่ง |
|---|---|---|
| ราคา Market | **DEMO (ตรึงค่า)** | `src/data/xaueur-m15.json` |
| ข่าว ECB/Fed (RSS) | **LIVE** | `src/lib/news/sources.server.ts` |
| Macro (BLS/Eurostat/ECB) | **LIVE** | `src/lib/news/sources.server.ts` |
| ข่าวทั่วไป GDELT | **LIVE แต่ไม่เสถียร** | rate-limit 1 req/5s/IP, มัก timeout — ออกแบบให้ล้มได้โดยไม่พังแอป |
| AI News Interpretation | **LIVE** | `src/lib/news/interpret.server.ts` |
| AI Analyst อธิบายสัญญาณ | **LIVE** | `src/lib/ai.functions.ts` |

## Pipeline หลัก (ห้ามพลิกทิศ)

```text
snapshot (ราคาเดโม) + news (จริง/เดโม)
  → 5 voting models (trend, momentum, technical, news, volatility)
  → ensemble (วิเคราะห์แยก ห้ามโหวต/ห้าม override)
  → forecast engine (5 scenarios)
  → quality gate (consensus/index.ts) = Final Signal ตัวเดียว
  → narrative
```

## ไฟล์สำคัญตามชั้น

### Types & Pipeline
- `src/lib/types.ts` — types ทั้งหมด: Candle, ModelVote, NewsSnapshot (มี `interpretation?`, `live`, `errors`), Prediction (มี `newsSnapshot`), AiExplanation
- `src/lib/analysis.ts` — ฟังก์ชัน `analyze(asOf, settings, liveNews?)` จุดรวม pipeline ทางเดียว
- `src/lib/indicators/index.ts` — EMA, RSI, MACD, ATR, pivots (ต้องการ warmup ≥ 200 แท่ง)
- `src/lib/models/*.ts` — โมเดลโหวต 5 ตัว; `models/news.ts` ลด confidence ถ้าข่าว stale/provider ล่ม/ไม่มี interpretation
- `src/lib/consensus/index.ts` — Quality Gate เท่านั้นที่ตัดสิน Final Signal
- `src/lib/ensemble/index.ts` — ensemble commentary (แยกจากโหวต)
- `src/lib/forecast/engine.ts` — 5 scenarios จาก EMA/ATR/S-R + seeded random (ไม่ใช่ random ล้วน)

### Market (ยังเป็นเดโม)
- `src/lib/market/provider.ts` — interface; `frozen-provider.ts` — อ่าน JSON ตรึง, `getCandlesUpTo(ts)` กัน look-ahead

### News (ของจริง)
- `src/lib/news/provider.ts` — interface NewsProvider
- `src/lib/news/frozen-news.ts` — demo provider + Time Machine masking (actual=null จนกว่าจะถึงเวลา)
- `src/lib/news/sources.server.ts` — fetch จริง: GDELT, Fed RSS, ECB RSS, BLS API, Eurostat HICP, ECB Data Portal. **ปัญหาที่ค้าง: GDELT timeout/429 บ่อยจาก IP ร่วมของ sandbox — แนวทางแก้: ทำเป็น optional provider, query สั้น, timeout 8s, cache ผลสำเร็จ 60 นาที**
- `src/lib/news/keywords.ts` — คัดกรองความเกี่ยวข้อง + tag (gold_up/down, eur_up/down)
- `src/lib/news/normalize.ts` — dedupe + mask อนาคต
- `src/lib/news/build-snapshot.ts` — ประกอบ NewsSnapshot จากข่าวจริง + fallback
- `src/lib/news/interpret.server.ts` — AI อ่านข่าว → JSON {goldBias, eurBias, xaueurBias, confidence, keyDrivers, risks, supportingNewsIds/EventIds}; parse แบบทนทาน, guard id ที่ AI อ้างต้องมีจริง
- `src/lib/news.functions.ts` — `getNewsSnapshot` server fn, cache 10 นาที per bucket + content-hash กันเรียก AI ซ้ำ

### Cloud persistence (Supabase)
- Tables: `predictions` (immutable — trigger `enforce_prediction_lock` ห้ามเขียนทับ), `prediction_results`, `app_settings`
- `src/lib/cloud-store.ts` — list/save/attachOutcome/settings + `migrateLocalPredictions()` จาก localStorage ครั้งเดียว
- `src/lib/device.ts` — device_id ใน localStorage (ยังไม่มี auth — RLS เปิดแบบ anonymous โดยตั้งใจ)
- `src/integrations/supabase/*` — ไฟล์ auto-gen **ห้ามแก้** (client.ts, client.server.ts, auth-middleware.ts, auth-attacher.ts, types.ts)

### AI Analyst (อธิบายผลหน้าแรก)
- `src/lib/ai-gateway.server.ts` — provider helper + run-id propagation
- `src/lib/ai.functions.ts` — `explainAnalysis` (system prompt ไทย, ห้าม AI override engine), fallback = `templateExplanation` ใน `src/lib/ai-input.ts`

### UI
- `src/routes/index.tsx` — Dashboard: SignalHero → CandleChart → accordion (models/ensemble/gate/news)
- `src/routes/news.tsx`, `history.tsx`, `history.$id.tsx`, `performance.tsx`, `settings.tsx`, `guide.tsx`
- `src/components/app/*` — SignalHero, CandleChart (SVG, forecast zone ~45%), NewsPanel (มี AI block + source links), GatePanel, ModelVoteCard (expandable), EnsemblePanel, WhyPanel, TimeMachineBar, AiAnalystPanel
- `src/styles.css` — ธีม Warm Paper (oklch), ฟอนต์ IBM Plex Sans Thai

## กฎเหล็กที่ต้องรักษา

1. AI ทุกตัว **อธิบายเท่านั้น** ห้ามเดาราคา/แต่งข่าว/override Final Signal; ทุก AI call ต้องมี deterministic fallback
2. Time Machine: ห้ามเห็นข้อมูลหลัง `asOf` ทั้งราคา ข่าว และ actual ของ economic events
3. Prediction ที่ lock แล้ว immutable (บังคับที่ DB trigger) — เก็บ `newsSnapshot` + `AiExplanation` ณ เวลานั้นด้วย
4. ห้ามเพิ่มคู่เงิน/timeframe อื่น, ห้ามต่อ MT5 (จนกว่าเจ้าของจะสั่ง)
5. ไฟล์ `src/integrations/supabase/*` auto-gen ห้ามแตะ
6. หน้า public route loader ห้ามเรียก server fn ที่ต้อง auth (ใช้ useQuery ใน component แทน)

## งานค้างที่รู้แล้ว

- **GDELT ไม่เสถียร** — โค้ด graceful แล้ว (error เป็น annotation, News Model ลดความมั่นใจ) แต่ยังไม่ได้ทำ optional provider + cache 60 นาที
- ยังไม่มี auth/RLS รายบุคคล (anonymous โดยตั้งใจสำหรับเดโม)
- ราคาจริง/MT5 ยังไม่ได้ต่อ (ตั้งใจไว้)

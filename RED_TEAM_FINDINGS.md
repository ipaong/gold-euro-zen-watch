# Integrated Red-Team Findings — Yahoo Architecture

อัปเดต: **28 สิงหาคม 2026**
Release-hardening base: `origin/main@a613048` ก่อน dual-mode implementation
Current candidate: `main` dual-mode release candidate; final commit SHA is recorded by Git history after verification
Historical integration branch: `manus/red-team-yahoo-integration`
Original Red-Team branch: `manus/red-team-hardening` (อิง baseline เก่า จึงไม่ได้ merge โดยตรง)

## หลักการ

รอบนี้ประเมิน findings เดิมกับ dual-mode architecture รุ่นล่าสุด แล้ว port เฉพาะ behavior ที่ยังถูกต้อง. Active paths มีสองแบบที่ผู้ใช้เลือกเอง: **Cloud: Yahoo Finance Chart → `GC=F` COMEX Gold Futures → `15m` delayed** หรือ **XM Live: MT5 terminal → read-only bridge → `GOLD` `M15` → Supabase append-only store**. ไม่มี silent cross-source fallback และไม่มี order/trade path. Gold API, Twelve Data และ XAUEUR fixture ยังคงอยู่เฉพาะใน legacy compatibility/parser/test scope.

## Disposition

| Finding | Status | Port/adaptation | หลักฐาน |
|---|---|---|---|
| F-01 news cache/asOf isolation | **STILL APPLICABLE** | Server cache และ Home/News React Query ใช้ exact `asOf`; คง live/historical namespace และ TTL 60 นาที | `src/lib/news.functions.test.ts`, route query keys |
| F-02 future macro actual เข้า AI | **STILL APPLICABLE** | `maskNewsEventsForAsOf`, `buildInterpretationPayload` และ visible-ID guard รับเฉพาะข้อมูลก่อน/ถึง `asOf` | `news.functions.test.ts`, `interpret.server.test.ts` |
| F-03 stale news แสดง LIVE | **NEEDS ADAPTATION** | คง `live=true` สำหรับ real source แต่ presentation แสดง `ข่าวจริง (STALE)`; stale ไม่ผ่าน success cache | `src/lib/news/status.ts`, `NewsPanel.test.tsx`, `build-snapshot.test.ts` |
| F-04 settlement invalid candles | **NEEDS ADAPTATION** | ใช้ `provider.intervalMs`; reject source mismatch, reversed, duplicate, malformed OHLC, gaps และ timeout เป็น `not_ready` | `settlement.ts`, `settlement.test.ts`, History provider selection |
| F-05 future candle/fetchedAt | **STILL APPLICABLE** | normalized contract เพิ่ม 60s clock-skew tolerance และ reject future timestamps เกิน tolerance | `contract.ts`, `contract.test.ts` |
| F-06 Twelve Data → Gold API wording | **OBSOLETE ในรูปเดิม; NEEDS ADAPTATION สำหรับ copy audit** | ไม่ restore provider เก่า; ปรับ active root/Login/Settings/Guide/News/trend/Performance และ GDELT identity ให้ Yahoo/GC=F truthful; legacy parser/docs คงไว้ | static active-source scan + browser smoke |
| F-07 explicit Demo/auth failure | **HARDENED** | `/?demo=true` และ stored Demo เข้า Demo ได้เมื่อ auth backend unavailable; ordinary user ที่ไม่มี Demo flag ยังไป Login | `home-access.test.ts`, Home reload smoke, `OVERNIGHT_BROWSER_NOTES.md` |
| F-08 cross-source prediction contamination | **HARDENED** | `marketMode` อยู่ใน immutable snapshot; History แสดง XM provenance และ block XM settlement/replay against Yahoo/GC=F/XAUEUR | `types.ts`, `history.tsx`, `history.$id.tsx`, `DUAL_MODE_DESIGN.md` |
| F-09 XM bridge open/future/malformed input | **HARDENED IN SOURCE** | bridge requests position 1; parser, Edge Function และ DB RPC validate closed GOLD M15, UTC/OHLC/order/future/duplicate/conflict; XM failure stops analysis | `xm.ts`, `xm.test.ts`, bridge tests, migration, Edge Function |

## Changes integrated

ชั้นข่าวได้ exact-asOf cache/query isolation, future-event masking ก่อน snapshot/AI, asset/provider-neutral payload boundary และ presentation state ที่แยก LIVE/STALE/DEMO. ชั้น settlement ตรวจ instrument/provider symbol, OHLC geometry, ordering, duplicate และ contiguous provider `intervalMs`; timeout/invalid payload ไม่ถูก score. ชั้น market contract ตรวจ candle/fetchedAt ที่ล้ำ server observation time เกิน 60 วินาที; `fetchedAt` ถูก document ให้หมายถึง latest accepted closed-candle timestamp ซึ่งเป็น freshness anchor ไม่ใช่ response-receipt time. Home settings persistence ใช้ serial latest-save queue และ auth-failure guard honor stored Demo. Dual-mode เพิ่ม strict XM bridge contract, append-only database boundary, server-clock freshness, explicit offline/stale/warming states และ no-silent-fallback policy.

Active UI ใช้ mode-aware copy ใน Home/AppShell/History/Detail; Cloud labels Yahoo/GC=F delayed/demo ขณะที่ XM labels GOLD/MT5 bridge/offline. History list เลือก same-instrument frozen Yahoo provider สำหรับ legacy/Cloud `GC=F` demo แต่ block XM settlement จนกว่าจะมี XM outcome source เดิม. ไม่ได้ port Twelve Data → Gold API code จาก branch เก่า และไม่เปิด silent fallback ไป XAUEUR หรือ GC=F จาก XM.

## Verification

| Gate | Result |
|---|---|
| `npm test -- --run` | **ผ่าน** — 119 tests จาก 30 files |
| `npm run lint` | **ผ่าน** — 0 errors, 0 warnings |
| `npx tsc --noEmit` | **ผ่าน** |
| `npm run build` | **ผ่าน** — production/Nitro build สำเร็จ |
| `git diff --check` | **ผ่าน** |
| `python3 -m unittest discover -s bridge -p 'test_*.py'` | **ผ่าน** — 3 tests; Python syntax compile ผ่าน |
| focused cross-architecture suite | **ผ่าน** — 42 tests จาก 11 files |

## Browser smoke

หลักฐานรายละเอียดอยู่ใน `YAHOO_INTEGRATION_BROWSER_NOTES.md`, `OVERNIGHT_BROWSER_NOTES.md` และ `DUAL_MODE_BROWSER_NOTES.md`. ตรวจ Home `/`, explicit Demo `/?demo=true`, stored-Demo reload, Login, History, prediction detail not-found, News, Performance, Settings และ Guide บน local dev server; route screenshot smoke เพิ่ม 360/412px และ Home captures เดิม 360/390/412/768/1280px. Cloud state แสดง `GC=F`, `15m`, Yahoo/same-instrument fallback และ `ERROR · DEMO fallback`; XM state แสดง `GOLD`, `M15`, `OFFLINE · XM bridge`, no cross-source signal และ explicit XM→Cloud recovery. Console พบเฉพาะ expected missing `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`; ไม่มี unexpected runtime exception ใน smoke.

## Remaining limitations

ยังไม่ได้ execute migration/pgTAP/RLS, authenticated Cloud persistence, Yahoo production endpoint/rate-limit, XM Edge Function, real MT5 terminal payload, deployed runtime หรือ live outcome settlement ใน environment จริง. ต้องตั้ง `XM_BRIDGE_SECRET` อย่างปลอดภัย, deploy migration/function, เปิด MT5/XM `GOLD`, ส่ง `--once`, ตรวจ 240 closed candles และเปรียบเทียบแท่งกับ terminal ก่อนเรียก XM Live ว่า verified. Anonymous Sign-In/CAPTCHA/rate-limit/cleanup policy และ Yahoo warmup ยังต้อง verify ก่อนใช้งานจริง. Dedicated screen-reader/contrast audit ยังอยู่นอก scope รอบนี้; fixed-width visual smoke เป็น local evidence ไม่ใช่ production verification.

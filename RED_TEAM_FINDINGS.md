# Integrated Red-Team Findings — Yahoo Architecture

อัปเดต: **27 สิงหาคม 2026**
Integration base: `origin/main@438c2cf`
Working branch: `manus/red-team-yahoo-integration`
Original Red-Team branch: `manus/red-team-hardening` (อิง baseline เก่า จึงไม่ได้ merge โดยตรง)

## หลักการ

รอบนี้ประเมิน findings เดิมกับ Yahoo-based architecture รุ่นล่าสุด แล้ว port เฉพาะ behavior ที่ยังถูกต้อง. Active market path ยังคงเป็น **Yahoo Finance Chart → `GC=F` COMEX Gold Futures → `15m`**, fetch ฝั่ง server เท่านั้น, fallback เป็น frozen `GC=F` instrument เดียวกัน และไม่มี order/trade path. Gold API, Twelve Data, XAUEUR fixture และ Supabase collector ยังคงอยู่เฉพาะใน legacy compatibility/parser/test scope.

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

## Changes integrated

ชั้นข่าวได้ exact-asOf cache/query isolation, future-event masking ก่อน snapshot/AI, asset/provider-neutral payload boundary และ presentation state ที่แยก LIVE/STALE/DEMO. ชั้น settlement ตรวจ instrument/provider symbol, OHLC geometry, ordering, duplicate และ contiguous provider `intervalMs`; timeout/invalid payload ไม่ถูก score. ชั้น market contract ตรวจ candle/fetchedAt ที่ล้ำ server observation time เกิน 60 วินาที; `fetchedAt` ถูก document ให้หมายถึง latest accepted closed-candle timestamp ซึ่งเป็น freshness anchor ไม่ใช่ response-receipt time. Home settings persistence ใช้ serial latest-save queue และ auth-failure guard honor stored Demo.

Active UI ใช้ Yahoo/GC=F หรือ generic product copy ใน root, Login, Settings, Guide, News, trend และ Performance. History list เลือก same-instrument frozen Yahoo provider สำหรับ `GC=F` demo และ Performance แสดง locked source provenance. ไม่ได้ port Twelve Data → Gold API code จาก branch เก่า และไม่เปิด silent fallback ไป XAUEUR.

## Verification

| Gate | Result |
|---|---|
| `npm test` | **ผ่าน** — 108 tests จาก 28 files |
| `npm run lint` | **ผ่าน** — 0 errors, 0 warnings |
| `npx tsc --noEmit` | **ผ่าน** |
| `npm run build` | **ผ่าน** — production/Nitro build สำเร็จ |
| `git diff --check` | **ผ่าน** |
| focused cross-architecture suite | **ผ่าน** — 42 tests จาก 11 files |

## Browser smoke

หลักฐานรายละเอียดอยู่ใน `YAHOO_INTEGRATION_BROWSER_NOTES.md` และ `OVERNIGHT_BROWSER_NOTES.md`. ตรวจ Home `/`, explicit Demo `/?demo=true`, stored-Demo reload, Login, History, prediction detail not-found, News, Performance, Settings และ Guide บน local dev server; route screenshot smoke เพิ่ม 360/412px และ Home delayed captures 360/390/412/768/1280px. Home แสดง `GC=F`, `15m`, Yahoo/same-instrument fallback และ `ERROR · DEMO fallback`; Login/Guide/News แสดง Yahoo/GC=F copy; History/Performance แสดง safe empty/locked-data states; explicit และ stored Demo ไม่ถูก redirect เมื่อ Supabase/Auth unavailable. Console ไม่พบ runtime exception ใน smoke; local fallback ยังแสดง expected missing `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`.

## Remaining limitations

ยังไม่ได้ execute migration/pgTAP/RLS, authenticated Cloud persistence, Yahoo production endpoint/rate-limit, deployed runtime หรือ live outcome settlement ใน environment จริง. Anonymous Sign-In/CAPTCHA/rate-limit/cleanup policy และ 240 closed-candle warmup ยังต้อง verify ก่อนเปิดใช้งานจริง. Dedicated screen-reader/contrast audit ยังอยู่นอก scope รอบนี้; fixed-width 360/390/412px visual smoke ทำแล้วใน local fallback state แต่ไม่ใช่ production verification.

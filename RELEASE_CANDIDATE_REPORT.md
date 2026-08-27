# Release Candidate Report — Overnight Release Hardening

**Repository:** `ipaong/gold-euro-zen-watch`
**Active branch:** `main`
**Starting SHA:** `0b18fb9`
**Remote status at documentation checkpoint:** `main == origin/main == 0b18fb9`
**Date:** 27 สิงหาคม 2026 (GMT+7)
**Recommendation:** **พร้อมส่ง Codex review แบบมีเงื่อนไข; ยังไม่ใช่ production sign-off**

## 1. Executive assessment

รอบนี้เป็น release-hardening pass ที่เริ่มจาก commit `0b18fb9` ซึ่งมี Yahoo Finance Chart เป็น read-only server path สำหรับ `GC=F` COMEX Gold Futures ที่กรอบ `15m` และใช้ frozen `GC=F` snapshot เป็น fallback เมื่อข้อมูล Yahoo ไม่พร้อม. การแก้ไขรักษา architecture นี้ไว้โดยไม่เปิด provider ใหม่ ไม่เปิด order/trade path ไม่ใช้ Yahoo เป็นราคา execution ของ XM และไม่เปลี่ยนกติกา no-look-ahead, prediction lock หรือ settlement contract [1].

ผลการตรวจพบประเด็นระดับ HIGH ที่ยืนยันได้จาก source และ user journey สามเรื่อง. ทั้งสามเรื่องได้รับการแก้ด้วย patch ขนาดเล็กและ regression coverage ที่สอดคล้องกับ implementation เดิม ได้แก่การคง stored Demo เมื่อ auth backend ล้ม, การ serialize การบันทึก Settings บน Home ด้วย latest-save queue และการเปลี่ยนถ้อยคำ timestamp ให้ไม่กล่าวเกิน semantics ของ `MarketDataFeed.fetchedAt`. ไม่พบ BLOCKER จาก source, local tests หรือ local browser smoke แต่ production readiness ยังถูกกั้นด้วย external verification ที่ sandbox ทำไม่ได้ [2] [3].

| มิติ | ผลตรวจรอบนี้ | ขอบเขตความหมาย |
|---|---|---|
| Active market path | คง Yahoo Chart → `GC=F` → `15m`, server-only delayed read | ยืนยันจาก source/local เท่านั้น; ยังไม่ยืนยัน deployed Yahoo endpoint |
| Fallback | same-instrument frozen `GC=F`, explicit `DEMO`/`ERROR`/`STALE` states | ไม่พบ silent XAUEUR substitution ใน active path |
| No-look-ahead | Existing contract/news/AI/forecast/settlement guards คงอยู่; full suite ผ่าน | เป็น source/unit evidence ไม่ใช่ live DB evidence |
| Prediction/settlement integrity | Existing immutable/idempotent contracts คงอยู่; settlement adversarial tests ผ่าน | Supabase trigger/RLS/pgTAP ยังไม่ได้ execute จริง |
| Auth/Demo | Explicit และ stored Demo คงอยู่เมื่อ auth unavailable; no-Demo user ไป Login | ตรวจใน local missing-Supabase environment |
| Mobile/UX | Primary routes smoke ที่ 360/412px; Home delayed captures 360/390/412/768/1280px | เป็น local fallback/demo state; ไม่ใช่ production visual sign-off |

## 2. Confirmed findings and fixes

### H-01 — Stored Demo ถูกละเลยเมื่อ auth ล้มเหลว

**Reproduction and root cause.** `resolveHomeAccess()` มี policy รองรับ `demoStored` อยู่แล้ว แต่ `beforeLoad` และ `HomeGate` ของ Home ตรวจเฉพาะ `search.demo === true` ใน `catch`. ดังนั้นผู้ใช้ที่เคยเลือก Demo แล้ว reload โดยไม่มี query parameter อาจถูกส่งไป Login หาก auth backend ชั่วคราว throw แม้ policy หลักจะตั้งใจให้ Demo reload ได้.

**Fix.** เพิ่ม pure helper `shouldKeepDemoOnAuthFailure()` ใน `src/lib/home-access.ts` และใช้ helper เดียวกันในทั้ง route loader และ hydration guard. เมื่อ auth failure เกิดขึ้น ระบบจึง honor explicit หรือ stored Demo และยัง redirect ผู้ใช้ที่ไม่มี Demo flag ไป Login.

**Evidence.** เพิ่ม regression ใน `src/lib/home-access.test.ts`; focused suite ผ่าน 6 tests สำหรับ home-access. Browser smoke ทำ explicit Demo แล้วเปิด `/` โดยไม่มี `?demo=true`; URL ยังคงอยู่ที่ Home, `localStorage['xaueur-lab:demo-mode:v1']` มีค่า `1` และ Home heading ถูก render.

### H-02 — Home SettingsSheet ใช้ fire-and-forget save

**Reproduction and root cause.** Home เคยเรียก `void saveSettings(s)` ทุกครั้งที่ slider เปลี่ยน. Rapid updates จึงสามารถสร้าง writes พร้อมกันและให้ค่าที่เก่ากว่ามาถึงหลังค่าล่าสุด. นอกจากนี้ rejection ไม่ได้แสดงสถานะ persistence ให้ผู้ใช้เห็น. Settings route มี `createLatestSaveQueue()` ที่ออกแบบมาแก้ปัญหานี้อยู่แล้ว.

**Fix.** Home ใช้ `createLatestSaveQueue(saveSettings, ...)` ผ่าน stable ref เดียวกับ Settings route. Queue serialize writes, retain เฉพาะค่าล่าสุดที่รอส่ง และ suppress stale failure; error ล่าสุดจะแสดง toast ว่าค่า Cloud ยังไม่ยืนยัน.

**Evidence.** Existing `src/lib/save-queue.test.ts` ครอบคลุม serialized writes, newest-pending behavior และ stale-failure suppression; focused suite ผ่าน 2 tests ของ queue. Source audit หลังแก้ไม่พบ `void saveSettings` ใน Home route.

### H-03 — Timestamp label ไม่ตรงกับ `fetchedAt` semantics

**Reproduction and root cause.** Yahoo parser ใช้ `options.fetchedAt` เป็น server observation cutoff เพื่อตัดแท่งที่ยังไม่ปิด แต่ feed ที่ return ตั้ง `fetchedAt` เป็น timestamp ของแท่งปิดล่าสุดที่ยอมรับ. Home เดิมนำค่าดังกล่าวไปแสดงว่า “เวลาที่ server รับข้อมูล” ซึ่งเป็น claim ที่ไม่จริง.

**Fix.** คง contract เดิมเพื่อไม่ทำลาย freshness/no-look-ahead semantics แต่ document ชัดว่า `MarketDataFeed.fetchedAt` คือ latest accepted closed-candle timestamp และแก้ Home copy เป็น “แท่งปิดล่าสุดที่รับรอง”. `YAHOO_SETUP.md` ใช้คำเดียวกันและเตือนว่าเป็น freshness anchor ไม่ใช่ response-receipt time.

**Evidence.** เพิ่ม assertion ใน `src/lib/market/yahoo.test.ts` ว่า `feed.fetchedAt` เท่ากับเวลาแท่งปิดล่าสุดและไม่เท่ากับ observation cutoff. ใน local fallback state แถว timestamp ไม่ถูก renderเพราะไม่มี positive health timestamp จึงไม่นับเป็น visual confirmation ของ H-03; source/test evidence เป็นหลักฐานหลักของ fix.

## 3. Verification gates

Full gates รันหลัง source fixes และก่อน documentation-only synchronization. ผลคือ 108 tests จาก 28 test files ผ่าน, lint ผ่านโดยไม่มี error/warning, TypeScript noEmit ผ่าน, production Nitro build ผ่าน และ `git diff --check` สะอาด. Test count เพิ่มจาก baseline 107 เป็น 108 เนื่องจาก auth-failure policy regression.

| Gate | Result | Evidence/หมายเหตุ |
|---|---|---|
| Focused fix suite | **PASS** | 11 tests จาก 3 files: home-access, save-queue, Yahoo parser |
| `npm test` | **PASS** | 108 tests จาก 28 files |
| `npm run lint` | **PASS** | 0 errors, 0 warnings |
| `npx tsc --noEmit` | **PASS** | ไม่มี output/error |
| `npm run build` | **PASS** | Production/Nitro build สำเร็จ; route chunks ถูกสร้าง |
| `git diff --check` | **PASS** | ไม่พบ whitespace error |
| Legacy/provider scan | **PASS with documented legacy** | Active path ไม่ revive Twelve Data/Gold API/XAUEUR; compatibility parser/docs/tests คงไว้ตาม boundary |

ชุด tests ที่เกี่ยวกับ no-look-ahead, market contract, settlement, scoring, news cache, future-event masking, AI visible-ID guard และ randomized workflow ยังคงผ่านใน full suite. Settlement suite มี 10 regression cases ครอบคลุม source mismatch, reversed/duplicate/gap candles, malformed OHLC, timeout และ already-settled behavior; ผลลัพธ์ invalid ถูก fail closed เป็น `not_ready` [1] [4].

## 4. Browser and mobile evidence

Local dev server ที่ใช้ตรวจคือ `http://localhost:8080` และไม่มี `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`. จึงเห็น fallback/error states ได้จริง แต่ไม่ควรตีความเป็น production provider test. Browser console ระหว่าง smoke ไม่พบ runtime exception เพิ่มเติม; พบเพียง informational React DevTools message.

| Route/journey | Observed result | Boundary |
|---|---|---|
| `/login` | Login screen โหลดได้, Supabase unavailable ถูกแจ้งตรงไปตรงมา, มี Demo CTA | ไม่ได้กรอก credential หรือ submit account form |
| `/?demo=true` | เข้า Demo ได้, asset `Gold Futures (Yahoo proxy)`, `GC=F`, `15m`, `ERROR · DEMO fallback`, reason missing env | เป็น frozen fallback/local error state |
| `/` หลัง explicit Demo แล้ว | stored Demo flag `xaueur-lab:demo-mode:v1=1`; reload ไม่มี query ยังคงอยู่ Home | ยืนยัน route behavior ใน auth-failure local state |
| `/history` | safe empty state และ Cloud load failure toast; มี link กลับวิเคราะห์ | ยังไม่ใช่ authenticated persistence/RLS test |
| `/history/nonexistent` | ไม่รั่วข้อมูลหรือ stack trace; แสดง safe empty history state | detail-route behavior ใน deployed DB ยัง pending |
| `/news` | แสดง `GC=F · 15m`, published-only wording และ demo news/calendar state | ไม่ยืนยัน live news provider credentials |
| `/performance` | แสดง 0/0, low-sample warning, controlled pilot 0/80 และห้ามเรียก scenario weights เป็น probability | ไม่มี settled user sample ใน local env |
| `/settings` | default sliders, Cloud save failure status, password section ส่งกลับ Login โดยไม่มี session | ไม่ได้ทดสอบ write บน Cloud จริง |
| `/guide` | อธิบาย Yahoo delayed `GC=F`/`15m`, same-instrument fallback, no-look-ahead และ no-trading disclaimer | documentation smoke เท่านั้น |

Delayed screenshot captures ของ Home ที่ 360, 390, 412, 768 และ 1280px แสดง controls/cards wrap ได้, header truncate ปลอดภัย, provider reason อ่านได้ และ bottom navigation ไม่ชนเนื้อหาที่เห็น. Route screenshot smoke ที่ 360/412px ครอบคลุม Login, Home, History, nonexistent History, News, Performance, Settings และ Guide; ไม่พบ page-level horizontal clipping. Performance scoreboard ยังคง `min-w-[720px]` horizontal-scroll trade-off โดยตั้งใจเพื่อรักษาความอ่านได้ของตาราง ไม่ได้ทำ redesign ในรอบ correctness-first นี้ [6]. Screenshot binaries ถูกลบออกจาก working tree และไม่ได้ staged.

## 5. Architecture and integrity boundaries preserved

Active market architecture ยังเป็น server-side Yahoo Chart request สำหรับ `GC=F` ด้วย delayed 15-minute candles, bounded range, timeout, success-only cache, closed-candle/OHLC/symbol validation, 240-candle readiness และ same-instrument frozen fallback. ไม่มีการนำ XAUEUR, Gold API หรือ Twelve Data มาเป็น runtime fallback และไม่มี automatic trading/order execution path [1] [3] [4].

No-look-ahead boundary ยังคงครอบคลุมการตัด open/future candle, timestamp tolerance, exact `asOf` cache keys, future macro actual masking, AI payload visible-ID guard, chronological time-machine behavior และ forecast timestamps ที่ต้องอยู่หลัง `asOf`. การแก้ H-03 ไม่เปลี่ยน `fetchedAt` semantics จึงไม่ลดความเข้มงวดของ freshness check.

Prediction persistence และ settlement ยังยึด insert-only/immutable intent, owner scoping, duplicate outcome no-overwrite และ fail-closed invalid outcome behavior ตาม source contracts. อย่างไรก็ตาม การมี migration และ pgTAP file ใน repository ไม่ใช่หลักฐานว่า trigger/RLS ทำงานบน database จริง; distinction นี้ยังคงระบุใน project runbooks [2] [5].

## 6. Deferred items and production blockers

รอบนี้ไม่เปลี่ยน provider architecture, ไม่เพิ่ม scheduler, ไม่ revive legacy providers, ไม่เพิ่ม notification channel, ไม่ redesign Performance table และไม่ทำ speculative auth/DB rewrite. เหตุผลคือไม่มีหลักฐานว่า medium/low items เหล่านี้ทำให้ correctness เสียหาย และการเปลี่ยนจะเพิ่ม release risk.

ก่อน production deployment ต้องมีหลักฐานจาก environment จริงสำหรับรายการต่อไปนี้:

| Blocker | Required evidence |
|---|---|
| Supabase migrations/RLS/pgTAP | Deploy forward-only migrations ใน staging/project ที่ยืนยันแล้ว และรัน allow/deny/immutability tests จริง |
| Auth abuse controls | ตั้ง Anonymous Sign-In, CAPTCHA/Turnstile, rate limits และ cleanup policy |
| Yahoo runtime | ตรวจ public endpoint/rate limit, server secret/runtime behavior และ 240 closed-candle warmup ใน deployed environment |
| Authenticated isolation | ทดสอบผู้ใช้หลายรายจริงว่า `user_id` scoping/RLS ป้องกัน cross-owner read/write |
| Outcome settlement | ยืนยัน source/version policy ของ live outcome และเปิด scheduler/worker เฉพาะหลัง provider boundary พร้อม |
| Deployment | สังเกต deployment acceptance/health จาก hosting environment; ห้ามสรุป success จาก local build เพียงอย่างเดียว |

## 7. Codex handoff recommendation

แนะนำให้ส่ง candidate นี้เข้า Codex review ในฐานะ **source-reviewed, locally verified release candidate** โดยให้ reviewer ตรวจ diff ของ `src/routes/index.tsx`, `src/lib/home-access.ts`, `src/lib/save-queue.ts`, `src/lib/market/contract.ts`, `src/lib/market/yahoo.ts` และเอกสารที่ sync แล้ว. ก่อนเปิดใช้งานจริงต้องปิด external blockers ในตารางข้างต้นและแนบหลักฐานจาก Supabase/deployed Yahoo/runtime environment แยกจาก local evidence.

ไม่ควรเรียกสถานะนี้ว่า production-ready, live Yahoo verified, RLS verified, authenticated multi-user verified, scheduler verified หรือ live settlement verified. ข้อความที่ปลอดภัยคือ **“ผ่าน source/unit/build และ local browser hardening; รอ staging/production verification ที่ระบุไว้”**.

## References

[1]: CODE_MAP.md — architecture map, active Yahoo/GC=F path, contracts, tests และ boundaries
[2]: ROADMAP.md — phase status, acceptance criteria และ production blockers
[3]: YAHOO_SETUP.md — Yahoo Chart `GC=F`/`15m` runtime contract และ manual verification checklist
[4]: RED_TEAM_FINDINGS.md — red-team dispositions และ no-look-ahead/settlement/provider findings
[5]: MANUS_PROGRESS.md — historical milestones และ current overnight pass handoff
[6]: OVERNIGHT_BROWSER_NOTES.md — local route/mobile/browser evidence
[7]: OVERNIGHT_ISSUES.md — confirmed issue list, severity และ deferred disposition

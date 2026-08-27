# Overnight Release-Hardening Issue List

อัปเดต: 27 สิงหาคม 2026
Inspection base: `origin/main@0b18fb9` บน branch `main`
สถานะก่อนแก้: baseline tests/lint/typecheck/build/diff check ผ่าน

## Confirmed issues

| ID | Severity | Issue | Evidence | Disposition |
|---|---|---|---|---|
| H-01 | HIGH → **FIXED** | เมื่อ `getAuthSession()` ล้มเหลว Home route อนุญาต explicit `demo=true` แต่ไม่ honor stored Demo flag แม้ policy `resolveHomeAccess()` รองรับ stored Demo อยู่แล้ว; reload ของผู้ใช้ Demo จึงอาจถูกส่ง Login เมื่อ auth backend ชั่วคราวล้ม | `src/routes/index.tsx` `beforeLoad` และ `HomeGate` catch paths ตรวจเฉพาะ `search.demo === true` | ใช้ `shouldKeepDemoOnAuthFailure` ในทั้งสอง paths; เพิ่ม regression และ browser reload smoke |
| H-02 | HIGH → **FIXED** | Home Settings sheet เรียก `saveSettings()` แบบ fire-and-forget โดยไม่ใช้ `createLatestSaveQueue()` ซึ่ง Settings route ใช้อยู่แล้ว; rapid slider changes อาจเขียนค่าล้าสมัยทับค่าล่าสุด และ rejection อาจไม่ถูกแสดง | `src/routes/index.tsx` เทียบ `src/routes/settings.tsx` queue implementation | ใช้ latest-save queue เดียวกันใน Home และแสดง toast เมื่อ persistence error; existing queue regression ผ่าน |
| H-03 | HIGH → **FIXED** | `MarketDataFeed.fetchedAt` ของ Yahoo parser หมายถึงเวลาของแท่งล่าสุด แต่ Home แสดงเป็น `เวลาที่ server รับข้อมูล`; copy จึงเกินจริงเรื่อง observation timestamp | `src/lib/market/yahoo.ts` sets `fetchedAt` to last candle; `src/routes/index.tsx` rendered health timestamp as server receive time | คง fetchedAt เป็น freshness anchor, document semantics ใน contract/parser, แก้ UI/runbook เป็น latest accepted closed candle และเพิ่ม parser regression |

## Reviewed but intentionally deferred

| ID | Severity | Finding | Reason |
|---|---|---|---|
| M-01 | MEDIUM | Performance model scoreboard มี `min-w-[720px]` และ horizontal scroll บน mobile | เป็น trade-off ที่ตั้งใจเพื่อไม่บีบตารางจนอ่านผิด; ไม่มี clipping/overflow ของ page จาก mobile screenshots; ไม่เปลี่ยน correctness ในรอบนี้ |
| L-01 | LOW | Dashboard ใน Demo ยังมี CTA `เริ่ม Demo` แม้ผู้ใช้อยู่ใน Demo แล้ว | ไม่ทำให้ state ผิดหรือเกิด action อันตราย; เปลี่ยน copy/layout มี risk มากกว่าประโยชน์ใน release-hardening pass |
| L-02 | LOW | Local headless capture แรกเห็น hydration loading shell | เป็น capture timing ไม่ใช่ defect; delayed capture หลัง hydration แสดง layout ครบ |

## Negative findings

ไม่พบ source path สำหรับ automatic trading/order execution. Active market architecture ยังคง Yahoo Chart `GC=F` 15m แบบ server-side, same-instrument frozen fallback และ explicit state. Performance copy แสดง sample size/low-sample warning/uncertainty และไม่เรียก scenario weights ว่า probability. Cloud-store source แยก `user_id` และ duplicate settlement ไม่ overwrite ผลเดิมตาม contract.

หลัง fixes และ full verification ไม่มี BLOCKER หรือ HIGH ค้างใน source/local scope. Production Supabase/RLS, deployed Yahoo availability/rate limit, authenticated multi-user isolation และ scheduler ยังคงเป็น external verification blockers ตามเอกสารเดิม

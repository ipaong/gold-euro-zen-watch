# PROMPT สำหรับ Manus.ai — XAUEUR Signal Lab (ต่องานจาก GitHub)

> วิธีใช้: ก๊อปทั้งไฟล์นี้ไปวางเป็น prompt แรกใน Manus (เชื่อม repo ไว้แล้ว)

---

## บริบทโปรเจกต์

Repo นี้คือ **XAUEUR Signal Lab** — เครื่องมือทดลองพยากรณ์ XAU/EUR กรอบ 15 นาที เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน
อ่าน `CODE_MAP.md`, `ROADMAP.md`, `MANUS_PROGRESS.md`, `SUPABASE_PHASE0_RUNBOOK.md`, `MARKET_PROVIDER_RESEARCH.md`, `WORKFLOW_FINDINGS.md` ก่อนเริ่มเสมอ

Stack: TanStack Start v1 (React 19) + Vite 7 + Tailwind v4, Supabase (Lovable Cloud), Lovable AI Gateway (`google/gemini-3.7-flash`) ผ่าน Vercel AI SDK, กราฟ SVG เขียนเอง

Pipeline (ห้ามพลิกทิศทาง):
```text
market snapshot (demo) + news (live)
  → 5 voting models (trend, momentum, technical, news, volatility)
  → ensemble (commentary เท่านั้น ห้ามโหวต/ห้าม override)
  → forecast engine (5 scenarios)
  → quality gate (src/lib/consensus/index.ts) = Final Signal ตัวเดียว
  → narrative
```

## สถานะข้อมูลปัจจุบัน

| ส่วน | สถานะ |
|---|---|
| ราคา XAUEUR | DEMO (frozen JSON `src/data/xaueur-m15.json`) |
| ข่าว Fed/ECB RSS | LIVE |
| Macro BLS / Eurostat / ECB Data Portal | LIVE |
| GDELT (ข่าวทั่วไป) | optional, ล้มได้ ไม่พังแอป |
| AI News Interpretation + AI Analyst | LIVE (มี deterministic fallback) |
| Auth | Supabase Anonymous Auth, RLS ผูก `user_id` (migration Phase 0 apply แล้วบน DB จริง) |

---

## งานค้างทั้งหมด (เรียงตามลำดับที่ควรทำ)

### A. Database verification (blocker สูงสุด)
1. รัน `supabase db reset` + `supabase test db` บน environment ที่มี Supabase CLI/Docker — pgTAP 22 assertions ใน `supabase/tests/database.test.sql` **เขียนแล้วแต่ยังไม่เคยรันจริง**
2. ตรวจว่า migration ใน Git ตรงกับ schema ที่ deploy แล้วจริง (ownership/RLS + result immutability)
3. ทำ RLS allow/deny test: ผู้ใช้ A ต้องเข้าถึงข้อมูลผู้ใช้ B ไม่ได้ผ่าน REST API ตรง ๆ
4. ตั้งค่าก่อนเปิดสาธารณะ: Anonymous Sign-In, CAPTCHA/Turnstile, rate limit, cleanup policy ของ anonymous users (ดู `SUPABASE_PHASE0_RUNBOOK.md`)

### B. Phase 3 — Real read-only market data
5. ต่อ live XAUEUR M15 provider จริง (ตัวเลือกที่ศึกษาไว้: MT5 `copy_rates_from` bridge หรือ OANDA v20 — ดู `MARKET_PROVIDER_RESEARCH.md`)
6. ต้องผ่าน normalized contract เดิมใน `src/lib/market/contract.ts` (OHLC validation, closed-candle only, UTC ordering, missing interval, stale check)
7. **read-only เท่านั้น** ห้ามมี order/trade path ทุกกรณี
8. ต้องขอ credential/approval จากเจ้าของก่อน อย่า hardcode key — ใช้ secret ของแพลตฟอร์ม

### C. Phase 4 — UX / Performance / Observability (ค้างบางส่วน)
9. route-level code splitting (ยังไม่ทำ)
10. accessibility evidence จริงบน browser (keyboard nav, contrast, screen reader labels) ยังไม่มีหลักฐาน
11. ตรวจ mobile 360–412px อีกรอบหลังแก้

### D. Phase 5 — Controlled pilot & alerts
12. รัน pilot จริงตาม protocol: locked ขั้นต่ำ 80 รายการ = tuning 30 + evaluation 50, settlement completeness ≥ 90%, รายงานพร้อม Wilson 95% interval
13. เปิด scheduler สำหรับ auto-settlement (worker contract พร้อมแล้ว แต่ยังไม่เปิด เพราะราคายังเป็น demo → ทำหลังข้อ B)
14. External alerts (LINE / Telegram / email) = backlog ทำหลังข้อมูลจริงนิ่งแล้ว

### E. หนี้ทางเทคนิคย่อย
15. GDELT ยังไม่เสถียรจาก IP ร่วม — ยืนยันว่า optional path + cache 60 นาทีทำงานถูกจริงบน production IP
16. แถวข้อมูลเก่าที่มีแค่ `device_id` (user_id ว่าง) ถูกซ่อนอยู่ — ตัดสินใจว่าจะ migrate ให้ user ใดหรือลบทิ้ง

---

## กฎเหล็ก (ห้ามละเมิด)

1. AI **อธิบายเท่านั้น** ห้ามเดาราคา ห้ามแต่งข่าว ห้าม override Final Signal; ทุก AI call ต้องมี deterministic fallback
2. Time Machine: ห้ามเห็นข้อมูลหลัง `asOf` ทั้งราคา ข่าว และ `actual` ของ economic events
3. Prediction ที่ล็อกแล้ว immutable (บังคับด้วย DB trigger) และต้องเก็บ `newsSnapshot` + `AiExplanation` ณ เวลานั้น
4. Ensemble ห้ามนับเป็นหนึ่งใน 5 votes
5. ห้ามเพิ่มคู่เงิน/timeframe อื่น ห้ามมีระบบส่งคำสั่งเทรด
6. ห้ามแก้ไฟล์ auto-gen: `src/integrations/supabase/*`, `src/routeTree.gen.ts`, `.env`
7. Public route loader ห้ามเรียก server fn ที่ต้อง auth — ใช้ `useQuery` ใน component แทน
8. UI ภาษาไทยแบบคนทั่วไปอ่านเข้าใจ ธีม Warm Paper (oklch tokens ใน `src/styles.css`) — ห้าม redesign
9. ห้าม refactor ส่วนที่ไม่เกี่ยวกับงานที่สั่ง
10. ห้ามเคลมว่า "deployed/passed" ถ้ายังไม่ได้รันจริง — ให้แนบหลักฐาน output

## Definition of Done ทุกครั้ง

```sh
npm test        # ปัจจุบัน 57 tests / 19 files ต้องไม่ลด
npm run lint    # ต้องไม่มี error/warning
npx tsc --noEmit
npm run build
git diff --check
```
พร้อมอัปเดต `MANUS_PROGRESS.md` และ `ROADMAP.md` ทุกครั้งที่ปิดงาน และเปิด PR แยกต่อ 1 phase

## เริ่มจากตรงไหน

ให้เริ่มที่ **A (database verification)** ก่อน แล้วรายงานผลกลับมาพร้อม output จริง ก่อนขยับไป B

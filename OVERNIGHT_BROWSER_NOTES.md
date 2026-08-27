# Overnight Browser QA Notes

อัปเดต: 27 สิงหาคม 2026

## Login / first visit

Local route `/login` โหลดได้และแสดง `Market Prediction Playground`, `Gold Futures GC=F · 15m · Yahoo delayed`, สถานะฐานข้อมูลไม่พร้อม และปุ่ม/ลิงก์ `เข้าโหมด Demo`. ไม่ได้กรอกข้อมูลบัญชีหรือส่ง form ใด ๆ

## Explicit Demo

คลิก explicit Demo แล้วไป `/?demo=true` สำเร็จ. Dashboard แสดง asset `Gold Futures (Yahoo proxy)`, timeframe `15m`, `GC=F`, provider `ERROR · DEMO fallback`, เหตุผล missing Supabase environment และข้อความ Yahoo delayed/COMEX/non-XM. Final Signal แสดง `รอ`, confidence และเหตุผล quality gate; ไม่มีการเรียก Demo ว่า Live และไม่มี order/trade UI ที่พบใน viewport. Bottom navigation และ primary controls ปรากฏใน viewport ปัจจุบัน

## Environment limitation

Local console/route fallback คาดว่าจะมี missing `SUPABASE_URL` และ `SUPABASE_PUBLISHABLE_KEY`; local smoke จึงตรวจ fallback/error truthfulness ได้ แต่ยังไม่ใช่การยืนยัน deployed Supabase/RLS หรือ live Yahoo runtime


## Mobile capture — first pass

Headless screenshots ที่ 360px และ 412px สำเร็จ แต่ภาพแสดงเฉพาะ `กำลังตรวจสอบการเข้าสู่ระบบ…` เนื่องจากจับภาพก่อน hydration จบ จึงถือเป็นหลักฐาน loading state เท่านั้น ยังไม่ใช้ตัดสินเรื่อง overflow/layout และต้องทำ delayed capture ต่อ


## Mobile capture — delayed Home

ที่ 360px และ 412px หลังรอ hydration ภาพ dashboard แสดงครบตามที่คาด: header ข้อความถูก truncate อย่างปลอดภัย, asset/timeframe controls อยู่ใน card, provider error/fallback reason wrap ได้, Demo CTA และ SignalHero ไม่ล้นขอบ, bottom navigation อยู่ด้านล่างและไม่ทับเนื้อหาที่มองเห็นใน capture. ตาราง Performance ยังใช้ horizontal-scroll container โดยเจตนาและจะตรวจแยกบน route นั้น. ไม่พบ horizontal overflow ชัดเจนจาก Home capture รอบนี้


390px ยังคง wrap สวยและ controls/card อยู่ในขอบ. ที่ 768px layout ขยายเป็น single centered column ที่อ่านง่าย; provider/error card และ onboarding card ไม่ล้น, bottom navigation ไม่ชนเนื้อหาใน viewport. ภาพเหล่านี้เป็น local fallback state ไม่ใช่ live provider verification


## Route smoke — Login and explicit Demo

`/login` โหลดได้ใน local dev server และแสดงสถานะว่า Supabase ยังไม่เชื่อมต่ออย่างชัดเจน พร้อม CTA เข้า Demo. คลิก explicit Demo สำเร็จไป `/?demo=true`; Home แสดง active asset `Gold Futures (Yahoo proxy)`, timeframe `15m`, status `ERROR · DEMO fallback`, fallback reason ระบุ missing Supabase env และไม่กล่าวว่าเป็น execution price. Dashboard แสดง no-trading disclaimer, 5-candle forecast และ final signal `รอ` พร้อม quality gates. ผลนี้เป็น local environment ที่ไม่มี Supabase และไม่ใช่ production verification


## Route smoke — History

`/history` โหลดได้และแสดง empty state อย่างปลอดภัย พร้อมข้อความว่าโหลดบันทึกจาก Cloud ไม่สำเร็จใน local env และลิงก์กลับวิเคราะห์. `/history/nonexistent` ไม่แสดงข้อมูลหรือ stack trace; route แสดง safe empty history state เดียวกันพร้อม toast Cloud failure. จึงไม่มีหลักฐาน data leakage แต่ยังไม่ใช่ authenticated detail-route/RLS verification


## Route smoke — News and Performance

`/news` โหลดได้ใน Demo และระบุ `GC=F · 15m`, ข่าวตามเวลาที่วิเคราะห์, เห็นเฉพาะข่าวที่เผยแพร่แล้ว; local content ระบุ demo news/calendar ตาม environment. ไม่พบ future-news copy ในหน้านี้จากข้อมูลที่แสดง.

`/performance` โหลดได้และแสดงสถิติ 0/0 อย่างตรงไปตรงมา พร้อมคำเตือนว่า 0 settled examples ยังน้อยเกินสรุปความสามารถ; Controlled pilot protocol แสดง 0/80 และห้ามใช้ตัวเลขอ้างกำไรหรือ probability. ภาพ browser ที่ได้อยู่ใน centered mobile-like column และ page ไม่แสดง horizontal overflow ใน viewport; table-specific 720px trade-off ยังต้องตรวจด้วย scripted width metrics หากจำเป็น


## Route smoke — Settings and Guide

`/settings` โหลดได้ใน Demo; sliders แสดง default values 60% / 3 of 5 / 30 minutes และ status ระบุยังยืนยันการบันทึกไม่ได้เมื่อ Cloud load fail. Password section ปฏิเสธการเปลี่ยนรหัสผ่านโดยไม่มี session และชี้กลับ Login อย่างปลอดภัย. ไม่มี control clipping ที่ browser viewport.

`/guide` โหลดได้; เนื้อหา active architecture ระบุ Yahoo delayed Gold Futures GC=F 15m, same-instrument demo snapshot, no-look-ahead, future news masking, quality-gate final signal และ no-trading/education disclaimer. ไม่มีการกล่าวว่า Yahoo เป็น XM execution price


## Browser console and overflow metric

หลัง route smoke ต่อเนื่อง browser console พบเฉพาะ React DevTools informational message; ไม่พบ runtime exception เพิ่มเติมใน console view. Metric บน Guide viewport `1280x1100`: `clientWidth=1265`, `scrollWidth=1265`, `overflowX=false`; document height 1444 จึงเป็น vertical scroll ตามปกติ


## Mobile route screenshot smoke — 360px / 412px

สร้างและตรวจ delayed screenshots 16 ภาพ (Login, Home Demo, History, nonexistent History, News, Performance, Settings, Guide ที่ 360px และ 412px). ทุก route อยู่ใน viewport หลักโดยไม่มี page-level horizontal clipping ที่มองเห็น; card และข้อความ wrap ตามความกว้าง, bottom navigation คงที่ด้านล่าง, controls แตะได้ในภาพ. Home แสดง provider error/demo fallback อย่างชัดเจน; History/Settings แสดง Cloud failure อย่างไม่อ้างว่าบันทึกสำเร็จ; Performance แสดง low-sample warning; Guide แสดง no-look-ahead/disclaimer. ไม่มี route-specific mobile defect ที่ยืนยันได้ จึงไม่ทำ cosmetic refactor


## H-01 regression smoke — stored Demo reload

หลัง explicit Demo journey แล้วเปิด `http://localhost:8080/` โดยไม่มี `?demo=true`; route ยังคงอยู่ที่ Home และแสดง dashboard/error fallback แทนการ redirect ไป Login. Source constant ที่ยืนยัน key จริงคือ `xaueur-lab:demo-mode:v1`; console probe รอบแรกใช้ guessed key จึงได้ `null` และไม่นับเป็น storage assertion. Home presence และ URL ที่ไม่ redirect เป็นหลักฐาน route-level behavior ที่ต้องการ


Exact browser assertion หลัง reload: URL `http://localhost:8080/`, `localStorage['xaueur-lab:demo-mode:v1'] === '1'`, และ Home heading มีอยู่จริง. จึงยืนยัน H-01 route behavior ใน local auth-failure state.

Browser keyword search ไม่พบ `แท่งปิดล่าสุดที่รับรอง` ใน current Demo fallback page เพราะ provider health timestamp row ไม่ถูก render เมื่อ fallback result ไม่มี positive fetchedAt; จึงไม่นับเป็น visual confirmation ของ H-03 label. Source tests/static diff ยังคงเป็นหลักฐานของ copy change และ parser semantics. ไม่พบข้อความเก่าใน source diff หลังแก้

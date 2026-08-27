# Dual-Mode Browser Smoke Notes

วันที่: 28 สิงหาคม 2026

## Local smoke: Cloud Mode

เปิด `http://localhost:8080/?demo=true` บน local dev server หลัง dual-mode implementation. หน้า Home แสดง mode switch สองตัวเลือกอย่างชัดเจน: `Cloud Mode · GC=F · COMEX Gold Futures · 15m` และ `XM Live Mode · GOLD · XM MT5 · M15`. Cloud state แสดง `ERROR · DEMO fallback` พร้อมคำอธิบายว่าใช้ Yahoo/frozen GC=F snapshot และระบุ missing local Supabase environment variables; หน้าแสดงผลวิเคราะห์ demo ตามที่คาด.

## Local smoke: XM Live Mode

คลิก `XM Live Mode` แล้วตรวจว่า URL ยังคงเป็น `/?demo=true` แต่ header เปลี่ยนเป็น `XM GOLD`, badge เป็น `XM bridge offline`, status card เป็น `OFFLINE · XM bridge`, และข้อความระบุว่าไม่มี closed candle จาก XM MT5 bridge และจะไม่ใช้ `GC=F` หรือ snapshot คนละ instrument แทน. หน้าแสดง `XM Live ยังไม่พร้อม` พร้อม action `ใช้ Cloud Mode แทน`. เนื่องจาก local ไม่มี `SUPABASE_URL` และ `SUPABASE_PUBLISHABLE_KEY`, ยังไม่มี real XM feed ให้ตรวจ.

ข้อจำกัด: smoke นี้เป็น local fallback/error state ไม่ใช่การยืนยัน Supabase migration, Edge Function, MT5 terminal, XM account หรือ production deployment.

## Mobile contact-sheet QA

สร้าง route captures ใหม่ 16 ภาพสำหรับ Login, Home Demo, History, nonexistent History, News, Performance, Settings และ Guide ที่ 360px และ 412px หลังเพิ่ม dual-mode UI. ตรวจ contact sheets แล้ว Home ที่ 360/412 แสดง mode switch สองปุ่มและข้อความ Cloud/GC=F อ่านได้โดยไม่เห็น horizontal overflow; bottom navigation อยู่ในกรอบและ route อื่น ๆ ไม่แสดง clipping ที่เป็น blocker. Home บน 360px ยาวและข้อมูลแน่นตาม design เดิม แต่ mode cards และ status/error copy ยังอ่านได้. Performance ยังคงมีตารางแนวนอนตาม intentional trade-off เดิม. Captures เป็นไฟล์ชั่วคราวใน `/tmp` และไม่ถูก stage/commit.

## Stored XM mode reload

หลังเลือก XM Live Mode แล้ว reload `http://localhost:8080/?demo=true` โดยไม่เปลี่ยน local preference หน้าเดิมยังแสดง `XM GOLD`, `XM bridge offline`, `OFFLINE · XM bridge` และปุ่ม `ใช้ Cloud Mode แทน`. ไม่ปรากฏสัญญาณจาก GC=F. ข้อความ error ยังคงสะท้อน local Supabase env ที่ไม่มีค่า จึงเป็นการยืนยันเฉพาะ local preference/UI persistence ไม่ใช่การยืนยัน bridge หรือ production.

## Explicit XM → Cloud recovery

จาก XM offline state กด `ใช้ Cloud Mode แทน` แล้ว Home กลับเป็น Cloud Mode แสดง `ERROR · DEMO fallback`, `Yahoo Gold Futures`, GC=F copy และวิเคราะห์ frozen GC=F snapshot. การเปลี่ยน source เกิดจาก action ของผู้ใช้ ไม่ใช่ automatic fallback.

## Console and overflow checks

หลัง toggle Cloud/XM และ explicit recovery ตรวจ console แล้วพบเฉพาะ expected Supabase configuration errors เนื่องจาก local environment ไม่มี `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`; ไม่พบ unexpected runtime exception. DOM metrics ของ XM offline session และ Cloud recovered session ไม่มี page-level horizontal overflow (`scrollWidth === clientWidth` ในแต่ละ session; browser viewport ปัจจุบัน 896px). Cloud recovery DOM ยืนยันมี `ERROR · DEMO fallback` และ `GC=F`, ไม่มี `OFFLINE · XM bridge` ค้างอยู่.

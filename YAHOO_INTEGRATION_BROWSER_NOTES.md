# Yahoo integration browser evidence

อัปเดตวันที่ 27 สิงหาคม 2026 บน branch `manus/red-team-yahoo-integration` โดยใช้ local dev server `http://localhost:8080` และเปิด `/?demo=true` หลัง source reload สำเร็จ

| เส้นทาง/สถานการณ์ | ผลที่ตรวจได้ |
|---|---|
| Explicit Demo | เข้า dashboard ได้ แม้ไม่มี Supabase/Auth environment; ไม่ถูก redirect ไป login |
| Market identity | แสดง `Gold Futures (Yahoo proxy)`, `GC=F`, timeframe `15m` และคำเตือนว่า Yahoo delayed ไม่ใช่ XM XAUUSD/XAUEUR CFD |
| Fallback state | แสดง `ERROR · DEMO fallback` และเหตุผล missing `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` จาก local environment; frozen fallback ยังคงเป็น GC=F |
| Home analysis | dashboard แสดง signal, forecast, model votes และ narrative ที่อ้าง `GC=F`; ไม่พบ active Gold API/Twelve Data copy ในหน้าที่ตรวจ |
| Browser runtime | หน้า hydrate ได้ ไม่มี runtime exception อื่นจากเส้นทาง Home ที่ตรวจ; live Yahoo production ไม่ได้ถูกอ้างว่าผ่าน |

การตรวจครั้งนี้ใช้ default browser viewport; ยังไม่ใช่ dedicated 360/390/412px mobile, screen-reader หรือ contrast audit


## Additional routes

| เส้นทาง | ผลที่ตรวจได้ |
|---|---|
| `/login` | title/header ใช้ `Market Prediction Playground`; subline ระบุ `Gold Futures GC=F · 15m · Yahoo delayed`; เมื่อ backend ไม่พร้อมแสดง Demo CTA อย่างชัดเจน |
| `/history` | route โหลดได้ แสดง empty state และ toast `โหลดบันทึกจาก Cloud ไม่สำเร็จ` ตาม missing local Supabase; header ไม่แสดง legacy provider label |

ทั้งสองเส้นทางตรวจบน local environment ที่ไม่มี credentials จึงไม่ได้อ้าง authenticated account หรือ Cloud persistence ผ่าน


## Detail and performance routes

| เส้นทาง | ผลที่ตรวจได้ |
|---|---|
| `/history/nonexistent` | เนื่องจาก Cloud ไม่พร้อม route แสดง safe empty/not-found-style journal state และ toast load failure; ไม่แสดงข้อมูล fabricated หรือ settlement outcome |
| `/performance` | แสดงว่า statistics คำนวณจาก locked predictions และ revealed outcomes ของผู้ใช้เอง; empty state 0/0 และ controlled pilot protocol 0/80/0/50 โดยไม่มีการอ้างผลจำลองเป็น performance |

ทั้งสองเส้นทางยังอยู่ใน local no-Supabase environment จึงตรวจ persistence จริงไม่ได้


## News and guide routes

| เส้นทาง | ผลที่ตรวจได้ |
|---|---|
| `/news` | title/header ใช้ `Gold Futures Playground` และ `Gold Futures (Yahoo proxy) · GC=F · 15m`; snapshot เดโมแสดงเป็น `ข่าวเดโม`; macro actual ที่อยู่ก่อน asOf แสดงได้ตามเวลาที่เผยแพร่ |
| `/guide` | อธิบาย Yahoo GC=F delayed, same-instrument frozen fallback, validation/freshness conditions และ no-look-ahead; title/metadata ใช้ Market Prediction Playground |

ไม่พบ active XAUEUR/Gold API/Twelve Data wording ในสองหน้าที่ตรวจ


## Settings route

`/settings` โหลดได้ด้วย metadata `ตั้งค่าเกณฑ์คุณภาพ — Market Prediction Playground`; ค่าเริ่มต้นแสดงได้ และระบบแจ้งตรงไปตรงมาว่ายังยืนยันการบันทึกบน Cloud ไม่ได้เมื่อ Supabase ไม่พร้อม พร้อมลิงก์กลับ Login สำหรับเปลี่ยนรหัสผ่าน ไม่มี active legacy provider wording ในหน้านี้

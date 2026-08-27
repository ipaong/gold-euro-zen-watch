# Twelve Data pricing/credits check

วันที่ตรวจสอบ: 27 สิงหาคม 2026

## แหล่งทางการ

- [Individual Pricing](https://twelvedata.com/pricing)
- [Credits](https://support.twelvedata.com/en/articles/5615854-credits)
- [Time Series API](https://twelvedata.com/docs/market-data/time-series)
- [Gold Spot / Euro (XAU/EUR)](https://twelvedata.com/markets/517507/commodity/xau-eur)

## ข้อเท็จจริงที่อ่านได้

หน้า Individual Pricing แสดง Basic เป็น Free และระบุ `8 API (800 a day) + 8 trial WS`; หน้าเดียวกันแสดง Grow `377 API + 8 trial WS`, Pro `1,597 API + 1,500 WS` และ Ultra `10,946 API + 10,000 WS` ในบัตรราคา ณ วันที่ตรวจสอบ ตัวเลขของแผนเสียเงินควรตรวจซ้ำในบัญชีผู้ใช้ก่อนซื้อ เพราะหน้า pricing อาจเปลี่ยนตาม billing/annual toggle และการเลือกตลาด

Time Series API documentation ระบุชัดว่า endpoint นี้ใช้ `1 credit per symbol` และ `outputsize` รองรับ 1–5,000 จุด โดยค่า default คือ 30 เมื่อไม่ได้ระบุ date parameters. บทความ Credits อธิบายหลักรวมว่า API quota คิดตาม `data weight × number of symbols` ต่อ endpoint ต่อนาที ดังนั้นคำขอ 1 symbol ต่อครั้งของแอปนี้มีน้ำหนัก 1 credit ตามเอกสาร ทั้งนี้สิทธิ์ endpoint/ตลาดและแผนยังต้องยืนยันในบัญชี

บทความเดียวกันระบุว่า API credits รีเซ็ตทุกนาที และ Basic มี daily limit 800 ที่ reset เวลา 00:00 UTC; แผนเสียเงินไม่มี daily limit ตามบทความดังกล่าว หากเกิน quota จะได้ HTTP 429 และ response headers มี `api-credits-used` กับ `api-credits-left` สำหรับติดตามการใช้

หน้า XAU/EUR ของ Twelve Data ยืนยัน canonical symbol เป็น `XAU/EUR`, instrument type เป็น Commodity และระบุว่าเข้าถึง `/time_series` สำหรับ commodity ได้ตั้งแต่ Basic plan ขึ้นไป อย่างไรก็ตามคำว่า Basic ในหน้านี้ไม่ควรถูกตีความว่าแผน Free มีสิทธิ์ commodity intraday ครบทุกแบบโดยไม่ตรวจรายละเอียดบัญชี/endpoint entitlement

## เทียบกับ implementation ปัจจุบัน

แอปขอเพียง 1 symbol (`XAU/EUR`) ต่อ request, ใช้ `outputsize=600`, cache สำเร็จฝั่ง server 60 วินาที และตอนนี้ refetch ประมาณทุก 5 นาทีต่อ browser tab. หากเปิด 1 tab ต่อเนื่อง 24 ชั่วโมง จะเกิดสูงสุดประมาณ 288 requests/day ก่อนนับการกด refresh เอง; หากเปิด 2 tabs จะประมาณ 576 requests/day แต่ยังต้องเผื่อผู้ใช้อื่นและ retry

ดังนั้น Basic/Free **พอสำหรับการทดสอบส่วนตัว 1 tab ที่ refresh ทุก 5 นาที** เพราะอยู่ต่ำกว่า daily limit 800 แต่ไม่ควรตีความว่าเพียงพอสำหรับผู้ใช้หลายคนหรือเปิดหลาย tab โดยไม่มี shared cache, rate-limit และ backoff

บทความ Control over API usage ระบุว่า endpoint `/api_usage` ให้ข้อมูล plan และ credits แบบ real-time แต่การเรียก endpoint นี้ใช้ 1 API credit เช่นกัน อีกทางหนึ่ง response headers `api-credits-used` และ `api-credits-left` บอกจำนวนเครดิตที่ใช้และเหลือหลัง request จึงเหมาะกับการทำ usage guard โดยไม่ต้องเรียก `/api_usage` ทุกครั้ง

หน้า Terms of Use ที่ระบุอัปเดต 1 มกราคม 2026 ให้ Twelve Data ระงับบริการได้ทันทีกรณี security violation, ไม่ชำระเงิน, excessive usage ที่กระทบลูกค้ารายอื่น หรือสงสัย fraud/illegal activity และระบุว่าบริการ/ข้อมูลเป็น “as is/as available”, อาจเปลี่ยน/หยุด endpoint หรือ data ได้ และข้อมูลไม่ใช่คำแนะนำการลงทุน

ระบบยังคง fallback เป็น frozen demo เมื่อ quota/plan/key/provider ไม่พร้อม และยังไม่เปิด live settlement หรือ WebSocket

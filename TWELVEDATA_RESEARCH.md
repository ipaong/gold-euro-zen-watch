# Twelve Data integration research

> **สถานะ: DEPRECATED / REPLACED** — research นี้เป็นบันทึกของ provider เดิมเท่านั้น ปัจจุบัน runtime ใช้ Gold API ผ่าน Supabase ตาม `GOLD_API_SETUP.md`

วันที่ตรวจสอบ: 2026-08-27

## แหล่งอ้างอิง

1. [Twelve Data Time Series API documentation](https://twelvedata.com/docs/market-data/time-series)
2. [How to find all available symbols at Twelve Data](https://support.twelvedata.com/en/articles/5620513-how-to-find-all-available-symbols-at-twelve-data)

## ข้อค้นพบที่ใช้กับ implementation

- Time series endpoint คือ `https://api.twelvedata.com/time_series` และรองรับพารามิเตอร์ `symbol`, `interval`, `timezone` และพารามิเตอร์จำกัดจำนวน/ช่วงข้อมูลตามเอกสาร
- Interval ที่เอกสารระบุว่ารองรับมี `15min`; แอปจะ map เป็น timeframe ภายใน `M15`
- ต้องขอ datetime ด้วย `timezone=UTC` เพื่อให้การแปลง timestamp deterministic และไม่ขึ้นกับ timezone ของ exchange/server
- Twelve Data ระบุว่า endpoint ส่ง `meta` และ `values`; adapter ต้อง parse/validate response ก่อนส่งเข้า normalized market contract ของแอป
- เอกสาร symbol ระบุว่าต้องตรวจ symbol ผ่าน reference data และแยกประเภท physical forex กับ commodities; จึงไม่ควรสมมติว่า `XAUEUR` ใช้รูปแบบเดียวกับ `EUR/USD`
- ก่อนเปิดใช้ live provider ต้องยืนยัน symbol ที่บัญชี/แพ็กเกจรองรับ และรักษา frozen demo fallback หาก provider ไม่พร้อมหรือข้อมูลไม่ผ่าน validation

## ข้อจำกัดด้านความปลอดภัยของเส้นทางเดิม (historical)

- API key ต้องอยู่ใน server runtime secret ชื่อ `TWELVEDATA_API_KEY` เท่านั้น ห้ามใช้ `VITE_` prefix และห้ามส่ง key ไป browser
- Adapter เป็น read-only: ไม่มีคำสั่งซื้อขาย, broker bridge, lot sizing หรือการเขียนผลคาดการณ์อัตโนมัติ
- รับเฉพาะ `XAUEUR`, `15min`, แท่งที่ปิดแล้ว, timestamp UTC, ค่า OHLC finite และ high/low สอดคล้องกับ open/close
- ข้อมูลที่ stale, error, symbol ไม่ตรง หรือไม่มีแท่งปิด ต้องทำให้ UI แสดง provider health/fallback อย่างชัดเจน ไม่ใช่ป้อนข้อมูลผิดเข้า analysis engine

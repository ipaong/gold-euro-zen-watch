# XAUEUR M15 Market Provider Research

อัปเดต: 27 สิงหาคม 2026

## ข้อสังเกตจากเอกสารทางการ

| Provider/แนวทาง                 | สิ่งที่ยืนยันได้                                                                                                                                                                | Trade-off สำหรับโปรเจกต์นี้                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MetaTrader 5 Python integration | `copy_rates_from` คืนแท่งที่มีเวลาเปิดน้อยกว่าหรือเท่ากับเวลาที่ขอ, เวลาใน MT5 เป็น UTC และจำนวนแท่งย้อนหลังขึ้นกับประวัติที่ terminal มี; รองรับ `TIMEFRAME_M15`               | สอดคล้องกับ roadmap และ broker-specific XAUEUR แต่ต้องมี terminal/credential/bridge ภายนอก จึงยังไม่เปิดเป็น live adapter ใน sandbox                                |
| OANDA v20 REST                  | เอกสารนิยาม granularity `M15`, มี `complete` flag ระบุว่าแท่งปิดแล้วหรือยัง และมี OHLC/volume; ต้องใช้ v20 account/token และ symbol universe อาจไม่ตรง XAUEUR ของ broker ผู้ใช้ | contract ดีสำหรับตัวอย่าง closed-candle API แต่ยังไม่เลือกเป็น vendor เพราะ instrument mapping, account และค่าใช้จ่าย/สิทธิ์ใช้งานต้องได้รับการยืนยันจากเจ้าของก่อน |

## การตัดสินใจที่ทำได้โดยไม่ต้องใช้ credential

ระบบจะรักษา `MarketDataProvider` เป็น abstraction และเพิ่ม **normalized read-only contract** ที่ตรวจ OHLC, UTC timestamp, closed-candle status, symbol mapping, source และ freshness metadata ก่อนส่งเข้า pipeline เป้าหมายระยะถัดไปยังคงเป็น MT5 → Python read-only bridge → authenticated API → backend → app ตาม roadmap แต่ milestone นี้จะมีเพียง contract, validator, fixture และ tests เท่านั้น ห้ามอ้างว่า live และห้ามเพิ่มเส้นทางส่งคำสั่งซื้อขาย

## Sources

1. [MQL5 `copy_rates_from` — Python Integration](https://www.mql5.com/en/docs/python_metatrader5/mt5copyratesfrom_py)
2. [OANDA v20 Instrument Definitions](https://developer.oanda.com/rest-live-v20/instrument-df/)

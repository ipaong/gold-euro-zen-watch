# Dual-Mode External Research Notes

อัปเดต: 28 สิงหาคม 2026

## Official MetaTrader 5 Python integration

เอกสารทางการของ MQL5 ระบุว่า Python integration ติดต่อกับ MetaTrader 5 terminal ผ่าน interprocess communication เพื่อรับข้อมูลตลาดและนำไปใช้กับสถิติ/แมชชีนเลิร์นนิงได้. การติดตั้ง package ใช้ `pip install MetaTrader5`, และ lifecycle มี `initialize()` สำหรับเชื่อมต่อกับ terminal กับ `shutdown()` สำหรับปิดการเชื่อมต่อ.

`initialize()` เชื่อมต่อ terminal ได้โดยค้นหาอัตโนมัติ, ระบุ path ของ executable, หรือระบุ path พร้อม login/password/server/timeout/portable. ฟังก์ชันคืนค่า `True` เมื่อเชื่อมต่อสำเร็จและ `False` เมื่อไม่สำเร็จ; ตัวอย่างทางการตรวจ `last_error()` เมื่อเชื่อมต่อไม่ได้.

`copy_rates_from_pos(symbol, timeframe, start_pos, count)` อ่าน bars จาก terminal โดย bar index นับจากปัจจุบันย้อนกลับไปอดีต: position `0` คือ bar ปัจจุบัน. ผลลัพธ์มี columns `time`, `open`, `high`, `low`, `close`, `tick_volume`, `spread` และ `real_volume`; คืน `None` เมื่อผิดพลาดและให้ตรวจ `last_error()`. จำนวน bars ที่มีได้ขึ้นกับ history ที่ terminal โหลดไว้และค่า Max. bars in chart.

ดังนั้น bridge ของโครงการจะ request position `1` เป็นต้นไป ไม่ส่ง bar ปัจจุบันที่ยังไม่ปิด, convert `time` seconds เป็น UTC milliseconds, validate symbol/timeframe/OHLC/count/order อีกชั้นใน server และถือว่า terminal/history availability เป็น runtime dependency. Bridge ใช้เฉพาะ read functions และไม่เรียก `order_send`, positions หรือ trade functions.

## Sources

- https://www.mql5.com/en/docs/python_metatrader5/mt5initialize_py — official `initialize` reference
- https://www.mql5.com/en/docs/python_metatrader5/mt5copyratesfrompos_py — official bar retrieval and position numbering reference
- https://www.mql5.com/en/docs/python_metatrader5 — official package overview and integration functions

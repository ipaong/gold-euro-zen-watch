# XM Live Mode bridge

Bridge นี้อ่านแท่ง `GOLD` จาก **XM MetaTrader 5 บน Windows PC เครื่องเดียวกับที่เปิด terminal** แล้วส่งแท่งที่ปิดแล้วขึ้น Supabase Edge Function เพื่อให้เว็บแอปวิเคราะห์ด้วย source เดียวกับกราฟ XM ของคุณมากที่สุด

> Bridge นี้เป็น **read-only**. มันไม่เรียก `order_send`, ไม่เปิด/ปิดออเดอร์, ไม่อ่านเพื่อส่งคำสั่ง และไม่มี automatic trading path.

## สิ่งที่ต้องมี

ต้องติดตั้ง MetaTrader 5 desktop, login บัญชี XM ให้สำเร็จ, เห็น symbol `GOLD` ใน Market Watch และเปิด history ของกราฟ `GOLD` timeframe M15 ไว้ก่อน. MetaTrader5 Python package ติดต่อกับ terminal ที่กำลังทำงานอยู่ ไม่ใช่ XM server โดยตรงจาก Vercel.

ต้องมี Python บน Windows และติดตั้ง package ใน virtual environment:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r bridge\requirements.txt
```

## ตั้งค่าความลับ

ตั้งค่า `XM_BRIDGE_ENDPOINT` เป็น URL ของ Supabase Edge Function ที่ deploy แล้ว เช่น:

```text
https://<project-ref>.supabase.co/functions/v1/xm-bridge-ingest
```

ตั้งค่า `XM_BRIDGE_SECRET` ให้ตรงกับ Supabase Edge Function secret ชื่อเดียวกัน. ห้ามใส่ secret ใน source, README, browser JavaScript หรือ git. ตัวอย่าง PowerShell สำหรับ session ปัจจุบัน:

```powershell
$env:XM_BRIDGE_ENDPOINT = "https://<project-ref>.supabase.co/functions/v1/xm-bridge-ingest"
$env:XM_BRIDGE_SECRET = "ใส่-secret-ของคุณในเครื่องเท่านั้น"
```

## ทดสอบส่งหนึ่งครั้ง

เปิด MT5 และ login XM ก่อน แล้วรันจาก directory ที่มี repository:

```powershell
python bridge\xm_mt5_bridge.py --once --bars 600
```

ผลสำเร็จจะรายงานจำนวนแท่งที่ส่งและ timestamp ของแท่งล่าสุด. ถ้า `initialize` หรือ `copy_rates_from_pos` ล้มเหลว ให้ตรวจว่า MT5 terminal เปิดอยู่, login ถูกบัญชี, symbol เป็น `GOLD` จริง และมี history M15 โหลดไว้.

## รันต่อเนื่อง

เมื่อทดสอบครั้งเดียวผ่านแล้ว ให้รัน bridge ต่อเนื่อง:

```powershell
python bridge\xm_mt5_bridge.py --bars 600 --poll-seconds 60
```

กระบวนการจะดึงจาก position `1` ไม่ใช่ position `0`; position `0` คือแท่งปัจจุบันที่อาจยังไม่ปิด. ทุก cycle ส่ง closed bars แบบเรียงเวลาเพื่อให้ server dedupe ด้วย bucket และรักษา immutability. หากส่งไม่สำเร็จ bridge จะแสดง error และลองใหม่ในรอบถัดไป โดยไม่สร้างแท่งปลอม.

สำหรับการเปิดอัตโนมัติหลัง reboot ให้ใช้ Windows Task Scheduler ภายหลังที่ทดสอบแบบ manual ผ่านแล้ว และเก็บ environment secret ใน user-level environment/secret manager ที่ปลอดภัย ไม่ใช่ command line history หรือไฟล์ที่ commit.

## สถานะในเว็บแอป

เลือก **XM Live Mode** ในหน้า Analyze. ระบบจะใช้เฉพาะ `GOLD · 15m` จาก `xm_market_candles`; หาก bridge เงียบ, Supabase ยังไม่มี migration, มีแท่งน้อยกว่า warmup หรือข้อมูล stale ระบบจะแสดง `BRIDGE OFFLINE`, `WARMING` หรือ `BRIDGE STALE` และจะ **ไม่สลับไป `GC=F` โดยอัตโนมัติ**. หากต้องการวิเคราะห์ต่อ ให้กดเลือก **Cloud Mode** เอง ซึ่งใช้ Yahoo `GC=F` และมีสถานะ delayed ตาม contract เดิม.

Prediction ที่บันทึกใน XM mode จะเก็บ `GOLD`, XM/MT5 และ candle snapshot ไว้ใน journal. ห้ามนำ XM prediction ไป settlement ด้วย Yahoo `GC=F` หรือ legacy XAUEUR จนกว่าจะมี source-faithful XM settlement path ที่ผ่านการทดสอบ.

## Troubleshooting

ถ้าเห็น `MetaTrader5 package is required`, ให้ activate virtual environment แล้วติดตั้ง `requirements.txt` อีกครั้ง. ถ้าเห็น `MT5 symbol_select failed`, เปิด symbol `GOLD` ใน Market Watch หรือแก้ให้บัญชี XM แสดง symbol นี้ก่อน; bridge จงใจไม่เดา alias อย่าง `XAUUSD`.

ถ้า Edge Function ตอบ `401`, secret ใน PC ไม่ตรงกับ `XM_BRIDGE_SECRET`. ถ้าตอบ `503`, Supabase function ยังไม่มี service-role configuration. ถ้าตอบ `422`, payload ไม่ผ่าน closed-bar, OHLC, UTC alignment หรือ duplicate/order validation; ห้ามปิด validation เพื่อให้ข้อมูลผ่าน.

## ขอบเขตความน่าเชื่อถือ

XM Live Mode จะเป็น “source-aligned” ก็ต่อเมื่อ bridge ใช้บัญชี XM เดียวกับกราฟที่คุณดู, terminal โหลด history ครบ และ deployment ของ Supabase migration/function ผ่านจริง. ราคา CFD ของ XM อาจยังมีรายละเอียดเฉพาะบัญชี เช่น spread และ session ดังนั้นต้อง verify ราคา/แท่งกับ MT5 หลังติดตั้งก่อนใช้ผลวิเคราะห์. โหมดนี้มีไว้ทดลองและบันทึกผล ไม่ใช่คำแนะนำการลงทุน.

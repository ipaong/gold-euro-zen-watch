# ตั้งค่า Twelve Data ให้กราฟใช้ราคาจริง

## สิ่งที่โค้ดรองรับแล้ว

หน้า Home จะเรียก Twelve Data จากฝั่ง server ทุกประมาณ 5 นาที โดยขอ `XAU/EUR` ที่ interval `15min` และ timezone `UTC` ผ่าน endpoint `time_series` ข้อมูลที่นำเข้า analysis ต้องเป็นแท่งที่ปิดแล้ว เรียงตามเวลา มี OHLC ที่ถูกต้อง และมีอย่างน้อย 240 แท่งเพื่อให้ EMA200 มี warmup เพียงพอ

ถ้าเรียก provider ไม่สำเร็จ, ไม่มี secret, symbol ไม่ตรง, plan ไม่อนุญาตข้อมูล commodity หรือข้อมูลย้อนหลังไม่พอ แอปจะไม่ป้อนข้อมูลที่ไม่ผ่านการตรวจเข้า engine แต่จะกลับไปใช้ frozen demo พร้อมแสดงเหตุผลบนหน้า Home

> การเชื่อมต่อนี้เป็น **read-only เท่านั้น** ไม่มีคำสั่งซื้อขาย, broker bridge, lot sizing หรือ automatic trade execution

## ตั้งค่าใน Lovable

ในโปรเจกต์ Lovable ให้เปิดส่วน Secrets/Environment Variables ของโปรเจกต์ แล้วเพิ่ม secret ชื่อ:

```text
TWELVEDATA_API_KEY=<วาง API key ของ Twelve Data ที่นี่>
```

อย่าเติม `VITE_` ข้างหน้า และอย่าใส่ key ลงใน source code, Git, browser code หรือไฟล์ที่ commit เข้า repository เพราะ server function จะอ่านค่านี้เองจาก runtime ฝั่ง server

จากนั้นให้ restart/redeploy preview ของ Lovable ตาม workflow ของโปรเจกต์ เพื่อให้ server runtime เห็น secret ใหม่ การเพิ่ม secret อย่างเดียวอาจยังไม่ทำให้ process ที่กำลังรันอยู่โหลดค่าใหม่ทันที

## ตรวจสอบบนหน้า Home

เมื่อเปิดหน้า Home แล้ว ให้ดูแผง **แหล่งข้อมูลราคา** ด้านบน:

| สถานะ | ความหมาย |
|---|---|
| `LIVE · read-only` | ได้ข้อมูล XAU/EUR M15 จาก Twelve Data และผ่าน validation ขั้นต้นแล้ว |
| `DEMO fallback` | ใช้ชุดข้อมูลเดโม เพราะ key/plan/provider/ข้อมูลไม่พร้อม หรือข้อมูลไม่ผ่าน guard |
| `กำลังตรวจข้อมูลรอบใหม่…` | กำลัง refresh ข้อมูลรอบถัดไป โดยยังใช้ผลล่าสุดระหว่างรอ |

ป้ายด้านบนของแอปจะเปลี่ยนเป็น `Twelve Data · read-only` เมื่อ live feed ถูกใช้จริง ส่วนคำเตือนด้านล่างจะบอกว่าเป็นข้อมูล Twelve Data และอาจล่าช้าหรือขาดช่วงได้

## ถ้าเห็น DEMO fallback

ให้เปิดรายละเอียดเหตุผลในแผงแหล่งข้อมูลราคา โดยสาเหตุที่พบบ่อยคือ `TWELVEDATA_API_KEY` ยังไม่ได้อยู่ใน **server secret**, key หมดอายุ/ผิด, บัญชีหรือแผนยังไม่ให้เข้าถึง commodity time series, symbol ที่บัญชีรองรับไม่ตรง หรือ API ตอบกลับข้อมูลย้อนหลังน้อยกว่า 240 แท่ง

ชื่อ symbol ของ Twelve Data สำหรับทองคำเทียบยูโรคือ `XAU/EUR` ซึ่ง adapter จะ map เป็น `XAUEUR` ภายในแอปเพื่อรักษา product contract เดิม

## ขอบเขตในรอบนี้

กราฟ, indicator, model votes, forecast และ Quality Gate จะใช้ live candles เมื่อ feed ผ่าน guard แล้ว แต่ **automatic settlement ของ prediction แบบ live ยังไม่เปิด** เพราะ history เดิมยังใช้ frozen demo provider และไม่ควรนำข้อมูลคนละแหล่งมาเทียบกัน การเปิด settlement live ต้องทำเป็นงานแยก โดยกำหนด source/version/retention และทดสอบ no-look-ahead กับข้อมูลจริงก่อน

สำหรับการใช้งานส่วนตัว 1 tab การ refresh ทุก 5 นาทีคิดเป็นประมาณ 288 requests ต่อวันก่อนนับการกด refresh เอง จึงอยู่ต่ำกว่า daily quota 800 ของ Basic/Free แต่ยังควรเผื่อการเรียกอื่นและไม่ควรเปิดหลาย tab พร้อมกัน

การบันทึก prediction จาก live feed ยังเก็บได้ แต่รายการจะถูกป้าย `Twelve Data` และไม่แสดงปุ่มเปิดผลด้วย frozen demo โดยอัตโนมัติ

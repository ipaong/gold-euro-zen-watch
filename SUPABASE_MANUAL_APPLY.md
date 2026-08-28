# คู่มือ Manual Apply ไปยัง Supabase GoldCompass

คู่มือนี้ใช้กับ Supabase project `GoldCompass` (`urrwbokecdrhnyzmlfay`) บน
PowerShell ใน Windows คำสั่งทั้งหมดต้องรันจากโฟลเดอร์ repository นี้

```powershell
cd C:\Users\Pong\Desktop\goldzen
```

> ห้ามใช้ `npx supabase db reset --linked` เพราะคำสั่งดังกล่าวลบ schema บน
> remote project แล้วสร้างใหม่จาก migrations

## 1. ตรวจบัญชีและ project ที่ link

```powershell
npx supabase projects list
npx supabase migration list
```

บรรทัด `GoldCompass` ต้องมีเครื่องหมาย linked และ project ref ต้องเป็น
`urrwbokecdrhnyzmlfay` ถ้าไม่ใช่ ให้หยุดและ link ใหม่ก่อน

```powershell
npx supabase link --project-ref urrwbokecdrhnyzmlfay
```

## 2. ตรวจ migrations โดยยังไม่แก้ remote

CLI token ที่สร้างอัตโนมัติจาก browser login อาจไม่มี `database_write` สำหรับ
สร้าง temporary database login role หากคำสั่งด้านล่างตอบ
`LegacyDbConfigLoginRoleStatusError` หรือ `403` ให้ใช้ fine-grained access token
อายุสั้นที่จำกัดเฉพาะ GoldCompass และมี Database read-write โดยไม่ใส่ token ลง
command history:

1. คัดลอก fine-grained token จาก Supabase Dashboard ลง clipboard
2. โหลด token จาก clipboard เข้า environment variable ของ PowerShell session นี้

```powershell
$env:SUPABASE_ACCESS_TOKEN = (Get-Clipboard).Trim()
npx supabase projects list
```

ถ้า token เดิมถูก revoke แล้ว ให้สร้างใหม่แบบ 7 วัน จำกัดเฉพาะ GoldCompass และ
ให้สิทธิ์ Database, Edge Functions และ Edge Function Secrets แบบ read-write
token ไม่สามารถให้สิทธิ์เกิน role ของบัญชีได้ หากยังได้ 403 ต้องให้ Owner ของ
Supabase organization เพิ่ม role ที่มีสิทธิ์ database write หรือใช้ database
password ตามนโยบายของ organization

```powershell
npx supabase db push --dry-run
```

ตรวจว่ารายการเรียงตาม timestamp และไม่มี migration อื่นที่ไม่รู้จัก หากมี
ข้อความเรื่อง remote migration history ไม่ตรงกับ local ให้หยุด ห้ามใช้
`migration repair` โดยเดาเอง

## 3. Apply database migrations

คำสั่งนี้เปลี่ยน schema บน GoldCompass จริง

```powershell
npx supabase db push
```

ตรวจหลัง apply:

```powershell
npx supabase migration list
npx supabase db lint --linked --level warning
```

local และ remote migration timestamps ควรตรงกันทุกรายการ

## 4. เตรียม custom secrets โดยไม่ใส่ค่าลง command history

สร้างไฟล์ local จาก template แล้วเปิดแก้ไข:

```powershell
Copy-Item supabase-secrets.example .env.supabase-secrets.local
notepad .env.supabase-secrets.local
```

แทน placeholder ด้วยค่าสุ่มยาวและไม่ซ้ำกันคนละค่าระหว่าง
`GOLD_API_COLLECTOR_SECRET` และ `XM_BRIDGE_SECRET` จากนั้นบันทึกและปิด Notepad
ไฟล์ `.env.supabase-secrets.local` ถูก `.gitignore` ครอบคลุมอยู่แล้ว แต่ยังคง
ห้าม commit หรือส่งไฟล์นี้ผ่านแชต

ส่ง secrets ขึ้น GoldCompass:

```powershell
npx supabase secrets set --env-file .env.supabase-secrets.local
npx supabase secrets list
```

`SUPABASE_URL` และ `SUPABASE_SECRET_KEYS` เป็น runtime secrets ที่ Supabase
จัดให้ Edge Functions อยู่แล้ว ไม่ต้องใส่เพิ่มในไฟล์นี้ Functions ยังรองรับ
`SUPABASE_SERVICE_ROLE_KEY` แบบ legacy เป็น fallback ระหว่างช่วงเปลี่ยนระบบ

## 5. Deploy Edge Functions

ทั้งสอง function ปิด platform JWT verification ใน `supabase/config.toml` เพราะ
รับ request จาก cron/bridge ภายนอกและตรวจ custom secret header ภายใน handler

```powershell
npx supabase functions deploy gold-api-collector
npx supabase functions deploy xm-bridge-ingest
npx supabase functions list
```

สถานะของทั้งสอง function ควรเป็น `ACTIVE`

## 6. Smoke test: request ที่ไม่มี secret ต้องถูกปฏิเสธ

```powershell
$projectRef = "urrwbokecdrhnyzmlfay"
$goldUrl = "https://$projectRef.supabase.co/functions/v1/gold-api-collector"
$xmUrl = "https://$projectRef.supabase.co/functions/v1/xm-bridge-ingest"

try { Invoke-WebRequest -Method Post -Uri $goldUrl -UseBasicParsing } catch { $_.Exception.Response.StatusCode.value__ }
try { Invoke-WebRequest -Method Post -Uri $xmUrl -UseBasicParsing } catch { $_.Exception.Response.StatusCode.value__ }
```

ทั้งสองคำสั่งต้องแสดง `401`

## 7. Smoke test แบบ authorized

ขั้นตอนนี้เขียน sample/candle ลงฐานข้อมูลจริง ให้อ่าน secret จากไฟล์ local โดย
ไม่แสดงค่าออกหน้าจอและไม่ใส่ค่าจริงใน command history:

```powershell
$secretValues = @{}
Get-Content .env.supabase-secrets.local | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
    $secretValues[$matches[1].Trim()] = $matches[2].Trim()
  }
}

$goldHeaders = @{ "x-gold-api-collector-secret" = $secretValues["GOLD_API_COLLECTOR_SECRET"] }
Invoke-RestMethod -Method Post -Uri $goldUrl -Headers $goldHeaders
```

ผล Gold collector ควรมี `ok: true` หาก upstream Gold API พร้อมใช้งาน และจะเขียน
price sample ลงฐานข้อมูลจริง หาก upstream ล่มหรือข้อมูลเก่า function จะตอบ 502
โดยไม่เปิดเผย secret

ทดสอบ XM authorization และ validation โดยส่ง payload ว่าง ซึ่งต้องไม่เขียนข้อมูล:

```powershell
$xmHeaders = @{ "x-xm-bridge-secret" = $secretValues["XM_BRIDGE_SECRET"] }
try {
  Invoke-WebRequest -Method Post -Uri $xmUrl -Headers $xmHeaders -ContentType "application/json" -Body "{}" -UseBasicParsing
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

ผลต้องเป็น `422` ซึ่งยืนยันว่า custom secret ผ่านแล้วและ payload ถูก validation
ปฏิเสธ โดยไม่มี candle ถูกเขียน การทดสอบ ingest แบบ end-to-end ให้ใช้แท่งจริงจาก
XM bridge เท่านั้น ห้ามสร้าง OHLC สมมติบน production

## 8. เมื่อคำสั่งใดล้มเหลว

- หยุดที่คำสั่งนั้นและเก็บ error output ทั้งหมด
- ห้ามใช้ `db reset --linked`, ลบ migration history หรือแก้ schema ผ่าน Dashboard
  เพื่อบังคับให้ผ่าน
- แก้ด้วย forward migration ใหม่หลังตรวจสาเหตุ
- Edge Function สามารถย้อนกลับโดย checkout commit ที่เคยผ่าน แล้ว deploy เฉพาะ
  function เดิมอีกครั้ง โดยไม่ต้องย้อน database migration

หลังยืนยันทุกอย่างแล้ว สามารถลบไฟล์ secret local ได้ แต่ต้องระบุ path ตรงๆ:

```powershell
Remove-Item -LiteralPath "C:\Users\Pong\Desktop\goldzen\.env.supabase-secrets.local"
```

ล้าง management access token และ clipboard เมื่อทำงานเสร็จ:

```powershell
Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
Set-Clipboard -Value ""
```

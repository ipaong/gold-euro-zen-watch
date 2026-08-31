# Gold Futures archive — run from the repo root in PowerShell.
#   powershell -ExecutionPolicy Bypass -File .\scripts\yahoo-archive-setup.ps1
#
# Does NOT print or commit the secret. Saves it to .env.supabase-secrets.local

$ErrorActionPreference = "Stop"
$ProjectRef = "urrwbokecdrhnyzmlfay"
$FunctionName = "yahoo-archive-collector"
$SecretName = "YAHOO_ARCHIVE_SECRET"
$SecretFile = Join-Path (Get-Location) ".env.supabase-secrets.local"
$FunctionUrl = "https://$ProjectRef.supabase.co/functions/v1/$FunctionName"

function Wait-Step([string]$Title, [string]$Hint) {
  Write-Host ""
  Write-Host "===== $Title =====" -ForegroundColor Cyan
  if ($Hint) { Write-Host $Hint }
  Read-Host "กด Enter เพื่อรันขั้นนี้"
}

function Invoke-Supabase {
  param([string[]]$CliArgs)
  & npx --yes supabase @CliArgs
}

if (-not (Test-Path ".\supabase\functions\$FunctionName\index.ts")) {
  throw "รันสคริปต์นี้จากโฟลเดอร์รากของรีโป gold-euro-zen-watch หลัง git pull"
}

Write-Host "โปรเจกต์ $ProjectRef"
Write-Host "ฟังก์ชัน  $FunctionName"
Write-Host "ทำทีละขั้น กด Enter ทีละคำสั่ง"

Wait-Step "0) ดึงโค้ดล่าสุด" "git pull origin main"
git pull origin main

Wait-Step "1) ล็อกอิน Supabase CLI" "จะเปิดเบราว์เซอร์ให้ล็อกอิน"
Invoke-Supabase -CliArgs @("login")

Wait-Step "2) ผูกโปรเจกต์ GoldCompass" "ถ้าถามรหัสฐานข้อมูล ใช้ Database password จาก Dashboard → Project Settings → Database"
Invoke-Supabase -CliArgs @("link", "--project-ref", $ProjectRef)

Wait-Step "3) สุ่มรหัสลับแล้วตั้ง YAHOO_ARCHIVE_SECRET" "รหัสจะถูกเซฟที่ .env.supabase-secrets.local อย่า commit ไฟล์นี้"
$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = -join ($bytes | ForEach-Object { $_.ToString("x2") })

$existing = ""
if (Test-Path $SecretFile) { $existing = Get-Content $SecretFile -Raw }
if ($existing -match "(?m)^YAHOO_ARCHIVE_SECRET=") {
  $existing = [regex]::Replace($existing, "(?m)^YAHOO_ARCHIVE_SECRET=.*$", "$SecretName=$secret")
} else {
  if ($existing -and -not $existing.EndsWith("`n")) { $existing += "`n" }
  $existing += "$SecretName=$secret`n"
}
Set-Content -Path $SecretFile -Value $existing
Write-Host "เซฟรหัสแล้วที่ $SecretFile"

Invoke-Supabase -CliArgs @("secrets", "set", "${SecretName}=$secret")
Write-Host "ขั้น 3 เสร็จ — secret อยู่ใน Edge Function แล้ว"

Wait-Step "4) Deploy ฟังก์ชัน (Verify JWT ปิด)" "ใช้ --no-verify-jwt เพราะเราเช็ค x-yahoo-archive-secret เอง"
Invoke-Supabase -CliArgs @("functions", "deploy", $FunctionName, "--no-verify-jwt")

Wait-Step "5) ลองดึงครั้งแรก" "วันธรรมดาควรได้ ok + fetched ประมาณ 1500-2000 เสาร์อาทิตย์ได้ closed"
$headers = @{
  "Content-Type" = "application/json"
  "x-yahoo-archive-secret" = $secret
}
try {
  $result = Invoke-RestMethod -Method POST -Uri $FunctionUrl -Headers $headers
  $result | ConvertTo-Json -Depth 6
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  throw
}

Write-Host ""
Write-Host "===== 6) ตรวจคลังใน SQL Editor =====" -ForegroundColor Cyan
Write-Host @"
select
  count(*) as bars,
  to_timestamp(min(t) / 1000.0) at time zone 'Asia/Bangkok' as first_th,
  to_timestamp(max(t) / 1000.0) at time zone 'Asia/Bangkok' as last_th
from public.market_archive
where symbol = 'GC=F' and timeframe = '15m';
"@

Write-Host ""
Write-Host "ถ้ายังไม่ได้รัน SQL สร้างตาราง ให้เปิด supabase/manual/yahoo_archive.sql วางใน SQL Editor ก่อน แล้วรันขั้น 5 ใหม่"
Write-Host "จบแล้ว กลับแอป กด ดึงจากฐานข้อมูล"

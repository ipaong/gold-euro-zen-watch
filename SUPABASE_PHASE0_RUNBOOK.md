# Supabase Phase 0 Runbook

สถานะ: **รอ manual approval และ execution ใน environment ที่ยืนยันแล้ว**

เอกสารนี้ใช้ตรวจสอบ Phase 0 ของ XAUEUR Signal Lab โดยเฉพาะ Anonymous Auth, ownership, RLS และ immutable prediction/result flow ห้ามนำคำสั่งไปใช้กับ production จนกว่าจะยืนยัน project/ref และได้รับอนุมัติจากเจ้าของ

## สิ่งที่ migration ทำ

Migration `supabase/migrations/20260827110000_phase0_auth_and_ownership.sql` เพิ่ม `user_id` ที่อ้างอิง `auth.users`, จำกัดทุก operation ด้วย `auth.uid()`, ปิดสิทธิ์ `anon`, จำกัด grants ของ `authenticated`, บังคับ ownership ของ `prediction_results`, ป้องกันการเปลี่ยน owner/snapshot ของ prediction และทำให้ result รับได้ครั้งเดียวผ่าน primary key เดิม

แถว legacy ที่มีเพียง `device_id` จะไม่มี owner ที่พิสูจน์ได้จาก Anonymous Auth จึงถูกปล่อยให้ `user_id` เป็น `NULL` และไม่ถูกแสดงผ่าน RLS ใหม่โดยตั้งใจ ห้าม backfill เป็น user แบบเดา หากต้องการเก็บข้อมูลเดิมต้องมี data-migration decision และ mapping ที่เจ้าของอนุมัติแยกต่างหาก

## Preflight ที่ต้องตรวจด้วยตนเอง

1. ยืนยัน Supabase project ref และ environment ว่าเป็น local/staging ไม่ใช่ production
2. ตรวจว่า migration ใน Git ตรงกับไฟล์ที่จะ execute และ working tree ไม่มี secret หรือ `.env` ถูกติดตาม
3. เปิด **Authentication → Providers → Anonymous Sign-Ins** ใน project ที่ยืนยันแล้ว
4. กำหนด CAPTCHA/Turnstile, rate limit และ cleanup policy สำหรับ anonymous users ก่อนเปิดสาธารณะ
5. ตรวจ backup/rollback policy ของ environment ก่อนเปลี่ยน schema

## Local validation เมื่อมี Supabase CLI และ Docker

```sh
supabase start
supabase db reset
supabase test db
```

`db reset` จะ apply migrations ใน Git และ rollback fixture ของ pgTAP เมื่อจบ test ส่วน `supabase test db` ต้องรายงานผลจริงเท่านั้น ห้ามเปลี่ยนเอกสารเป็น completed จากการตรวจ SQL แบบ static

## Staging validation ที่ได้รับอนุมัติแล้ว

```sh
supabase link --project-ref <STAGING_PROJECT_REF>
supabase db push
supabase test db
```

ก่อน `supabase db push` ต้องตรวจ `<STAGING_PROJECT_REF>` ด้วย `supabase projects list` และต้องไม่ใช้ `--project-ref` ของ production โดยไม่ตั้งใจ หลัง execute ให้บันทึก migration version, test output, timestamp และผู้อนุมัติลง work log

## Acceptance checks

| ขอบเขต          | หลักฐานที่ต้องมี                                                                        |
| --------------- | --------------------------------------------------------------------------------------- |
| Anonymous Auth  | sign-in ใหม่, session reuse และ concurrent initialization ทำงาน; failure แล้ว retry ได้ |
| Least privilege | `anon` select/insert/update/delete ไม่ผ่าน; authenticated ได้เฉพาะ operations ที่กำหนด  |
| Isolation       | user A เห็นและแก้ได้เฉพาะข้อมูลของ A; user B อ่าน/ลบ/แนบ result ของ A ไม่ได้            |
| Prediction lock | owner, snapshot, core fields และ locked AI explanation แก้ย้อนหลังไม่ได้                |
| Result          | prediction หนึ่งรายการมี result ได้หนึ่งครั้ง และ result ของ owner อื่นถูกปฏิเสธ        |
| Migration       | migration ที่รันตรงกับ commit ใน Git และไม่มีการ backfill owner แบบเดา                  |

## Current blocker

Sandbox นี้ไม่มี Supabase CLI และ Docker daemon จึงยังไม่มีหลักฐานการ execute migration/pgTAP บน DB จริง การตรวจใน milestone นี้จึงเป็น static review และ Vitest เท่านั้น ต้องรอเจ้าของระบุ environment และอนุมัติการเปลี่ยนฐานข้อมูลก่อน

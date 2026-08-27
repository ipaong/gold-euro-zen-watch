# Prompt สำหรับ Lovable: Apply Supabase migrations อย่างปลอดภัย

โปรดเก็บงานด้าน Supabase migration ของโปรเจกต์นี้ให้เสร็จ โดยใช้ Supabase Cloud project ที่เชื่อมอยู่กับโปรเจกต์นี้เท่านั้น ห้ามใช้ production project อื่น ห้ามเดา project ref และห้ามส่ง credential หรือ service-role key กลับมาในแชท

## เป้าหมาย

ตรวจสอบและ apply migrations ที่มีอยู่ใน repository ให้ครบตามลำดับ timestamp โดยเน้น Phase 0 ownership/RLS และ result immutability จากนั้นตรวจ schema, policies, triggers, grants และรัน database tests ใน Supabase project ที่เชื่อมอยู่จริง

## ขั้นตอนที่ต้องทำ

1. ตรวจสอบ migration history ของ Supabase project ก่อน ห้าม apply ซ้ำหรือแก้ migration เดิมแบบ destructive และห้ามสร้าง migration ใหม่ที่มีความหมายซ้ำกับไฟล์เดิมโดยไม่จำเป็น

2. ตรวจสอบไฟล์ migration ที่เกี่ยวข้องใน repository โดยเฉพาะ:
   - `supabase/migrations/20260827110000_phase0_auth_and_ownership.sql`
   - `supabase/migrations/20260827120000_phase0_result_immutability.sql`
   - migration ก่อนหน้าที่สร้างตาราง `predictions`, `prediction_results` และ `app_settings`

3. Apply migrations แบบ forward-only ตามลำดับ timestamp ใน environment ของ Supabase project ที่เชื่อมอยู่ ห้าม reset database, ห้าม drop ตาราง, ห้าม truncate ข้อมูล และห้ามใช้คำสั่งที่ทำให้ข้อมูลผู้ใช้หาย หาก migration ใด apply ไม่ได้ให้หยุดตรงนั้นและรายงาน error ที่แท้จริงแทนการแก้แบบเดา

4. ตรวจสอบว่า Anonymous Sign-In เปิดอยู่ใน Supabase Authentication เพราะแอปมีโหมด Demo ที่ใช้ anonymous session และตรวจสอบว่า Email provider เปิดใช้งานสำหรับหน้า `/login` หาก project policy ไม่อนุญาตให้เปิด ให้รายงานเป็น blocker โดยไม่เปลี่ยน policy ที่มีความเสี่ยงเอง

5. ตรวจสอบ RLS และ ownership contract ให้ตรงกับ source code:
   - `predictions` ต้องอ่าน/เขียนได้เฉพาะแถวที่ `user_id = auth.uid()`
   - `prediction_results` ต้องป้องกันการอ่านหรือเขียนข้าม owner
   - `app_settings` ต้องเป็น per-user และ upsert ได้เฉพาะของ user ปัจจุบัน
   - unauthenticated `anon` role ต้องไม่มีสิทธิ์เข้าถึงข้อมูลโดยตรง
   - anonymous authenticated users ยังต้องใช้งานข้อมูลของตัวเองได้ เพราะ Anonymous Sign-In เป็น authenticated session ประเภทหนึ่ง
   - ห้ามใช้ `device_id` เป็น security boundary

6. ตรวจสอบ immutability:
   - prediction ที่ `locked` แล้วต้องแก้ไขไม่ได้
   - `user_id` ของ prediction ต้องเปลี่ยนไม่ได้
   - `prediction_results` ที่ถูกเขียนแล้วต้องแก้ไขหรือเขียนทับไม่ได้ แม้จะมาจาก trusted path หาก migration ระบุ contract นี้
   - duplicate settlement result ต้องถูกป้องกันตาม schema/constraint ที่มีอยู่

7. รัน database tests จาก `supabase/tests/database.test.sql` ด้วย pgTAP หรือวิธีที่ Supabase project รองรับ ตรวจให้ครบเรื่อง anonymous denial, user A/B isolation, cross-owner result denial, snapshot/user_id immutability และ duplicate result rejection ห้ามรายงานว่า test ผ่านหากยังไม่ได้ execute จริง

8. ตรวจ post-migration schema โดยเปรียบเทียบตาราง, primary key, foreign key, unique constraint, RLS enablement, policies, triggers และ grants กับ migration ใน repository หากพบ drift ให้รายงานรายละเอียดก่อนแก้ไข ห้าม drop หรือ recreate ตารางเพื่อกลบ drift

9. ตรวจ environment variables และ deployment configuration ให้ client ใช้เฉพาะ `VITE_SUPABASE_URL` กับ `VITE_SUPABASE_PUBLISHABLE_KEY` และห้าม expose service-role key ใน client, browser bundle, log หรือ commit ใด ๆ

10. หลังทุกอย่างผ่าน ให้สรุปผลเป็นตารางที่มี migration name, applied status, database test result, RLS/policy result, immutability result และ remaining blocker หาก migration หรือ test ทำไม่ได้ ให้ระบุคำสั่ง/ขั้นตอนที่ผู้ดูแลต้องทำต่ออย่างชัดเจน

## ข้อห้ามเด็ดขาด

ห้ามแก้ไฟล์ auto-generated ใน `src/integrations/supabase/*` ด้วยมือ ห้ามเปลี่ยน business logic ของ Final Signal, ห้ามต่อ market provider หรือ trade execution ในงานนี้ ห้ามปิด RLS เพื่อให้ test ผ่าน ห้ามลบข้อมูลเดิม ห้าม reset project และห้ามบอกว่า migration สำเร็จหากไม่มีหลักฐานจาก Supabase project จริง

## สิ่งที่ต้องส่งกลับ

ส่งกลับเฉพาะผลที่ตรวจสอบได้จริง ได้แก่ migration ที่ apply สำเร็จ, migration ที่ล้มเหลวพร้อม error, ผล database tests แต่ละกลุ่ม, สถานะ Anonymous Sign-In/Email provider, รายการ RLS policies/triggers ที่ตรวจพบ และคำแนะนำขั้นตอนถัดไป หากทุกอย่างผ่านให้ระบุชัดว่า project ref/environment ใดถูกใช้โดยไม่เปิดเผย secret; หากไม่ผ่านให้หยุดก่อนทำ destructive change

# Login-only verification

ตรวจสอบจาก dev server ที่ `http://localhost:8080/login` เมื่อ 27 สิงหาคม 2026:

- หน้าแสดงหัวข้อ `เข้าสู่ระบบ` และฟอร์มอีเมล/รหัสผ่านเท่านั้น
- ฟอร์มมี `type=email`, `type=password`, `autocomplete=email` และ `autocomplete=current-password`
- ไม่พบ tab, ปุ่ม หรือข้อความสำหรับ `สมัครบัญชี` / Signup
- ปุ่ม `เข้าโหมด Demo` ยังคงอยู่และนำไปที่ `/?demo=true`
- หลังเข้า Demo หน้า Home แสดง dashboard และลิงก์ `เข้าสู่ระบบ` กลับไป `/login`
- ไม่ได้ทดสอบการ submit credentials จริง เพราะยังไม่ได้รัน SQL บัญชีคงที่บน Supabase

ตรวจ DOM ซ้ำหลังกลับจาก Demo:

จำนวนข้อความที่ตรงกับ `สมัครบัญชี`, `สร้างบัญชี`, `signup` หรือ `sign up` เท่ากับ `0`; ปุ่มที่พบมีเพียง `เข้าสู่ระบบ` และ `เข้าโหมด Demo`. Input email มี `type=email`, `autocomplete=email`, `required`; input password มี `type=password`, `autocomplete=current-password`, `minlength=6`, `required`.

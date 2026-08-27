# Red-team browser evidence

อัปเดตวันที่ 27 สิงหาคม 2026 บน local dev server `http://localhost:8080` โดย environment ไม่มี `SUPABASE_URL` และ `SUPABASE_PUBLISHABLE_KEY` การบันทึกนี้จึงใช้เป็นหลักฐานเฉพาะ client/browser smoke ไม่ใช่หลักฐานว่า Supabase, Auth หรือ RLS ใช้งานได้จริง

| Scenario | ผลที่ตรวจได้ |
|---|---|
| เปิด `/?demo=true` ก่อนแก้ HomeGate | หลัง hydration ถูกส่งไป `/login` เมื่อ auth check ล้มเหลว แม้ผู้ใช้ระบุ explicit Demo; ทดลองกดปุ่ม Demo แล้วตรวจซ้ำยังอยู่หน้า login |
| เปิด `/?demo=true` หลังแก้ HomeGate | เข้า dashboard ได้โดยตรง แสดง `ข้อมูลเดโม`, `DEMO fallback`, เหตุผลว่า Supabase environment ไม่พร้อม และวิเคราะห์จาก frozen dataset ได้ |
| Provider copy บน dashboard | แสดงข้อความ `Gold API` และไม่พบข้อความ `Twelve Data` ในเส้นทางที่ตรวจ |
| Bottom navigation → `/history` | route เปิดได้ แสดง empty history และ toast ว่าโหลด Cloud ไม่สำเร็จตามข้อจำกัดของ local environment |
| More menu → `/news` | เมนูเปิดและนำทางได้ หน้า News แสดง `ข่าวเดโม` และ event actual ของ frozen data ตามเวลาที่ควรเห็น |
| Browser console | พบเฉพาะ error ที่ระบุ missing `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` จาก environment; ไม่พบ runtime exception อื่นในเส้นทางที่ตรวจ |

รอบนี้ตรวจด้วย default browser viewport จึงไม่อ้างว่าได้ทำ dedicated 360/390/412px mobile audit, screen-reader audit หรือ contrast audit เพิ่มเติม

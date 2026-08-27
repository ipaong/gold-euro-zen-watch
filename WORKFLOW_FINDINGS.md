# Randomized Workflow Findings

อัปเดต: 27 สิงหาคม 2026

## รอบ dashboard baseline

เปิด dev server ที่ `http://localhost:8080/` แล้วหน้า dashboard โหลดสำเร็จโดยแสดง Final Signal, forecast chart, 5 model votes, Quality Gate, AI analyst placeholder, Time Machine และ bottom navigation ได้ครบ ไม่มี runtime error ปรากฏในหน้าแรก

หน้าจอแสดงข้อมูลราคาเดโมและข่าวเดโมตามข้อจำกัดของระบบ และแสดง final signal เป็น WAIT เมื่อ confidence รวมไม่ถึง threshold โดยไม่พบการใช้ Ensemble เพื่อ override Quality Gate จาก smoke test รอบนี้

## วิธีทดสอบต่อ

จะสุ่ม workflow onboarding, Time Machine, settings persistence/failure, save prediction, history reveal, performance windows และ news fallback โดยเน้น invariant ด้าน no-look-ahead, idempotent settlement, sample-size warning, DEMO/LIVE/STALE labeling และไม่สร้างคำสั่งซื้อขาย

## รอบ onboarding

เมื่อรีเซ็ต localStorage แล้ว first-run notice ปรากฏด้านบน dashboard พร้อมข้อความอธิบายว่าเป็นระบบทดลองและไม่มีคำสั่งซื้อขาย กด `เริ่ม Demo` แล้ว notice หายไปทันที ข้อมูล signal/forecast เดิมยังอยู่และไม่มีข้อความ error ในหน้าเว็บ

## รอบ Settings discovery

หน้า `/settings` โหลดสำเร็จ แสดงค่าเริ่มต้น confidence 60%, agreement 3/5 และ news avoidance 30 นาที พร้อมปุ่ม reset. DOM ใช้ Radix Slider ซึ่งไม่สร้าง `<input>` ให้ querySelectorAll จึงได้ศูนย์รายการ; การทดสอบต่อควรใช้ element ที่มี `role=slider` และตรวจ `aria-valuenow` แทน

การสุ่มตรวจ DOM ยืนยันว่ามี Radix sliders 3 ตัว ค่าเริ่มต้น 60 / 3 / 30 และ `aria-valuemin/max` ถูกต้องเป็น 40–90, 2–5 และ 0–120 ตามลำดับ แม้ `aria-label` ไม่ถูกส่งลงถึง thumb element; label ที่มองเห็นยังบอกค่าปัจจุบันครบ จึงยังไม่พบบัค functional แต่พบ accessibility improvement opportunity เรื่อง aria-label ที่ thumb

## รอบ Settings accessibility fix

หลังแก้ Slider primitive ให้รับ `thumbProps` และส่ง label ไปที่ thumb จริง browser ตรวจพบ slider 3 ตัวมี `aria-label` เป็นภาษาไทยครบถ้วน พร้อม `aria-valuenow/min/max` ที่ถูกต้อง จึงปิดช่องว่าง accessibility ที่พบในรอบก่อน

## รอบ Settings keyboard workflow

การโฟกัส thumb แล้วกด `ArrowRight` เปลี่ยน confidence จาก 60% เป็น 65% ตาม step 5 และหน้าอัปเดต label/track ได้ทันที จึงไม่พบบัคด้าน keyboard interaction ในเส้นทางนี้

## บัคที่พบ: Settings persistence

สุ่มเปลี่ยน confidence จาก 60% เป็น 65% ผ่าน keyboard แล้วออกไป Dashboard ก่อนกลับเข้า `/settings`; route กลับมาแสดง 60% แทน 65% จึงยืนยันได้ว่าค่าไม่คงอยู่ข้าม route reload ใน browser session นี้ แม้ UI อัปเดตตอนลาก slider สำเร็จ

สมมติฐานเบื้องต้นคือ `settings.tsx` ใช้ `void saveSettings(s)` แบบ fire-and-forget โดยไม่มี await, error handling, debounce หรือ rollback ทำให้การเขียน Cloud อาจยังไม่เสร็จ/ล้มเหลวโดยผู้ใช้ไม่ทราบ จะตรวจ console/network และแก้ให้บันทึกอย่างมีสถานะยืนยัน

หลังแก้ save queue แล้ว การเปลี่ยน confidence เป็น 65% ยังคงค่าใหม่บนหน้าจอและแสดง `กำลังบันทึกค่าล่าสุด…`; เมื่อ anonymous Cloud session ล้มเหลว ระบบเปลี่ยนเป็นข้อความ `ยังยืนยันการบันทึกไม่ได้` พร้อม toast `บันทึกค่าไป Cloud ไม่สำเร็จ` แทนการเงียบหรือรายงานว่าสำเร็จ จึงแก้บัค persistence/feedback ได้ในขอบเขตที่ environment ไม่พร้อม

## รอบ History failure workflow

เมื่อ Cloud/anonymous session ใช้งานไม่ได้ หน้า `/history` ไม่ crash แต่แสดง empty state ที่อธิบายวิธีเริ่มใช้งาน พร้อม toast `โหลดบันทึกจาก Cloud ไม่สำเร็จ` และไม่แสดงข้อมูลของผู้ใช้อื่น จัดว่า fallback behavior ปลอดภัย

## บัคที่พบ: forecast time หลัง missing interval

Seeded randomized workflow 24 จุดพบว่า `runForecast` เดิมสร้างเวลา forecast จาก `lastCandleTime + M15` โดยตรง เมื่อ `asOf` ไม่ตรง boundary หรือ dataset มีช่วงขาดหาย บาง forecast candle จึงมี timestamp ไม่มากกว่า `asOf` ซึ่งละเมิด no-look-ahead semantics

แก้ใน `src/lib/forecast/engine.ts` ด้วย `firstFutureCandleTime()` ให้เริ่มที่ค่ามากสุดระหว่าง boundary ถัดไปของ `asOf` กับ `lastCandleTime + M15` และใช้เวลาเดียวกันทั้ง scenario paths และ blended forecast. หลังแก้ randomized workflow tests ผ่านทั้ง no-look-ahead, OHLC, scenario weights, horizon และ idempotent settlement

## รอบ Performance workflow

หน้า `/performance` โหลดได้แม้ไม่มี cloud data แสดง Last 20/50/100/All, ค่า metrics เป็น em dash เมื่อ sample เป็นศูนย์, warning ว่าข้อมูลยังไม่พอ และ controlled pilot panel ที่แสดง 0/80, evaluation 0/50 และ uncertainty เป็น em dash. การเลือก `ล่าสุด 20` เปลี่ยนช่วงที่เลือกได้ถูกต้องและไม่เกิด runtime error

## รอบ News workflow

หน้า `/news` โหลดสำเร็จและแสดงข้อมูล ณ `asOf`, ข่าว/ปฏิทิน, risk label และข้อความว่าเห็นเฉพาะข่าวที่เผยแพร่แล้ว แม้ live fetch อยู่ระหว่างดำเนินการก็ไม่ทำให้ route crash; browser console ไม่พบ runtime error จากรอบนี้. Event ที่อยู่ก่อนเวลาปัจจุบันแสดง actual ตามข้อมูลเดโม ส่วนตรรกะ no-look-ahead ยังยืนยันด้วย unit tests

## Login UI smoke test

เพิ่ม route `/login` แล้ว browser โหลดได้สำเร็จ แสดงอีเมล/รหัสผ่าน, ปุ่มสลับเข้าสู่ระบบ/สมัครบัญชี, ปุ่มเข้าโหมด Demo และไม่มี bottom navigation ที่ไม่เกี่ยวข้อง. การสลับไปแท็บสมัครบัญชีเปลี่ยน heading และ submit label ได้ถูกต้อง โดยยังคงฟอร์มเดิมไว้

การตรวจ form โดยไม่ submit ยืนยันว่า email เป็น `type=email`, `required`, autocomplete=`email`; password เป็น `type=password`, `required`, `minLength=6`, autocomplete=`new-password` ใน signup mode และ browser validity ปฏิเสธฟอร์มว่างตามที่คาด

## Home auth guard browser checkpoint — 2026-08-27

จาก dev server ของ `main` ล่าสุด เมื่อเปิด `/` ใน browser ที่ไม่มี session และไม่มี Demo flag ระบบแสดงสถานะตรวจสอบชั่วคราว แล้วเปลี่ยนไปที่ `/login` สำเร็จ โดยหน้า Login แสดงฟอร์ม email/password และปุ่ม `เข้าโหมด Demo`; ไม่พบ dashboard content หลัง hydration.

หลักฐานการทดสอบนี้เป็น local browser verification เท่านั้น ไม่ใช่ production deployment หรือการยืนยัน Supabase Auth configuration.

เมื่อคลิก `เข้าโหมด Demo` จาก `/login` ระบบเปลี่ยนเป็น `/?demo=true` และโหลด dashboard ได้ พร้อมป้าย `ข้อมูลเดโม`; เมื่อเปิด `/` ใหม่ใน session เดิม dashboard ยังโหลดได้จาก Demo flag ที่เก็บใน localStorage และไม่เกิด redirect loop. จาก dashboard สามารถกดลิงก์ `เข้าสู่ระบบ` ใน header เพื่อกลับไป `/login` ได้สำเร็จ.

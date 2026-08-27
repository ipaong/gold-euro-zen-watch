# Red-team adversarial QA findings

อัปเดตวันที่ 27 สิงหาคม 2026 บน branch `manus/red-team-hardening` โดยใช้ `origin/main` ที่ commit `672c58f2b64402489dc1e2a2d09559e36fdc26c8` เป็น baseline งานนี้ยึดกติกาจากคำสั่ง red-team ที่ผู้ใช้ให้มา: ไม่ redesign market provider, ไม่ refactor architecture ใหญ่, ไม่เพิ่ม feature และแก้เฉพาะ failure ที่มี reproduction หรือหลักฐานจากการตรวจสอบจริง

## วิธีการและขอบเขต

เริ่มจากอ่าน `CODE_MAP.md`, `ROADMAP.md`, `MANUS_PROGRESS.md`, โมดูล news/AI/market/settlement/auth/cloud-store และ regression tests เดิม จากนั้นรัน baseline ซึ่งผ่าน 84 tests จาก 23 test files การตรวจแต่ละประเด็นใช้ลำดับ inspect → hypothesize → เพิ่ม failing test → reproduce → แก้ root cause แบบเล็กที่สุด → รัน focused suite → รัน full gate

ผลลัพธ์ด้านล่างระบุเฉพาะกรณีที่เห็น failure จริงก่อนแก้ หรือมี browser reproduction ที่ตรวจซ้ำได้ ไม่รวมข้อสงสัยที่ยังไม่มีหลักฐานเพียงพอ

## Findings ที่ reproduce ได้และแก้แล้ว

| ID | พื้นที่ | อาการที่ reproduce ได้ | การแก้ไขที่ทำ | หลักฐานหลังแก้ |
|---|---|---|---|---|
| F-01 | News cache / Time Machine | `asOf` สองค่าที่ต่างกันภายใน 10-minute bucket ให้ key เดียวกัน (`live:1787831400000`) ทั้งที่ snapshot มีการ mask ข่าว/event และคำนวณเวลาตาม `asOf` | เปลี่ยน server cache key เป็น namespace + exact `asOf` และเปลี่ยน React Query keys ใน dashboard/news route เป็น exact `asOf` | `src/lib/news.functions.test.ts` ผ่าน; focused cache/news suite ผ่าน |
| F-02 | News → AI boundary | source macro event อาจมี `released: true` และ `actual` แม้เวลาของ event อยู่หลัง `asOf`; payload เดิมกรองเพียง `released` จึงมีความเสี่ยงส่ง actual อนาคตเข้า AI | เพิ่ม `maskNewsEventsForAsOf` ก่อน interpretation และเพิ่ม `buildInterpretationPayload` ที่รับเฉพาะ `released && time <= asOf` | `src/lib/news.functions.test.ts` และ `src/lib/news/interpret.server.test.ts` ตรวจ future actual แล้วผ่าน |
| F-03 | Provider state / News UI | `buildLiveNewsSnapshot` ตั้ง `live: true` แม้ snapshot stale; UI จึงแสดง `ข่าวจริง (LIVE)` พร้อมข้อมูล stale | ตั้ง `live: !stale` และให้ NewsPanel แยก `ข่าวจริง (STALE)` ออกจาก `ข่าวเดโม` | `src/lib/news/build-snapshot.test.ts` ผ่าน; UI path ใช้ state ที่แก้แล้ว |
| F-04 | Settlement / market integrity | provider output ที่เรียงย้อนกลับหรือมี duplicate timestamp ถูก filter/slice แล้วกลายเป็น horizon ที่ score ได้ | settlement จับ provider timeout, ตรวจ runtime OHLC, บังคับ strict ascending order และ contiguous M15 interval; invalid set คืน `not_ready` พร้อม score ว่าง | `src/lib/settlement.test.ts` เพิ่มกรณี reversed, duplicate, malformed และ timeout; ผ่าน 7 tests |
| F-05 | Market future boundary | `validateMarketDataFeed` ยอมรับ `fetchedAt` และ candle ที่ล้ำ `now` เกิน tolerance ทำให้ feed อาจดูสดทั้งที่มาจากอนาคต | เพิ่ม future guard สำหรับ fetched metadata และ candle โดยใช้ tolerance 60 วินาทีเดียวกับ provider contract | `src/lib/market/contract.test.ts` เพิ่ม future candle/metadata case; ผ่าน 5 tests |
| F-06 | Provider-state copy | UI หลายจุดยังเขียน `Twelve Data` ทั้งที่ active runtime ใน `CODE_MAP.md` และ Home status ใช้ Gold API ผ่าน Supabase | แก้ AppShell, Disclaimer, History และ History detail ให้ใช้ `Gold API` และอัปเดตข้อความ settlement ที่เกี่ยวข้อง | grep ใน `src` ไม่พบข้อความ `Twelve Data`; production build ผ่าน |
| F-07 | Explicit Demo / auth failure path | ก่อนแก้ การเปิด `/?demo=true` ใน local environment ที่ไม่มี Supabase env ถูก redirect ไป `/login` แม้ผู้ใช้ระบุโหมด Demo อย่างชัดเจน; กด Demo ก่อนแก้แล้วยังอยู่หน้า login | ให้ route loader และ HomeGate อนุญาต explicit Demo เมื่อ auth check ล้มเหลว แต่ยัง redirect ผู้ใช้ที่ไม่ได้ร้องขอ Demo | browser เปิด `/?demo=true` ได้ dashboard, แสดง `DEMO fallback`; เปิด `/history` และ `/news` ได้ |

การแก้ไขทั้งหมดเป็นการเปลี่ยนแปลงเฉพาะ boundary และข้อความสถานะ ไม่มีการแก้ไฟล์ generated ใน `src/integrations/supabase/*`, ไม่มีการเพิ่ม order/trade path และไม่มีการนำ provider ใหม่เข้ามา

## Regression tests ที่เพิ่มหรือขยาย

ชุดทดสอบที่ขยายในรอบนี้อยู่ในตารางต่อไปนี้

| ไฟล์ | Coverage ใหม่หรือที่ขยาย |
|---|---|
| `src/lib/news.functions.test.ts` | exact cache key แยก `asOf` และ event actual masking boundary |
| `src/lib/news/interpret.server.test.ts` | future released event ไม่เข้า AI payload |
| `src/lib/news/build-snapshot.test.ts` | stale live news ไม่ถูก label เป็น LIVE |
| `src/lib/settlement.test.ts` | reversed/duplicate/malformed candle และ provider timeout ไม่ถูก score |
| `src/lib/market/contract.test.ts` | future candle และ future fetched metadata ถูก reject |

ผลรวมล่าสุดคือ **92 tests จาก 23 test files ผ่านทั้งหมด** เพิ่มจาก baseline 84 tests โดยไม่มีการปิดหรือ skip test เดิม

## Final verification

| คำสั่ง | ผล |
|---|---|
| `npm test` | ผ่าน: 92 tests จาก 23 test files |
| `npm run lint` | ผ่าน ไม่มี error/warning |
| `npx tsc --noEmit` | ผ่าน |
| `npm run build` | ผ่าน production build |
| `git diff --check` | ผ่าน |
| populated-secret scan | ไม่พบค่า secret ที่ถูกเติมจริงนอก template/documentation |

## Browser smoke ที่ทำจริง

local dev server ทำงานที่ `http://localhost:8080` โดย environment ไม่มี `SUPABASE_URL` และ `SUPABASE_PUBLISHABLE_KEY` จึงไม่อ้างว่า Cloud ใช้งานได้ การตรวจซ้ำทำที่ default browser viewport และครอบคลุม explicit Demo, dashboard, bottom-navigation ไป History, เมนูเพิ่มเติมไป News, loading/empty/error presentation และข้อความ provider

ก่อนแก้ F-07, `/?demo=true` ถูกส่งไป `/login` เมื่อ auth check ล้มเหลว หลังแก้สามารถเข้า dashboard ได้โดยตรง แสดง `DEMO fallback`, เหตุผล fallback จาก Supabase ที่ยังไม่พร้อม และวิเคราะห์ด้วย frozen dataset ได้ จากนั้นเปิด `/history` ได้พร้อม empty state และเปิด `/news` ได้พร้อม `ข่าวเดโม` กับ event actual ที่ถูก mask ตาม frozen provider รายละเอียดอยู่ใน [RED_TEAM_BROWSER_NOTES.md](RED_TEAM_BROWSER_NOTES.md)

## สิ่งที่ยัง verify ไม่ได้

| รายการ | เหตุผลและสถานะ |
|---|---|
| Supabase migration, RLS, pgTAP และ cross-user REST allow/deny | ยังไม่ได้ execute บน Supabase environment จริง เนื่องจาก sandbox ไม่มี Supabase CLI/Docker และไม่มี project ref ที่เจ้าของยืนยัน จึง **ไม่เคลมว่าผ่าน** |
| Gold API live response, Edge Function, Vault/Cron และ 240-candle warmup | ไม่มี production secret และ environment จริงใน session; ตรวจได้เฉพาะ parser, contract, readiness และ source unit tests |
| race condition ข้ามหลาย browser/process | source-level idempotency และ save/attach mocks มีอยู่เดิม แต่ยังไม่มี live DB concurrency test รอบนี้ |
| mobile viewport 360/390/412 แบบ dedicated และ screen reader/contrast audit | browser smoke รอบนี้ใช้ default viewport; ไม่อ้าง dedicated mobile/accessibility audit เพิ่มเติม |
| authenticated account, logout/reload และ cross-user UI | local auth provider ไม่เชื่อมต่อ จึงตรวจได้เพียง pure policy tests และ explicit Demo path |

ข้อสรุปคือ branch นี้ลด failure ที่ยืนยันได้ใน cache/no-look-ahead, AI boundary, settlement integrity, future market data, provider labeling และ explicit Demo path โดยคง architecture และ active market integration เดิมไว้ ส่วน DB/RLS/live provider ต้องรันใน staging ที่เจ้าของยืนยันก่อนจึงจะสรุปผลได้

## References

[1]: CODE_MAP.md "Repository code map and invariant summary"
[2]: ROADMAP.md "Repository roadmap and verification constraints"
[3]: MANUS_PROGRESS.md "Prior implementation and verification history"
[4]: src/lib/news.functions.ts "News cache and server orchestration"
[5]: src/lib/news/interpret.server.ts "AI interpretation boundary"
[6]: src/lib/settlement.ts "Settlement readiness and scoring boundary"
[7]: src/lib/market/contract.ts "Normalized market-data validation contract"
[8]: src/routes/index.tsx "Home guard and dashboard route"

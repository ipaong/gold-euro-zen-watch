# Gold Oracle Research V3 — Goal, Tasks และ Handoff

อัปเดต: 29 สิงหาคม 2026

## Goal

สร้าง Direction Engine ที่จำลองเวลาเดินจากอดีตไปอนาคตทีละแท่ง: ณ เวลาใดระบบเห็นได้เฉพาะกราฟที่ปิดแล้วถึงเวลานั้น, ล็อกคำทาย 5 แท่ง, รอให้ผลครบ, เปิดเฉลย แล้วจึงอัปเดตความเชื่อของผู้เชี่ยวชาญสำหรับคำทายถัดไป

เป้าหมายวัดผลไม่ใช่ accuracy อย่างเดียว แต่ต้องรายงานพร้อมกันอย่างน้อย:

- directional accuracy
- directional coverage และ WAIT rate
- severe opposite miss
- sample size และช่วงข้อมูล
- ผล standalone ของชั้นที่เพิ่ม เทียบกับ Final Signal และ baseline เดิม

## Invariants ที่ห้ามทำลาย

1. ที่ simulated index `i` ห้ามอ่าน candle หลัง `i`
2. prediction horizon 5 แท่งจะเรียนได้เมื่อแท่ง `i + 5` ปิดแล้วเท่านั้น
3. analog candidate ใช้ได้เมื่อผลครบทั้ง horizon ก่อนหรือ ณ เวลาที่กำลังทาย
4. เรียงเวลาและตัด timestamp ซ้ำก่อน replay; `asOf` เป็น hard boundary
5. adaptive layer ช่วยถ่วงน้ำหนัก/ยับยั้ง แต่ Quality Gate ยังเป็นผู้ตัด Final Signal จุดเดียว
6. ห้ามเลือกเล่าเฉพาะ accuracy โดยซ่อน coverage หรือผล standalone
7. locked prediction และ settled result เดิมต้อง immutable

## V3 implementation ที่เสร็จแล้ว

- [x] `src/lib/adaptive-replay.ts` — replay → reveal → learn queue แบบ strict chronology
- [x] ผู้เชี่ยวชาญ 5 ชุด: tape, trend, mean reversion, breakout และ historical analog
- [x] feature vector จาก normalized returns, ATR regime, EMA gap/slope, RSI, z-score, breakout และ candle body flow
- [x] regime แยก trending up/down, ranging และ volatile
- [x] decayed online Brier skill ทั้ง global และ per-regime พร้อม shrinkage
- [x] เรียน orientation/inversion ของ expert จากอดีตเมื่อมีหลักฐานขั้นต่ำ โดยไม่ย้อนแก้ผลเก่า
- [x] analog search ใช้ similarity, regime match และ recency weighting
- [x] projection fan จาก analog weighted percentile 25/50/75 สำหรับ 5 แท่ง
- [x] ต่อ adaptive replay เข้า Direction Engine V3 เป็น confirmation/veto layer
- [x] UI แสดง Replay V3 sample/accuracy เมื่อ calibrated
- [x] unit tests ของ chronology, no-look-ahead, delayed reveal และ adaptive weights
- [x] deterministic walk-forward benchmark แยก adaptive standalone กับ Final Signal

## Frozen GC=F benchmark ณ commit รอบ V3

Dataset: same-instrument frozen Yahoo `GC=F`, M15, horizon 5, warmup 240, test points 94

| Layer                         | Directional calls | Hits | Accuracy | Coverage | Severe opposite |
| ----------------------------- | ----------------: | ---: | -------: | -------: | --------------: |
| Final Direction Engine V3     |                10 |    9 |      90% |      11% |               0 |
| Adaptive replay standalone    |                32 |   16 |      50% |      34% |              11 |
| Historical-pattern standalone |                64 |   38 |      59% |      68% |              16 |
| Continuation baseline         |                77 |   34 |      44% |      82% |               — |

ข้อสรุปที่อนุญาต: บน fixture นี้ adaptive replay มีประโยชน์เป็นชั้น confirmation/veto และ Final Signal แม่นขึ้นจาก V2 83% เป็น V3 90% พร้อม coverage ลดจาก 13% เป็น 11% และ severe opposite ยังเป็นศูนย์

ข้อสรุปที่ยังห้าม: adaptive standalone ยังไม่ได้เหนือ baseline อย่างน่าเชื่อถือ, sample ของ Final Signal มีเพียง 10 calls และ fixture เดียวไม่ใช่หลักฐาน production/generalization

## Task queue ถัดไป

### P0 — พิสูจน์ข้ามช่วงเวลา

- [ ] เพิ่ม frozen GC=F fixtures หลาย regime/เดือน โดยยึด provider contract เดิม
- [ ] ทำ anchored/rolling walk-forward หลาย fold และรวมผลแบบ out-of-sample เท่านั้น
- [ ] รายงาน accuracy/coverage/severe-opposite/Brier แยก regime และ session
- [ ] เพิ่ม negative controls: shuffled labels, shifted labels และ future-leak sentinel
- [ ] ทำ ablation: ปิดทีละ expert, ปิด inversion, ปิด regime weights, ปิด analog recency

### P1 — Calibration โดยไม่ไล่ตาม fixture

- [ ] แยก tuning window กับ frozen holdout แบบกำหนดล่วงหน้า
- [ ] เลือก threshold จาก objective ที่ลงโทษ severe opposite และ coverage ต่ำ
- [ ] เพิ่ม reliability curve / expected calibration error ของ `probabilityUp`
- [ ] จำกัดจำนวน candidate configurations และบันทึกทุก trial เพื่อลด multiple-testing bias

### P2 — Product feedback loop

- [ ] persist replay engine version, expert weights, regime และ sample count ลง locked audit snapshot
- [ ] หน้า Performance แสดง V3 fold metrics และเปรียบเทียบ champion/challenger
- [ ] shadow-run รุ่น challenger โดยไม่กระทบ Final Signal จนผ่าน acceptance gate
- [ ] promotion gate: holdout ดีขึ้น, severe opposite ไม่แย่, coverage ไม่ยุบเกินเกณฑ์ และ sample ถึงขั้นต่ำ

## จุดเริ่มสำหรับ AI ตัวถัดไป

1. อ่าน `AGENTS.md`, `CODE_MAP.md`, เอกสารนี้ และ `ROADMAP.md`
2. เริ่มจาก `src/lib/adaptive-replay.ts`, `src/lib/direction-engine.ts`, `src/lib/direction-benchmark.ts`
3. รัน `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` และ Python bridge tests ก่อนแก้
4. ห้ามปรับ threshold จากผล fixture เดียวแล้วรายงานเป็น improvement
5. ก่อนส่งงานให้อัปเดตตาราง benchmark, task checkbox, `CODE_MAP.md`, commit SHA และ push `main` แบบ non-force

# Gold Oracle V3 — Walk-Forward Experiment Report

อัปเดต: 29 สิงหาคม 2026  
Experiment contract: `1.0.0`

## ขอบเขต

- immutable fixture: Yahoo `GC=F`, M15, 338 candles
- evaluation anchors: 94 จุด หลัง warmup 240 candles
- horizon: 5 candles
- ช่วง evaluation จริง: 26 ส.ค. 2026 11:45 UTC ถึง 27 ส.ค. 2026 12:00 UTC
- ไม่มี tuning หรือ promotion ในรายงานนี้
- `softBrier` map ผล BUY/SELL/WAIT เป็น target `1/0/0.5`
- session breakdown เป็น fixed UTC 6-hour proxy เท่านั้น ยังไม่ใช่ exchange calendar/DST engine

ทุก prediction ถูกสร้างก่อน outcome ของตัวเอง และ learner ได้รับ feedback เมื่อ horizon ครบแล้วเท่านั้น

## Anchored online walk-forward

|    Fold | UTC range                 | Sample |  Calls |   Hits |   Accuracy |   Coverage | Severe opposite | Soft Brier |
| ------: | ------------------------- | -----: | -----: | -----: | ---------: | ---------: | --------------: | ---------: |
|       1 | 26 Aug 11:45–17:30        |     24 |      5 |      3 |     60.00% |     20.83% |               1 |     0.1820 |
|       2 | 26 Aug 17:45–27 Aug 00:30 |     24 |      7 |      2 |     28.57% |     29.17% |               3 |     0.1764 |
|       3 | 27 Aug 00:45–06:15        |     23 |      8 |      6 |     75.00% |     34.78% |               2 |     0.2000 |
|       4 | 27 Aug 06:30–12:00        |     23 |     12 |      5 |     41.67% |     52.17% |               5 |     0.2384 |
| **รวม** |                           | **94** | **32** | **16** | **50.00%** | **34.04%** |          **11** | **0.1988** |

Fold accuracy แกว่ง 28.57–75% และ fold สุดท้ายมี severe opposite 5 ครั้ง จึงไม่มีหลักฐานให้เพิ่มอิทธิพล adaptive standalone ใน production

## Rolling-window stress test

Rolling mode รีเซ็ต learner ด้วย trailing 240 candles ณ ทุก anchor

| Mode        | Sample | Calls | Hits | Accuracy | Coverage | Severe opposite | Soft Brier |
| ----------- | -----: | ----: | ---: | -------: | -------: | --------------: | ---------: |
| Anchored    |     94 |    32 |   16 |   50.00% |   34.04% |              11 |     0.1988 |
| Rolling 240 |     94 |    31 |   15 |   48.39% |   32.98% |              12 |     0.2059 |

ผล rolling ไม่ยืนยัน edge เพิ่มเติม และอ่อนกว่า anchored เล็กน้อยบน fixture นี้

## Regime และ UTC time bucket

### Regime

| Regime        | Sample | Calls | Accuracy | Coverage | Severe | Soft Brier |
| ------------- | -----: | ----: | -------: | -------: | -----: | ---------: |
| Trending up   |      9 |     3 |  100.00% |   33.33% |      0 |     0.1551 |
| Trending down |     53 |    17 |   41.18% |   32.08% |      7 |     0.2012 |
| Ranging       |     32 |    12 |   50.00% |   37.50% |      4 |     0.2071 |

ไม่มี volatile sample และ trending-up มีเพียง 3 directional calls; ห้ามตีความ 100% เป็น edge ที่พิสูจน์แล้ว

### Fixed UTC proxy

| UTC bucket  | Sample | Calls | Accuracy | Coverage | Severe | Soft Brier |
| ----------- | -----: | ----: | -------: | -------: | -----: | ---------: |
| 00:00–05:59 |     24 |     7 |   71.43% |   29.17% |      2 |     0.1974 |
| 06:00–11:59 |     25 |    13 |   46.15% |   52.00% |      5 |     0.2376 |
| 12:00–17:59 |     25 |     5 |   60.00% |   20.00% |      1 |     0.1791 |
| 18:00–23:59 |     20 |     7 |   28.57% |   35.00% |      3 |     0.1765 |

## Negative controls

| Control                                               |   Sample | Calls |   Accuracy | Severe | Soft Brier |
| ----------------------------------------------------- | -------: | ----: | ---------: | -----: | ---------: |
| Actual chronological labels                           |       94 |    32 |     50.00% |     11 |     0.1988 |
| Seeded shuffled labels                                |       94 |    32 |     31.25% |     17 |     0.2285 |
| Labels shifted forward `6 × horizon + 1 = 31` anchors |       63 |    17 |     29.41% |      9 |     0.2564 |
| Future-leak sentinel                                  | 5 checks |     — | 0 mismatch |      — |          — |

shift ระยะสั้น 7 anchors ถูกปฏิเสธก่อนล็อก contract เพราะ outcome windows ใกล้กันและ autocorrelation ยังสูง; final control ใช้กฎคงที่ `6 × horizon + 1` เพื่อแยกช่วงให้ไกลกว่าผล 5 แท่งอย่างชัดเจน

## Fixed ablation matrix

ตารางนี้มีไว้หา dependency/risk เท่านั้น ห้ามเลือกรุ่นที่ดูดีที่สุดแล้ว promote จาก fixture เดิม

| Variant                | Calls | Accuracy | Coverage | Severe | Soft Brier | Δ accuracy | Δ severe |
| ---------------------- | ----: | -------: | -------: | -----: | ---------: | ---------: | -------: |
| Champion               |    32 |   50.00% |   34.04% |     11 |     0.1988 |       0.00 |        0 |
| Without tape           |    25 |   40.00% |   26.60% |      9 |     0.1984 |     -10.00 |       -2 |
| Without trend          |    42 |   54.76% |   44.68% |     10 |     0.1978 |      +4.76 |       -1 |
| Without mean reversion |    33 |   45.45% |   35.11% |     12 |     0.2010 |      -4.55 |       +1 |
| Without breakout       |    35 |   45.71% |   37.23% |     12 |     0.2009 |      -4.29 |       +1 |
| Without analog         |    48 |   54.17% |   51.06% |     14 |     0.2032 |      +4.17 |       +3 |
| Without inversion      |    12 |   33.33% |   12.77% |      7 |     0.2101 |     -16.67 |       -4 |
| Without regime skill   |    23 |   17.39% |   24.47% |     16 |     0.2325 |     -32.61 |       +5 |
| Without analog recency |    31 |   51.61% |   32.98% |     10 |     0.1965 |      +1.61 |       -1 |

ข้อสังเกตที่ต้องนำไปทดสอบกับ fixture อิสระ:

- regime skill มี contribution สูงสุดในชุดนี้ แต่ยังอาจเป็น fixture-specific
- inversion เพิ่ม accuracy/coverage แต่เพิ่มจำนวน severe call; objective ในอนาคตต้องลงโทษ severe opposite อย่างชัดเจน
- ถอด trend หรือ analog ดูดีขึ้นบาง metric แต่เป็นผล post-hoc; ห้ามเปลี่ยน production จากตารางนี้
- analog ลดจำนวน call/severe rate บางส่วน แต่ Brier และ accuracy contribution ยังไม่เสถียร

## ข้อสรุป

experiment harness ผ่าน no-look-ahead sentinel และ negative controls ที่ทำลาย temporal alignment ให้ผลแย่ลง อย่างไรก็ตาม adaptive standalone ยังไม่แสดง generalization: fold variance สูง, rolling ไม่ดีขึ้น, regime/session samples บางมาก และมีข้อมูลเพียงประมาณหนึ่งวันของ evaluation

Direction Engine V3 production defaults จึงไม่เปลี่ยนในรอบนี้ งานถัดไปคือเพิ่ม immutable `GC=F` fixtures หลายเดือน/หลาย regime แล้วรัน contract เดิมโดยไม่แก้ thresholds ก่อนเห็น holdout

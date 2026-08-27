# Market Provider Research — Yahoo-first Read-only Feed

อัปเดต: 27 สิงหาคม 2026

## ข้อสรุปปัจจุบัน

โปรเจกต์เปลี่ยนเส้นทาง active market data จาก Twelve Data/Gold API มาเป็น **Yahoo Finance Chart endpoint แบบ server-side** สำหรับ `GC=F` โดยใช้กรอบ `15m` ที่ตรวจ payload จริงแล้ว. `GC=F` คือ Gold Futures ของ COMEX ซึ่งเป็น **proxy สำหรับการวิเคราะห์เท่านั้น** ไม่ใช่ `XAUUSD` หรือ `XAUEUR` CFD ของ XM และไม่มี order/execution path ในระบบ.

| Provider/แนวทาง                  | สิ่งที่ยืนยันได้                                                                                                                                                                                                                            | Trade-off สำหรับโปรเจกต์นี้                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Yahoo Finance Chart              | `query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=15m&range=5d` คืน `meta`, epoch-second timestamps และ parallel OHLC arrays; response ที่ตรวจพบ `symbol=GC=F`, `instrumentType=FUTURE`, `exchangeName=CMX`, `dataGranularity=15m` | เป็น public/delayed quote, ไม่มี execution equivalence กับ XM, retention/rate-limit อาจเปลี่ยน; ต้องแสดง delayed และ fallback ต่อผู้ใช้เสมอ |
| Yahoo `1m/5m/15m/1h/1d`          | Parser รองรับ interval policy `1m=7d`, `5m=60d`, `15m=5d`, `1h=2y`, `1d=10y`; active registry เปิดเฉพาะ asset/timeframe ที่มี response + frozen fallback ผ่านการตรวจ                                                                        | Intraday retention, session gaps และ public endpoint rate limit ต้องถือเป็นข้อจำกัด ไม่ควรอ้างว่ามี tick หรือ real-time เต็มรูปแบบ          |
| Gold API `XAU/EUR` ผ่าน Supabase | Legacy normalized parser/DB path ยังคงอยู่เพื่อ migration compatibility                                                                                                                                                                     | เป็นคนละ instrument และไม่ถูกใช้เป็น fallback ให้ GC=F เพื่อป้องกันการเทียบข้อมูลข้ามตลาด                                                   |
| MetaTrader 5 Python integration  | `copy_rates_from` คืนแท่งที่มีเวลาเปิดน้อยกว่าหรือเท่ากับเวลาที่ขอ, เวลาใน MT5 เป็น UTC และจำนวนแท่งย้อนหลังขึ้นกับประวัติที่ terminal มี                                                                                                   | สอดคล้องกับ broker-specific XAUEUR/XAUUSD แต่ต้องมี terminal/credential/bridge ภายนอก; ยังไม่มี trade path                                  |
| OANDA v20 REST                   | มี granularity `M15`, OHLC และ `complete` flag                                                                                                                                                                                              | ต้องมี v20 account/token และ symbol universe อาจไม่ตรง XM; ยังไม่เลือกเป็น active vendor                                                    |

## Normalized contract และ source-of-truth rules

ทุก provider ต้องแปลงเข้า `MarketDataFeed` ที่มี `symbol`, `providerSymbol`, `displayName`, `timeframe`, `intervalMs`, `source`, `sourceType`, `delayed`, `fetchedAt` และ closed-only candles. Validator ตรวจ symbol mapping, OHLC integrity, UTC epoch, duplicate/order, interval gaps, open candle และ stale age ก่อนส่งต่อให้ analysis engine.

Yahoo cache เก็บเฉพาะ response ที่ parse และ validate สำเร็จ โดย cache key แยก `assetId:timeframe`, TTL 60 วินาที, timeout 8 วินาที และ rate-limit `429` ถูกแสดงเป็น fallback reason. ห้ามใช้ข้อมูล provider อื่นที่เป็นคนละ instrument มาเติมแท่งเงียบ ๆ.

> **กฎสำคัญ:** ราคา Yahoo `GC=F` ใช้ดูทิศทางของ Gold Futures เท่านั้น ไม่ควรใช้ตัดสิน spread, stop, lot, execution หรือความสอดคล้องแบบแท่งต่อแท่งกับ XM `XAUUSD`/`XAUEUR`.

## Sources

1. [Yahoo Finance Chart endpoint](https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=15m&range=5d&events=div%2Csplits)
2. [Yahoo Finance Gold Futures quote](https://finance.yahoo.com/quote/GC%3DF/)
3. [MQL5 `copy_rates_from`](https://www.mql5.com/en/docs/python_metatrader5/mt5copyratesfrom_py)
4. [OANDA v20 Instrument Definitions](https://developer.oanda.com/rest-live-v20/instrument-df/)

## Verification evidence

- Browser retrieval of Yahoo Chart endpoint returned `GC=F`, `CMX/COMEX`, `FUTURE`, `dataGranularity=15m`, timestamps และ OHLC arrays.
- Frozen `src/data/gc-f-15m.json` contains 338 closed candles from the captured response; it is labelled `demo` and used only as same-instrument fallback.
- `src/lib/market/yahoo.test.ts` covers ascending order, duplicate replacement, open/future filtering, wrong symbol, malformed OHLC, and interval range policy; asset-aware news and market readiness/fallback tests cover downstream source safety.
- `pnpm test` ผ่าน 94 tests จาก 27 test files, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` ผ่านหลัง integration รอบล่าสุด. Browser visual QA ยังติดข้อจำกัด local Supabase/auth environment; ไม่เคลมว่า live app deployment หรือ account-level Yahoo availability ผ่านแล้ว.

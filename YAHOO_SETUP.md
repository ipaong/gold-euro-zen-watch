# Yahoo Finance Market Data Setup

อัปเดต: 27 สิงหาคม 2026

## Runtime path

หน้า Home เรียก `getYahooMarketFeed` ผ่าน TanStack server function เท่านั้น. Browser ไม่เรียก Yahoo Chart โดยตรงและไม่มี credential หรือ provider secret ใน bundle; endpoint ที่ใช้เป็น public Chart endpoint แต่ยังคง proxy ผ่าน server เพื่อควบคุม timeout, validation, cache และ fallback.

Active default คือ:

| Field                                      | Value                                             |
| ------------------------------------------ | ------------------------------------------------- |
| Asset                                      | Gold Futures (Yahoo proxy)                        |
| Internal/provider symbol                   | `GC=F`                                            |
| Exchange/instrument from verified response | `CMX` / `COMEX`, `FUTURE`                         |
| Timeframe                                  | `15m`                                             |
| Request range                              | `5d`                                              |
| Data status                                | `delayed`                                         |
| Warmup gate                                | 240 closed candles                                |
| Cache                                      | success-only, per `assetId:timeframe`, 60 seconds |
| Timeout                                    | 8 seconds                                         |

## Request shape

```text
GET https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=15m&range=5d&events=div%2Csplits
```

The parser reads `chart.result[0].timestamp` and `chart.result[0].indicators.quote[0]`. Timestamps are epoch seconds and are converted to UTC milliseconds. Rows with missing OHLC, invalid OHLC, duplicate timestamps, or an interval that has not closed by the server observation time are excluded or rejected according to the normalized contract.

## Interval policy

The parser has bounded policies for `1m`, `5m`, `15m`, `1h`, and `1d`. The asset registry deliberately exposes only the `gold/15m` combination until each new asset/timeframe has a live response, a truthful frozen fixture, and a regression test. This prevents the UI from silently falling back to a different instrument.

| Interval | Yahoo request range policy |   Active in UI |
| -------- | -------------------------: | -------------: |
| `1m`     |                         7d |             No |
| `5m`     |                        60d |             No |
| `15m`    |                         5d | Yes for `GC=F` |
| `1h`     |                         2y |             No |
| `1d`     |                        10y |             No |

## Fallback and failure semantics

A Yahoo response is usable only after symbol, OHLC, cadence, ordering, closed-candle, freshness and minimum-warmup checks. Successful validated responses are cached; failures are not cached. HTTP `429`, timeout, non-2xx response, invalid JSON, wrong symbol, empty closed-candle set, or insufficient history produce an explicit health/fallback reason and the dashboard uses the same-instrument frozen `GC=F` snapshot.

The frozen fallback is not live and is not used to settle a live/delayed prediction. History entries retain provider, provider symbol, timeframe, data status and a closed-candle snapshot so the journal does not mix source data later.

## XM warning

Yahoo `GC=F` is a COMEX gold futures proxy. It is not XM's broker-specific `XAUUSD` or `XAUEUR` CFD feed. The chart may differ due to contract, quote timing, spread, session, rollover, liquidity, timezone and price precision. Do not use Yahoo data to infer XM execution price, spread, lot size, stop distance or order outcome.

## Manual verification checklist

1. Open the Home route in the deployed environment and confirm the status badge says `DELAYED · Yahoo · read-only` when a validated response is available.
2. Confirm the status panel shows `GC=F · 15m`, the latest accepted closed-candle timestamp (the freshness anchor, not response-receipt time) and the Yahoo limitation text.
3. Temporarily force a timeout or `429` in a staging-only test and verify the badge changes to `ERROR · DEMO fallback` with a visible reason.
4. Confirm a saved delayed record is labelled with Yahoo/source metadata and cannot be settled against the frozen demo.
5. Confirm bundle inspection does not contain server-only provider implementation details beyond the public endpoint string and no secrets.

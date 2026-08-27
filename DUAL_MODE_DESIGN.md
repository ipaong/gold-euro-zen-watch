# Dual-Mode Design Contract

อัปเดต: 28 สิงหาคม 2026
เป้าหมาย: รองรับการวิเคราะห์ทองสองแหล่งโดยไม่ทำให้ผู้ใช้เข้าใจว่าเป็นราคาเดียวกัน

## Product decision

ระบบจะมีสอง mode ที่ผู้ใช้เลือกเองอย่างชัดเจน และจะไม่ auto-switch ข้าม instrument เมื่อ mode ที่เลือกใช้งานไม่ได้:

| Mode | Source | Instrument | Cadence | เมื่อใช้ไม่ได้ |
|---|---|---|---|---|
| **Cloud Mode** | Yahoo Finance Chart | `GC=F` COMEX Gold Futures | `15m`, delayed | แสดง `Cloud unavailable`/`DEMO fallback` ตามเดิม; ไม่เรียกเป็น XM price |
| **XM Live Mode** | MT5 terminal ที่ login XM ผ่าน local bridge | XM symbol `GOLD` | `M15` | แสดง `XM bridge offline/stale/not ready` และหยุด analysis; ให้ผู้ใช้กดกลับ Cloud เองได้ แต่ห้าม fallback เงียบ ๆ |

`XAUEUR` จะยังไม่เป็นหนึ่งในสอง active modes เพราะเป็นคนละ instrument/สกุลเงินกับ XM `GOLD`. Legacy XAUEUR/Gold API parser และ migration คงไว้เฉพาะ compatibility/historical scope.

## Data flow

```text
Cloud Mode:
Yahoo Chart (server) → normalized feed → validation/readiness → analysis

XM Live Mode:
XM MT5 GOLD M15 on user's Windows PC
  → Python MetaTrader5 read-only bridge
  → HTTPS POST to Supabase Edge Function
  → validated append-only XM candle store
  → server-only read function
  → normalized feed → validation/readiness → analysis
```

The bridge reads closed bars only. It does not call `order_send`, inspect positions for trading decisions, or place trades. MT5 `copy_rates_from_pos` treats position `0` as the current bar, so the bridge requests from position `1` and marks every transmitted bar complete. Server and database validation remain authoritative even if the bridge is modified locally.

## Contract and provenance

XM payloads must declare `source = "xm-mt5"`, `symbol = "GOLD"`, `timeframe = "15m"`, `version = "1.0.0"`, and UTC Unix-second bar timestamps. Every bar must have `symbol = "GOLD"`, `timeframe = "15m"`, `complete = true`, finite positive OHLC values, valid candle geometry, a timestamp that is not materially in the future, and no duplicate/reversed timestamp. The normalized feed returned to analysis uses `symbol = "GOLD"`, `providerSymbol = "GOLD"`, `sourceType = "live"`, `delayed = false`, and a source label that names XM/MT5. `fetchedAt` remains the latest accepted closed-candle time; it is not response-receipt time.

The journal must persist mode, provider, provider symbol, timeframe, data status and the candle snapshot already captured by `Prediction`. A prediction saved in XM mode must never be replayed or settled against Yahoo `GC=F` or the legacy XAUEUR fixture. Until a source-faithful XM outcome path exists, XM predictions are locked but not automatically settled, with an explicit explanation in History.

## Freshness and fallback policy

The XM UI has three explicit non-success states: `OFFLINE · XM bridge` when the endpoint has no usable feed, `STALE · XM bridge` when the last closed candle exceeds the configured freshness window, and `WARMING · XM bridge` when fewer than 240 valid closed candles are available. These states are not renamed to `LIVE` and do not silently use a frozen Yahoo fixture. The user can intentionally choose Cloud Mode from the mode switch.

Cloud Mode keeps its existing Yahoo behavior, including delayed/error/demo labels and same-instrument frozen `GC=F` fallback. The mode switch is stored locally for convenience, but a stored XM selection must not bypass authentication or imply that the bridge is connected.

## Bridge security boundary

The first implementation targets a single private owner. The bridge secret is stored only on the user's PC and in Supabase Edge Function secrets; it must never be committed or sent from browser JavaScript. The endpoint accepts POST only, verifies the secret with constant-time comparison, validates body size and schema, and uses service-role access only inside the Edge Function. The endpoint must remain disabled/unconfigured until the owner supplies and deploys the secret. If the app is later opened to multiple users, replace the single shared secret with per-owner installation tokens and owner-bound RLS before enabling XM mode publicly.

## Operational assumptions

The user's Windows PC and MT5 desktop terminal must remain running and logged in to the XM account for XM Live Mode. Vercel/Nitro cannot run the MetaTrader5 Python package against the user's desktop terminal. The bridge is therefore an outbound client: it sends data to Supabase and does not expose an inbound port on the user's PC. Cloud Mode remains available without the PC.

## Friendly-user UX

The Home screen leads with a two-option mode switch and one short explanation. Cloud Mode says “ดูเทรนด์ทองโลกจาก Yahoo — ไม่ใช่ราคา XM”. XM Live Mode says “วิเคราะห์แท่ง `GOLD` จาก XM ของคุณ — ต้องเปิด MT5 bridge”. The status card always names the selected instrument and connection state. When XM is unavailable, the UI explains the one action needed (“เปิด MT5 และรัน bridge”) and offers an explicit “ใช้ Cloud Mode แทน” action. It does not show a fabricated signal from another instrument.

## Verification gates

Before claiming XM Live is ready, run bridge unit tests, TypeScript tests, database/RLS/immutability tests in a real Supabase staging project, deploy the Edge Function, send a real XM `GOLD` payload from the user's MT5 terminal, observe `GOLD · M15` candles in the app, and verify that a saved XM prediction cannot be settled using Yahoo or XAUEUR data. Until those steps are observed, the feature status must remain “implemented in source; waiting for owner environment verification”.

## References

- [MQL5 `initialize`](https://www.mql5.com/en/docs/python_metatrader5/mt5initialize_py)
- [MQL5 `copy_rates_from_pos`](https://www.mql5.com/en/docs/python_metatrader5/mt5copyratesfrompos_py)
- [MQL5 Python integration](https://www.mql5.com/en/docs/python_metatrader5)
- `YAHOO_SETUP.md`
- `CODE_MAP.md`
- `RELEASE_CANDIDATE_REPORT.md`

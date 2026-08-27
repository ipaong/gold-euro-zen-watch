# Dual-Mode Release Candidate Report

อัปเดต: 28 สิงหาคม 2026
Repository: `ipaong/gold-euro-zen-watch`
Base: `origin/main@a613048` ก่อน dual-mode implementation
Scope: single-owner private experiment; read-only market analysis; no automatic trading

## Executive assessment

Dual-Mode source implementation เสร็จใน feasible scope และรักษา invariant หลักของ repository: analysis รับเฉพาะ normalized closed candles, prediction snapshot เป็น immutable, settlement ไม่ใช้ข้อมูลก่อน/ผิด source, provider state ต้อง truthful และไม่มีคำสั่งซื้อขาย. ผู้ใช้เลือก source เองระหว่าง Cloud Mode กับ XM Live Mode; ระบบไม่ auto-switch ข้าม instrument.

สถานะที่ถูกต้องสำหรับ Codex review คือ **implemented in source; locally verified; waiting for owner-environment verification**. Cloud Mode ใช้ Yahoo `GC=F` แบบ delayed/frozen same-instrument fallback. XM Live Mode ใช้ `GOLD` M15 จาก MT5/XM ผ่าน read-only bridge แต่จะ online ได้ก็ต่อเมื่อ MT5 terminal, PC bridge, Supabase migration และ Edge Function ถูก deploy/configure จริง.

| Mode | Source | Instrument/cadence | เมื่อ source ใช้ไม่ได้ | สิ่งที่ไม่ควรตีความ |
|---|---|---|---|---|
| Cloud Mode | Yahoo Finance Chart | `GC=F` COMEX Gold Futures / `15m` delayed | explicit `ERROR`/`STALE`/`DEMO` same-instrument frozen fallback ตาม contract เดิม | ไม่ใช่ XM `GOLD`, ไม่ใช่ execution price |
| XM Live Mode | XM MT5 terminal ผ่าน PC bridge | XM symbol `GOLD` / `M15` | `OFFLINE`, `STALE` หรือ `WARMING`; หยุด analysis และให้ผู้ใช้เลือก Cloud เอง | ไม่ใช่ Yahoo `GC=F`, ไม่ใช่ `XAUEUR`, ไม่มี trade execution |

## Implemented data flow

```text
Cloud Mode:
Yahoo Chart server fetch
  → closed/finite/order/source validation
  → 240-candle readiness
  → analysis

XM Live Mode:
XM MT5 GOLD M15 terminal on owner's PC
  → Python read-only bridge; request position 1 onward
  → POST x-xm-bridge-secret to Supabase Edge Function
  → Edge schema/future/OHLC/order validation
  → append-only xm_market_candles via service-role RPC
  → server-only getXmMarketFeed read + normalized validation
  → 240-candle readiness
  → analysis
```

MT5 integration is intentionally read-only. The official MQL5 reference describes `initialize()`/`shutdown()` as the terminal connection lifecycle and `copy_rates_from_pos()` as the bar retrieval function; its position `0` is the current bar, so this bridge starts at position `1` and excludes the still-forming candle [1] [2]. The bridge does not call `order_send`, positions APIs or any trade function.

## Changes made

### Source and contracts

`src/lib/market/xm.ts` adds a strict `xm-mt5` `1.0.0` payload/row contract for `GOLD` `15m`. It checks positive finite OHLC, candle geometry, UTC 15-minute alignment, closed-only data, future tolerance, maximum batch size and strictly ascending unique timestamps. The normalized feed uses `symbol/providerSymbol = GOLD`, `sourceType = live`, `delayed = false`, and `fetchedAt` equal to the latest accepted closed candle.

`src/lib/market.functions.ts` adds server-only `getXmMarketFeed`. It reads only `xm_market_candles` rows matching `xm-mt5`, version `1.0.0`, `GOLD`, `15m`, and `is_closed = true`. It uses the server clock for freshness/future decisions and does not trust browser `requestedAt`. When XM is unavailable or fails readiness, it returns an explicit error/warming result; it does not call Yahoo or a frozen provider.

`src/lib/types.ts` adds optional `marketMode: "cloud" | "xm"` to `Prediction`. Because `cloud-store.ts` already writes the immutable snapshot, mode and source provenance survive in History without a destructive schema rewrite. `history.tsx` and `history.$id.tsx` block XM settlement/replay until a source-faithful XM outcome path exists, so an XM prediction cannot be evaluated using Yahoo `GC=F` or legacy `XAUEUR` data.

### Ingestion and database boundary

`bridge/xm_mt5_bridge.py` runs on the same Windows PC as the logged-in XM MT5 terminal. It selects symbol `GOLD`, requests M15 bars from position `1`, sorts and validates the payload, then sends an outbound HTTPS POST. It has no inbound listener, no credentials for XM server, and no trading API. `bridge/README.md` documents setup, one-shot smoke, continuous polling, secret handling and troubleshooting.

`supabase/functions/xm-bridge-ingest/index.ts` is POST-only and uses `XM_BRIDGE_SECRET` from Edge Function secrets. It applies constant-time secret comparison, body-size limits and strict payload validation before calling the service-role RPC. `supabase/migrations/20260828100000_xm_mt5_market_data.sql` adds an append-only `xm_market_candles` table, source/version/symbol/timeframe checks, UTC bucket checks, RLS/grants, immutable update/delete trigger and idempotent ingestion RPC. Conflicting OHLC for an existing bucket, reversed/duplicate batches, open bars and future bars fail closed.

### User experience

Home now starts with a two-option mode switch. Cloud labels explicitly mention Yahoo/GC=F/delayed and “ไม่ใช่ราคา XM”; XM labels mention GOLD/MT5/M15 and the need to keep MT5 plus bridge running on the PC. XM `OFFLINE`, `STALE` and `WARMING` messages explain what is missing and offer an explicit `ใช้ Cloud Mode แทน` action. The selected mode is stored locally for convenience, but storage does not imply that the bridge is online or bypass authentication.

AppShell, Disclaimer, Home status, History list/detail and first-run copy are mode-aware. Cloud’s frozen fallback remains visible as DEMO. XM failure is presented as unavailable/stale/warming and never as a fabricated signal from another source. Mobile captures at 360px and 412px show the mode cards, status card and bottom navigation without page-level horizontal clipping; the existing Performance table horizontal scroll remains an intentional responsive trade-off.

## Verification evidence

| Check | Result |
|---|---|
| `npm test -- --run` | Passed: **119 tests / 30 test files** |
| `npm run lint` | Passed: 0 errors/warnings |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed: production/Nitro build |
| `git diff --check` | Passed |
| `python3 -m py_compile bridge/xm_mt5_bridge.py bridge/test_xm_mt5_bridge.py` | Passed |
| `python3 -m unittest discover -s bridge -p 'test_*.py'` | Passed: 3 tests |
| XM pure contract tests | Passed: 8 tests covering source, symbol, timeframe, closed, order, duplicate, OHLC, alignment, future and rows |
| Mode preference tests | Passed: 2 tests |
| Database pgTAP additions | Written: 11 XM assertions added; **not executed locally** because Supabase CLI/Docker are unavailable |

Local browser evidence is recorded in `DUAL_MODE_BROWSER_NOTES.md`. It covers Cloud fallback, XM offline, stored XM reload, explicit XM-to-Cloud recovery, route screenshots at 360/412px, DOM overflow checks and console review. The browser console showed only expected missing local Supabase environment errors; no unexpected runtime exception was observed.

## Production boundary and remaining work

No production claim is made by this report. The sandbox did not have Supabase CLI/Docker, a confirmed Supabase project ref, MT5 Desktop, an XM login session, or deploy credentials. Therefore migrations, RLS, RPC, Edge Function authentication, real XM payload delivery, Yahoo deployed behavior, rate limits, 240-candle warmup and authenticated multi-user isolation remain unverified.

| Priority | Next action | Acceptance evidence |
|---|---|---|
| P0 | Apply the new migration in a confirmed staging Supabase project and run `supabase test db` | 48 pgTAP assertions pass, including XM RLS/immutability/idempotency and existing ownership tests |
| P0 | Set `XM_BRIDGE_SECRET` only in Supabase and the owner’s PC environment; deploy `xm-bridge-ingest` | Unauthorized request returns 401; valid request returns accepted/inserted counts; secret never appears in browser bundle/logs |
| P0 | Open XM MT5 on the owner PC, confirm symbol `GOLD`, run `python bridge/xm_mt5_bridge.py --once --bars 600` | Edge Function accepts payload; app shows `GOLD · M15`, latest closed timestamp and `LIVE · XM · read-only` |
| P1 | Verify bridge outage, stale data, malformed payload, conflicting bucket and restart/retry behavior | UI remains offline/stale/warming; no cross-source fallback; duplicate retry does not mutate OHLC |
| P1 | Verify Cloud and XM predictions separately over at least 50–80 locked/settled source-faithful samples | Performance compares only same-mode/source outcomes; do not combine `GC=F` and XM `GOLD` as one accuracy series |
| P2 | Build a source-faithful XM outcome/settlement path | XM prediction can reveal only against XM `GOLD` M15 bars after `asOf`; no Yahoo/XAUEUR fallback |

Until P0 and P1 evidence exists, the recommendation is **Codex review: approve source design for review, do not call XM Live production-ready, do not enable automatic settlement, and do not use the result as a broker execution signal**.

## Files to review

| Area | Files |
|---|---|
| Design/research | `DUAL_MODE_DESIGN.md`, `DUAL_MODE_RESEARCH.md`, `DUAL_MODE_BROWSER_NOTES.md` |
| Web app | `src/lib/market/mode.ts`, `src/lib/market/xm.ts`, `src/lib/market.functions.ts`, `src/routes/index.tsx`, `src/routes/history.tsx`, `src/routes/history.$id.tsx`, `src/components/app/AppShell.tsx` |
| Bridge | `bridge/xm_mt5_bridge.py`, `bridge/test_xm_mt5_bridge.py`, `bridge/README.md` |
| Database/API | `supabase/migrations/20260828100000_xm_mt5_market_data.sql`, `supabase/functions/xm-bridge-ingest/index.ts`, `supabase/config.toml`, `supabase/tests/database.test.sql` |
| Existing hardening | `RELEASE_CANDIDATE_REPORT.md`, `OVERNIGHT_ISSUES.md`, `RED_TEAM_FINDINGS.md`, `ROADMAP.md`, `CODE_MAP.md`, `MANUS_PROGRESS.md` |

## References

[1]: https://www.mql5.com/en/docs/python_metatrader5/mt5initialize_py "MQL5 Python initialize reference"
[2]: https://www.mql5.com/en/docs/python_metatrader5/mt5copyratesfrompos_py "MQL5 Python copy_rates_from_pos reference"

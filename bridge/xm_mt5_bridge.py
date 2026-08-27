"""Read-only XM MT5 GOLD M15 bridge.

The process must run on the same Windows machine as the logged-in MT5 terminal.
It never calls order_send or any trading API. It requests position 1 onward so
position 0 (the still-forming bar) cannot enter the payload.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import time
import urllib.error
import urllib.request
from typing import Any

SOURCE = "xm-mt5"
VERSION = "1.0.0"
SYMBOL = "GOLD"
TIMEFRAME = "15m"
INTERVAL_SECONDS = 15 * 60
DEFAULT_BAR_COUNT = 600
DEFAULT_POLL_SECONDS = 60

_STOP = False


def _stop(_signum: int, _frame: Any) -> None:
    global _STOP
    _STOP = True


def positive_number(value: Any, field: str) -> float:
    result = float(value)
    if not result == result or result in (float("inf"), float("-inf")) or result <= 0:
        raise ValueError(f"{field} must be a positive finite number")
    return result


def build_payload(rates: Any, now_seconds: int | None = None) -> dict[str, Any]:
    """Convert MT5 numpy records to the strict bridge JSON envelope."""
    rows: list[dict[str, Any]] = []
    for rate in rates:
        timestamp = int(rate["time"])
        if timestamp <= 0 or timestamp % INTERVAL_SECONDS != 0:
            raise ValueError("MT5 bar time must align to a UTC 15 minute bucket")
        if now_seconds is not None and timestamp > now_seconds + 60:
            raise ValueError("MT5 bar time is too far in the future")
        row = {
            "time_seconds": timestamp,
            "open": positive_number(rate["open"], "open"),
            "high": positive_number(rate["high"], "high"),
            "low": positive_number(rate["low"], "low"),
            "close": positive_number(rate["close"], "close"),
            "complete": True,
            "symbol": SYMBOL,
            "timeframe": TIMEFRAME,
        }
        if row["high"] < max(row["open"], row["close"]):
            raise ValueError("MT5 bar high is below open/close")
        if row["low"] > min(row["open"], row["close"]):
            raise ValueError("MT5 bar low is above open/close")
        rows.append(row)

    rows.sort(key=lambda item: item["time_seconds"])
    if not rows:
        raise ValueError("MT5 returned no closed GOLD bars")
    if any(current["time_seconds"] <= previous["time_seconds"] for previous, current in zip(rows, rows[1:])):
        raise ValueError("MT5 bars must be unique and strictly ascending")
    return {
        "source": SOURCE,
        "version": VERSION,
        "symbol": SYMBOL,
        "timeframe": TIMEFRAME,
        "candles": rows,
    }


def read_closed_rates(mt5: Any, count: int) -> Any:
    if count < 1 or count > DEFAULT_BAR_COUNT:
        raise ValueError(f"bar count must be between 1 and {DEFAULT_BAR_COUNT}")
    if not mt5.symbol_select(SYMBOL, True):
        raise RuntimeError(f"MT5 symbol_select failed for {SYMBOL}: {mt5.last_error()}")
    # MT5 position 0 is the current/incomplete bar. Start at 1 by design.
    rates = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_M15, 1, count)
    if rates is None:
        raise RuntimeError(f"MT5 copy_rates_from_pos failed: {mt5.last_error()}")
    return rates


def post_payload(endpoint: str, secret: str, payload: dict[str, Any], timeout: int = 20) -> str:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "content-length": str(len(body)),
            "x-xm-bridge-secret": secret,
            "user-agent": "xm-mt5-gold-bridge/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_body = response.read().decode("utf-8")
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"bridge endpoint HTTP {response.status}")
            return response_body[:500]
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:240]
        raise RuntimeError(f"bridge endpoint HTTP {error.code}: {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"bridge endpoint unavailable: {error.reason}") from error


def run_once(mt5: Any, endpoint: str, secret: str, count: int) -> None:
    payload = build_payload(read_closed_rates(mt5, count), int(time.time()))
    result = post_payload(endpoint, secret, payload)
    newest = payload["candles"][-1]["time_seconds"]
    print(f"sent {len(payload['candles'])} closed {SYMBOL} {TIMEFRAME} bars; newest={newest}; response={result}", flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read-only XM MT5 GOLD M15 bridge")
    parser.add_argument("--once", action="store_true", help="send one batch and exit")
    parser.add_argument("--bars", type=int, default=int(os.getenv("XM_MT5_BARS", str(DEFAULT_BAR_COUNT))))
    parser.add_argument("--poll-seconds", type=int, default=int(os.getenv("XM_MT5_POLL_SECONDS", str(DEFAULT_POLL_SECONDS))))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    endpoint = os.getenv("XM_BRIDGE_ENDPOINT", "").strip()
    secret = os.getenv("XM_BRIDGE_SECRET", "").strip()
    if not endpoint or not secret:
        print("XM_BRIDGE_ENDPOINT and XM_BRIDGE_SECRET are required", file=sys.stderr)
        return 2
    if args.poll_seconds < 15:
        print("--poll-seconds must be at least 15", file=sys.stderr)
        return 2

    try:
        import MetaTrader5 as mt5
    except ImportError:
        print("MetaTrader5 package is required on the MT5 PC: python -m pip install MetaTrader5", file=sys.stderr)
        return 2

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)
    if not mt5.initialize():
        print(f"MT5 initialize failed: {mt5.last_error()}", file=sys.stderr)
        return 1

    try:
        while not _STOP:
            try:
                run_once(mt5, endpoint, secret, args.bars)
            except Exception as error:  # keep bridge alive; never hide a failed send
                print(f"bridge cycle failed: {error}", file=sys.stderr, flush=True)
                if args.once:
                    return 1
            if args.once:
                return 0
            time.sleep(args.poll_seconds)
    finally:
        mt5.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import unittest

from xm_mt5_bridge import build_payload, read_closed_rates


class FakeMt5:
    TIMEFRAME_M15 = "TIMEFRAME_M15"

    def __init__(self):
        self.calls = []

    def symbol_select(self, symbol, enabled):
        self.calls.append(("symbol_select", symbol, enabled))
        return True

    def copy_rates_from_pos(self, symbol, timeframe, start_pos, count):
        self.calls.append(("copy_rates_from_pos", symbol, timeframe, start_pos, count))
        return [{
            "time": 1767344400,
            "open": 4600.0,
            "high": 4608.0,
            "low": 4598.0,
            "close": 4605.0,
        }]

    def last_error(self):
        return (0, "ok")


class XmBridgeTests(unittest.TestCase):
    def test_read_requests_position_one_not_forming_bar(self):
        mt5 = FakeMt5()
        rows = read_closed_rates(mt5, 600)
        self.assertEqual(len(rows), 1)
        self.assertIn(("symbol_select", "GOLD", True), mt5.calls)
        self.assertIn(("copy_rates_from_pos", "GOLD", "TIMEFRAME_M15", 1, 600), mt5.calls)

    def test_build_payload_is_source_explicit_and_sorted(self):
        payload = build_payload([
            {"time": 1767345300, "open": 4605, "high": 4612, "low": 4602, "close": 4610},
            {"time": 1767344400, "open": 4600, "high": 4608, "low": 4598, "close": 4605},
        ], now_seconds=1767346200)
        self.assertEqual(payload["source"], "xm-mt5")
        self.assertEqual(payload["symbol"], "GOLD")
        self.assertEqual(payload["timeframe"], "15m")
        self.assertEqual([candle["time_seconds"] for candle in payload["candles"]], [1767344400, 1767345300])
        self.assertTrue(all(candle["complete"] for candle in payload["candles"]))

    def test_build_payload_rejects_bad_timestamp_ohlc_and_duplicates(self):
        base = {"time": 1767344400, "open": 4600, "high": 4608, "low": 4598, "close": 4605}
        with self.assertRaisesRegex(ValueError, "align"):
            build_payload([{**base, "time": 1767344460}], now_seconds=1767346200)
        with self.assertRaisesRegex(ValueError, "high"):
            build_payload([{**base, "high": 4599}], now_seconds=1767346200)
        with self.assertRaisesRegex(ValueError, "unique"):
            build_payload([base, base], now_seconds=1767346200)


if __name__ == "__main__":
    unittest.main()

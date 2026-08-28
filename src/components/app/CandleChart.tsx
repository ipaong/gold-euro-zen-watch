import { useState } from "react";
import { Clock, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

import { fmtDate, fmtDateTime, fmtPrice, fmtTime } from "@/lib/format";
import {
  actualZoomLevels,
  DEFAULT_ACTUAL_ZOOM_LIMIT,
  resolveActualZoomLimit,
  zoomedHistoryLimit,
} from "@/lib/chart-zoom";
import type { Candle } from "@/lib/types";

function timeframeMs(tf: string): number {
  if (tf.endsWith("m")) return parseInt(tf, 10) * 60 * 1000;
  if (tf.endsWith("h")) return parseInt(tf, 10) * 60 * 60 * 1000;
  if (tf.endsWith("d")) return parseInt(tf, 10) * 24 * 60 * 60 * 1000;
  return 15 * 60 * 1000;
}

/**
 * Deliberately simple SVG chart: history candles on the left, and a wide
 * dedicated zone on the right for forecast/actual candles. Reveal zoom keeps
 * the five-candle scoring window readable without discarding the full view.
 */
export function CandleChart({
  history,
  forecast,
  support,
  resistance,
  actual,
  symbol = "market",
  timeframe = "selected timeframe",
  visibleHistory = 22,
  asOf,
  isTimeMachine = false,
  forecastMuted = false,
}: {
  history: Candle[];
  forecast: Candle[];
  support?: number | undefined;
  resistance?: number | undefined;
  actual?: Candle[] | null;
  symbol?: string;
  timeframe?: string;
  visibleHistory?: number;
  /** Analysis timestamp (UTC ms). When provided with isTimeMachine, a banner is shown. */
  asOf?: number;
  isTimeMachine?: boolean;
  /** A WAIT gate keeps the heuristic path visible for audit, but removes directional colouring. */
  forecastMuted?: boolean;
}) {
  const [requestedActualLimit, setRequestedActualLimit] = useState<number | null>(
    DEFAULT_ACTUAL_ZOOM_LIMIT,
  );
  const actualCount = actual?.length ?? 0;
  const zoomLevels = actualZoomLevels(actualCount);
  const actualShown = resolveActualZoomLimit(actualCount, requestedActualLimit ?? actualCount);
  const zoomLevelIndex = zoomLevels.indexOf(actualShown);
  const historyLimit = zoomedHistoryLimit(visibleHistory, actualShown, actualCount);
  const displayedActual = actual?.slice(0, actualShown) ?? null;
  const hist = history.slice(-historyLimit);
  const hasActual = actualShown > 0;
  const futureCount = Math.max(forecast.length, actualShown);
  const all = [...hist, ...forecast, ...(displayedActual ?? [])];
  if (!all.length) return null;

  const totalCandles = hist.length + futureCount;
  const padL = 6;
  const padR = 44;
  const padTop = 26;
  const padBottom = 18;
  const W = Math.max(360, Math.min(680, totalCandles * 8 + padL + padR));
  const H = 256;

  const highs = all.map((c) => c.h);
  const lows = all.map((c) => c.l);
  if (support) lows.push(support);
  if (resistance) highs.push(resistance);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = max - min || 1;

  const innerW = W - padL - padR;
  // Proportional width between history and future zone:
  const futureRatio =
    futureCount <= 6 ? 0.45 : Math.min(0.82, Math.max(0.45, futureCount / totalCandles));
  const futureW = futureCount ? innerW * futureRatio : 0;
  const histW = innerW - futureW;
  const stepH = histW / Math.max(1, hist.length);
  const stepF = futureCount ? futureW / futureCount : 0;
  const bwH = Math.max(1.8, Math.min(6, stepH * 0.65));
  const bwF = Math.max(1.8, Math.min(6, stepF * 0.65));
  // When showing both forecast and actual side-by-side in each slot
  const dualBw = Math.max(1.2, Math.min(3.5, stepF * 0.38));
  const dualOffset = stepF * 0.22;

  const splitX = padL + histW;
  const y = (v: number) => padTop + ((max - v) / span) * (H - padTop - padBottom);
  const xHist = (i: number) => padL + i * stepH + stepH / 2;
  const xFuture = (i: number) => splitX + i * stepF + stepF / 2;

  const lastHistClose = hist[hist.length - 1]?.c ?? 0;
  const lastCandle = hist[hist.length - 1];
  const lastHistX = hist.length ? xHist(hist.length - 1) : 0;
  const candleDuration = timeframeMs(timeframe);

  // Hide the price label when it would collide with a support/resistance label.
  const labelCrowded =
    (support !== undefined && Math.abs(y(lastHistClose) - y(support)) < 9) ||
    (resistance !== undefined && Math.abs(y(lastHistClose) - y(resistance)) < 9);

  // Determine if candles span more than 1 calendar day (Asia/Bangkok) for date display.
  const spansMultipleDays =
    all.length >= 2 &&
    new Date(all[0]!.t).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) !==
      new Date(all[all.length - 1]!.t).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });

  const formatAxisLabel = (ms: number) => {
    if (spansMultipleDays) {
      return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
      }).format(new Date(ms));
    }
    return fmtTime(ms);
  };

  // Build a forecast window label, e.g. "คาดการณ์ 06:15–07:15"
  const forecastWindowLabel = forecast.length
    ? `คาดการณ์ ${fmtTime(forecast[0]!.t)}–${fmtTime(forecast[forecast.length - 1]!.t)}`
    : "";

  const renderCandle = (
    c: Candle,
    cx: number,
    bw: number,
    dashed: boolean,
    isCurrent: boolean,
    key: string,
  ) => {
    const up = c.c >= c.o;
    const top = y(Math.max(c.o, c.c));
    const bottom = y(Math.min(c.o, c.c));
    const colour =
      dashed && forecastMuted
        ? "fill-muted-foreground stroke-muted-foreground"
        : up
          ? "fill-bull stroke-bull"
          : "fill-bear stroke-bear";
    return (
      <g key={key} className={colour} opacity={dashed ? 0.9 : 1}>
        <line
          x1={cx}
          x2={cx}
          y1={y(c.h)}
          y2={y(c.l)}
          strokeWidth={dashed ? 1.2 : 1.4}
          strokeDasharray={dashed ? "3 2" : undefined}
        />
        <rect
          x={cx - bw / 2}
          y={top}
          width={bw}
          height={Math.max(dashed ? 2.5 : 2, bottom - top)}
          strokeWidth={dashed ? 1.2 : 1.4}
          fillOpacity={dashed ? 0.35 : 1}
        />
        {isCurrent ? (
          <rect
            x={cx - bw / 2 - 2}
            y={y(c.h) - 2}
            width={bw + 4}
            height={Math.max(6, y(c.l) - y(c.h) + 4)}
            className="fill-none stroke-foreground/45"
            strokeWidth="0.8"
            rx="2"
          />
        ) : null}
      </g>
    );
  };

  return (
    <figure className="w-full">
      {isTimeMachine && asOf ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-gold/40 bg-accent/60 px-3 py-2">
          <span className="text-[11px] font-semibold text-gold">⏳ กำลังจำลอง</span>
          <span className="text-[11px] font-medium">ณ {fmtDateTime(asOf)} (Asia/Bangkok)</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            ระบบเห็นข้อมูลถึงเวลานี้เท่านั้น
          </span>
        </div>
      ) : null}

      {/* Latest Candle Time Banner */}
      {lastCandle ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-gold/30 bg-gold/5 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Clock className="h-3.5 w-3.5 text-gold shrink-0" aria-hidden />
            <span>แท่งล่าสุด:</span>
            <span className="tabular text-gold font-bold">{fmtTime(lastCandle.t)}</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              (ปิดแท่ง {fmtTime(lastCandle.t + candleDuration)})
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{fmtDate(lastCandle.t)}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-foreground">
              {timeframe}
            </span>
          </div>
        </div>
      ) : null}

      {zoomLevels.length > 1 ? (
        <div
          className="mb-2 flex items-center justify-end gap-1.5 rounded-lg border border-border/70 bg-card px-2 py-1.5"
          aria-label="เครื่องมือซูมกราฟเฉลย"
        >
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="ซูมออกเพื่อแสดงแท่งจริงมากขึ้น"
            title="ซูมออก"
            disabled={zoomLevelIndex <= 0}
            onClick={() => {
              const nextIndex = Math.max(0, zoomLevelIndex - 1);
              setRequestedActualLimit(nextIndex === 0 ? null : zoomLevels[nextIndex]!);
            }}
          >
            <ZoomOut className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-28 text-center text-[11px] font-medium text-muted-foreground tabular">
            แสดงแท่งจริง {actualShown}/{actualCount}
          </span>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="ซูมเข้าเพื่อเน้นช่วงเฉลยแรก"
            title="ซูมเข้า"
            disabled={zoomLevelIndex < 0 || zoomLevelIndex >= zoomLevels.length - 1}
            onClick={() => {
              const nextIndex = Math.min(zoomLevels.length - 1, zoomLevelIndex + 1);
              setRequestedActualLimit(zoomLevels[nextIndex]!);
            }}
          >
            <ZoomIn className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="ml-1 inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="รีเซ็ตซูมเพื่อแสดงแท่งจริงทั้งหมด"
            title="แสดงทั้งหมด"
            disabled={actualShown >= actualCount}
            onClick={() => setRequestedActualLimit(null)}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            ทั้งหมด
          </button>
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`กราฟแท่งเทียน ${symbol} ${timeframe} ย้อนหลัง และช่วงพยากรณ์ด้านขวา`}
      >
        {/* forecast zone */}
        {futureCount ? (
          <>
            <rect
              x={splitX}
              y={padTop - 20}
              width={innerW - histW}
              height={H - padTop - padBottom + 20}
              className={hasActual || forecastMuted ? "fill-secondary/70" : "fill-accent/60"}
            />
            {/* Highlight the 5-candle forecast evaluation window with a gold accent if extended actuals */}
            {hasActual && displayedActual && displayedActual.length > 5 ? (
              <rect
                x={splitX}
                y={padTop - 20}
                width={Math.min(innerW - histW, stepF * 5)}
                height={H - padTop - padBottom + 20}
                className="fill-gold/10 stroke-gold/30"
                strokeWidth="0.75"
                strokeDasharray="3 2"
              />
            ) : null}
            <text
              x={splitX + 4}
              y={padTop - 8}
              className="fill-accent-foreground text-[9px] font-semibold"
            >
              {forecastMuted
                ? hasActual
                  ? `╌ Forecast เพื่อ audit · █ แท่งจริง ${actualShown}/${actualCount} แท่ง · Gate = รอ`
                  : "╌ เส้นทางจำลองเท่านั้น · Final Signal = รอ"
                : hasActual
                  ? displayedActual && displayedActual.length > 5
                    ? `╌ 5 แท่งคาดการณ์ · █ แท่งจริง ${actualShown}/${actualCount} แท่ง`
                    : "╌ คาดการณ์ · █ แท่งจริง"
                  : forecastWindowLabel || `${forecast.length} แท่งพยากรณ์`}
            </text>
          </>
        ) : null}

        <text x={padL} y={padTop - 8} className="fill-muted-foreground text-[9px]">
          ราคาย้อนหลัง
        </text>

        {resistance ? (
          <g>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(resistance)}
              y2={y(resistance)}
              className="stroke-bear/60"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <text x={W - padR + 4} y={y(resistance) + 3} className="fill-bear text-[8px]">
              {fmtPrice(resistance)}
            </text>
          </g>
        ) : null}
        {support ? (
          <g>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(support)}
              y2={y(support)}
              className="stroke-bull/60"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <text x={W - padR + 4} y={y(support) + 3} className="fill-bull text-[8px]">
              {fmtPrice(support)}
            </text>
          </g>
        ) : null}

        <line
          x1={padL}
          x2={W - padR}
          y1={y(lastHistClose)}
          y2={y(lastHistClose)}
          className="stroke-foreground/20"
          strokeWidth="0.75"
        />

        {/* History candles */}
        {hist.map((c, i) =>
          renderCandle(c, xHist(i), bwH, false, i === hist.length - 1, `h-${c.t}-${i}`),
        )}

        {/* Future candles: if actual provided, show forecast (left, dashed) and actual (right, solid) */}
        {Array.from({ length: futureCount }).map((_, i) => {
          const cx = xFuture(i);
          const fc = forecast[i];
          const ac = displayedActual?.[i];

          if (hasActual && fc && ac) {
            return (
              <g key={`future-pair-${i}`}>
                {renderCandle(fc, cx - dualOffset, dualBw, true, false, `fc-${fc.t}-${i}`)}
                {renderCandle(ac, cx + dualOffset, dualBw, false, false, `ac-${ac.t}-${i}`)}
              </g>
            );
          }
          if (hasActual && ac && !fc) {
            return renderCandle(ac, cx, bwF, false, false, `ac-only-${ac.t}-${i}`);
          }
          if (fc) {
            return renderCandle(fc, cx, bwF, true, false, `fc-only-${fc.t}-${i}`);
          }
          return null;
        })}

        {/* "from here it is a forecast" divider */}
        {futureCount ? (
          <>
            <line
              x1={splitX}
              x2={splitX}
              y1={padTop - 20}
              y2={H - padBottom}
              className="stroke-gold"
              strokeWidth="1.25"
              strokeDasharray="5 3"
            />
            <circle cx={splitX} cy={padTop - 20} r="2.2" className="fill-gold" />
          </>
        ) : null}

        {/* Latest candle time pin/marker on the bottom axis */}
        {lastCandle ? (
          <g>
            <line
              x1={lastHistX}
              x2={lastHistX}
              y1={H - padBottom}
              y2={H - padBottom + 4}
              className="stroke-gold"
              strokeWidth="1.5"
            />
            <rect
              x={Math.max(padL, Math.min(W - padR - 38, lastHistX - 19))}
              y={H - padBottom + 4}
              width={38}
              height={14}
              rx="3"
              className="fill-card stroke-gold/70"
              strokeWidth="1"
            />
            <text
              x={Math.max(padL + 19, Math.min(W - padR - 19, lastHistX))}
              y={H - padBottom + 14}
              textAnchor="middle"
              className="fill-gold text-[8.5px] font-bold tabular"
            >
              {fmtTime(lastCandle.t)}
            </text>
          </g>
        ) : null}

        {labelCrowded ? null : (
          <text
            x={W - padR + 4}
            y={y(lastHistClose) + 3}
            className="fill-muted-foreground text-[8px]"
          >
            {fmtPrice(lastHistClose)}
          </text>
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
        <span className="shrink-0">{hist.length ? formatAxisLabel(hist[0]!.t) : ""}</span>
        {hasActual && displayedActual && displayedActual.length > 5 ? (
          <span className="font-semibold text-bull tabular">
            แท่งจริงล่าสุดในมุมมอง: {formatAxisLabel(displayedActual[actualShown - 1]!.t)} (
            {actualShown}/{actualCount} แท่ง)
          </span>
        ) : lastCandle ? (
          <span className="font-semibold text-gold tabular">
            แท่งล่าสุด: {fmtTime(lastCandle.t)}
          </span>
        ) : null}
        <span className="text-right">
          {forecastMuted
            ? hasActual
              ? "เส้นประสีเทา=Forecast เพื่อ audit · แท่งทึบ=ผลจริง · Final Signal เป็น WAIT"
              : "เส้นประสีเทาเป็น Forecast เพื่อการตรวจสอบ ไม่ใช่สัญญาณ BUY/SELL"
            : hasActual
              ? displayedActual && displayedActual.length > 5
                ? `กำลังดู ${actualShown} จาก ${actualCount} แท่งจริง`
                : "ซ้าย(ประ)=คาดการณ์ · ขวา(ทึบ)=จริง"
              : `พยากรณ์ ${forecast.length} แท่งถัดไป`}
          {!hasActual && forecast.length
            ? ` (ถึง ${formatAxisLabel(forecast[forecast.length - 1]!.t)})`
            : ""}
        </span>
      </figcaption>
    </figure>
  );
}

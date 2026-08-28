import { fmtPrice, fmtTime, fmtDateTime } from "@/lib/format";
import type { Candle } from "@/lib/types";

/**
 * Deliberately simple SVG chart: history candles on the left, and a wide
 * dedicated zone on the right for the 5 forecast candles so their bodies and
 * wicks stay readable on a phone. No zoom, no pan, no drawing tools.
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
}: {
  history: Candle[];
  forecast: Candle[];
  support?: number;
  resistance?: number;
  actual?: Candle[] | null;
  symbol?: string;
  timeframe?: string;
  visibleHistory?: number;
  /** Analysis timestamp (UTC ms). When provided with isTimeMachine, a banner is shown. */
  asOf?: number;
  isTimeMachine?: boolean;
}) {
  const hist = history.slice(-visibleHistory);
  const hasActual = !!(actual && actual.length);
  const futureCount = Math.max(forecast.length, actual?.length ?? 0);
  const all = [...hist, ...forecast, ...(actual ?? [])];
  if (!all.length) return null;

  const W = 360;
  const H = 250;
  const padL = 6;
  const padR = 44;
  const padTop = 26;
  const padBottom = 14;

  const highs = all.map((c) => c.h);
  const lows = all.map((c) => c.l);
  if (support) lows.push(support);
  if (resistance) highs.push(resistance);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = max - min || 1;

  const innerW = W - padL - padR;
  // Give the forecast zone ~45% of the plot so 5 candles read clearly.
  const futureW = futureCount ? innerW * 0.45 : 0;
  const histW = innerW - futureW;
  const stepH = histW / Math.max(1, hist.length);
  const stepF = futureCount ? futureW / futureCount : 0;
  const bwH = Math.max(2.5, stepH * 0.6);
  const bwF = Math.max(6, stepF * 0.56);
  // When showing both forecast and actual side-by-side in each slot
  const dualBw = Math.max(4, stepF * 0.38);
  const dualOffset = stepF * 0.22;

  const splitX = padL + histW;
  const y = (v: number) => padTop + ((max - v) / span) * (H - padTop - padBottom);
  const xHist = (i: number) => padL + i * stepH + stepH / 2;
  const xFuture = (i: number) => splitX + i * stepF + stepF / 2;

  const lastHistClose = hist[hist.length - 1]?.c ?? 0;
  // Hide the price label when it would collide with a support/resistance label.
  const labelCrowded =
    (support !== undefined && Math.abs(y(lastHistClose) - y(support)) < 9) ||
    (resistance !== undefined && Math.abs(y(lastHistClose) - y(resistance)) < 9);

  // Determine if candles span more than 1 calendar day (Asia/Bangkok) for date display.
  const spansMultipleDays = all.length >= 2 &&
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
  const forecastWindowLabel =
    forecast.length
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
    const colour = up ? "fill-bull stroke-bull" : "fill-bear stroke-bear";
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
          <span className="text-[11px] font-medium">
            ณ {fmtDateTime(asOf)} (Asia/Bangkok)
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            ระบบเห็นข้อมูลถึงเวลานี้เท่านั้น
          </span>
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
              className={hasActual ? "fill-secondary/80" : "fill-accent/60"}
            />
            <text
              x={splitX + 4}
              y={padTop - 8}
              className="fill-accent-foreground text-[9px] font-semibold"
            >
              {hasActual ? "╌ คาดการณ์ · █ แท่งจริง" : forecastWindowLabel || `${forecast.length} แท่งพยากรณ์`}
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
          const ac = actual?.[i];

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
      <figcaption className="mt-1 flex items-start justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="shrink-0">{hist.length ? formatAxisLabel(hist[0]!.t) : ""}</span>
        <span className="text-center text-[10px]">
          {symbol} · {timeframe}
        </span>
        <span className="text-right">
          {hasActual
            ? "ซ้าย(ประ)=คาดการณ์ · ขวา(ทึบ)=จริง"
            : `เส้นประด้านขวา = ${forecast.length} แท่งที่ระบบคาด`}
          {forecast.length ? ` · ถึง ${formatAxisLabel(forecast[forecast.length - 1]!.t)}` : ""}
        </span>
      </figcaption>
    </figure>
  );
}


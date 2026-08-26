import { fmtPrice, fmtTime } from "@/lib/format";
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
  visibleHistory = 22,
}: {
  history: Candle[];
  forecast: Candle[];
  support?: number;
  resistance?: number;
  actual?: Candle[] | null;
  visibleHistory?: number;
}) {
  const hist = history.slice(-visibleHistory);
  const future = actual && actual.length ? actual : forecast;
  const isActual = !!(actual && actual.length);
  const all = [...hist, ...future];
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
  const futureW = future.length ? innerW * 0.45 : 0;
  const histW = innerW - futureW;
  const stepH = histW / Math.max(1, hist.length);
  const stepF = future.length ? futureW / future.length : 0;
  const bwH = Math.max(2.5, stepH * 0.6);
  const bwF = Math.max(6, stepF * 0.56);

  const splitX = padL + histW;
  const y = (v: number) => padTop + ((max - v) / span) * (H - padTop - padBottom);
  const x = (i: number) =>
    i < hist.length
      ? padL + i * stepH + stepH / 2
      : splitX + (i - hist.length) * stepF + stepF / 2;

  const lastHistClose = hist[hist.length - 1]?.c ?? 0;
  // Hide the price label when it would collide with a support/resistance label.
  const labelCrowded =
    (support !== undefined && Math.abs(y(lastHistClose) - y(support)) < 9) ||
    (resistance !== undefined && Math.abs(y(lastHistClose) - y(resistance)) < 9);

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="กราฟแท่งเทียน XAUEUR ย้อนหลัง และช่วงพยากรณ์ 5 แท่งด้านขวา"
      >
        {/* forecast zone */}
        {future.length ? (
          <>
            <rect
              x={splitX}
              y={padTop - 20}
              width={innerW - histW}
              height={H - padTop - padBottom + 20}
              className={isActual ? "fill-secondary/70" : "fill-accent/60"}
            />
            <text x={splitX + 4} y={padTop - 8} className="fill-accent-foreground text-[9px] font-semibold">
              {isActual ? "แท่งจริงที่เกิดขึ้น" : `${future.length} แท่งพยากรณ์`}
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

        {all.map((c, i) => {
          const isFuture = i >= hist.length;
          const isCurrent = i === hist.length - 1;
          const dashed = isFuture && !isActual;
          const up = c.c >= c.o;
          const cx = x(i);
          const bw = isFuture ? bwF : bwH;
          const top = y(Math.max(c.o, c.c));
          const bottom = y(Math.min(c.o, c.c));
          const colour = up ? "fill-bull stroke-bull" : "fill-bear stroke-bear";
          return (
            <g key={`${c.t}-${i}`} className={colour} opacity={dashed ? 0.95 : 1}>
              <line
                x1={cx}
                x2={cx}
                y1={y(c.h)}
                y2={y(c.l)}
                strokeWidth={isFuture ? 1.4 : 1}
                strokeDasharray={dashed ? "3 2" : undefined}
              />
              <rect
                x={cx - bw / 2}
                y={top}
                width={bw}
                height={Math.max(1.5, bottom - top)}
                strokeWidth={isFuture ? 1.4 : 1}
                fillOpacity={dashed ? 0.45 : 1}
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
        })}

        {/* "from here it is a forecast" divider */}
        {future.length ? (
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
        <span className="shrink-0">{hist.length ? fmtTime(hist[0]!.t) : ""}</span>
        <span className="text-right">
          {isActual
            ? "แท่งทึบด้านขวา = ราคาที่เกิดขึ้นจริง"
            : "เส้นประด้านขวา = 5 แท่งที่ระบบคาด"}
          {future.length ? ` · ถึง ${fmtTime(future[future.length - 1]!.t)}` : ""}
        </span>
      </figcaption>
    </figure>
  );
}

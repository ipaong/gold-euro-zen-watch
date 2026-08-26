import { fmtPrice, fmtTime } from "@/lib/format";
import type { Candle } from "@/lib/types";

/**
 * Deliberately simple SVG chart: history candles + dashed forecast candles.
 * Readability over trading-terminal features (no zoom, no drawing tools).
 */
export function CandleChart({
  history,
  forecast,
  support,
  resistance,
  actual,
  visibleHistory = 40,
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
  const all = [...hist, ...future];
  if (!all.length) return null;

  const W = 340;
  const H = 190;
  const padL = 4;
  const padR = 46;
  const padY = 12;

  const highs = all.map((c) => c.h);
  const lows = all.map((c) => c.l);
  if (support) lows.push(support);
  if (resistance) highs.push(resistance);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = max - min || 1;

  const innerW = W - padL - padR;
  const step = innerW / all.length;
  const bw = Math.max(2, step * 0.58);

  const y = (v: number) => padY + ((max - v) / span) * (H - padY * 2);
  const x = (i: number) => padL + i * step + step / 2;

  const forecastStartIndex = hist.length;
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
        aria-label="กราฟแท่งเทียน XAUEUR ย้อนหลังและช่วงพยากรณ์ 5 แท่ง"
      >
        {/* forecast zone */}
        <rect
          x={padL + forecastStartIndex * step}
          y={padY}
          width={innerW - forecastStartIndex * step}
          height={H - padY * 2}
          className="fill-accent/35"
        />
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

        {all.map((c, i) => {
          const isFuture = i >= forecastStartIndex;
          const up = c.c >= c.o;
          const cx = x(i);
          const top = y(Math.max(c.o, c.c));
          const bottom = y(Math.min(c.o, c.c));
          const colour = up ? "fill-bull stroke-bull" : "fill-bear stroke-bear";
          return (
            <g key={`${c.t}-${i}`} className={colour} opacity={isFuture ? 0.85 : 1}>
              <line
                x1={cx}
                x2={cx}
                y1={y(c.h)}
                y2={y(c.l)}
                strokeWidth="1"
                strokeDasharray={isFuture && !actual?.length ? "2 2" : undefined}
              />
              <rect
                x={cx - bw / 2}
                y={top}
                width={bw}
                height={Math.max(1, bottom - top)}
                strokeWidth="1"
                fillOpacity={isFuture && !actual?.length ? 0.25 : 1}
                strokeDasharray={isFuture && !actual?.length ? "2 2" : undefined}
              />
            </g>
          );
        })}

        <line
          x1={padL + forecastStartIndex * step}
          x2={padL + forecastStartIndex * step}
          y1={padY}
          y2={H - padY}
          className="stroke-foreground/40"
          strokeWidth="1"
        />
        <line
          x1={padL}
          x2={W - padR}
          y1={y(lastHistClose)}
          y2={y(lastHistClose)}
          className="stroke-foreground/25"
          strokeWidth="0.75"
        />
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
      <figcaption className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{hist.length ? fmtTime(hist[0]!.t) : ""}</span>
        <span>
          {actual?.length ? "แท่งจริงที่เกิดขึ้น" : "เส้นประ = 5 แท่งที่พยากรณ์"} ·{" "}
          {future.length ? fmtTime(future[future.length - 1]!.t) : ""}
        </span>
      </figcaption>
    </figure>
  );
}

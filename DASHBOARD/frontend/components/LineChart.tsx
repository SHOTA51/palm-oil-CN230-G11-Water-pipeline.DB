"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { fmt, fmtTick, niceTicks } from "@/lib/format";
import { useWidth } from "./useWidth";

export interface Series {
  id: number | string;
  label: string;
  /** CSS color, normally a var(--series-n) token. */
  color: string;
  /** One value per entry of `years`; null = no data that year. */
  values: (number | null)[];
}

interface Props {
  years: number[];
  series: Series[];
  unit: string;
  selectedYear: number;
  onSelectYear?: (year: number) => void;
  height?: number;
  /** Wash under the line; only meaningful for a single series. */
  area?: boolean;
  ariaLabel: string;
}

const M = { top: 16, right: 16, bottom: 30, left: 64 };

export function LineChart({ years, series, unit, selectedYear, onSelectYear, height = 280, area = false, ariaLabel }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const innerH = height - M.top - M.bottom;

  const { ticks, yMax } = useMemo(() => {
    const max = Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v != null)));
    const t = niceTicks(max);
    return { ticks: t, yMax: t[t.length - 1] || 1 };
  }, [series]);

  const y = (v: number) => M.top + innerH - (v / yMax) * innerH;

  // Direct end labels: only where they don't collide (otherwise the legend carries identity).
  const endLabels = useMemo(() => {
    if (series.length < 2 || series.length > 4) return [];
    const placed: { id: Series["id"]; label: string; y: number }[] = [];
    const candidates = series
      .map((s) => {
        const last = [...s.values].reverse().find((v) => v != null);
        return last == null ? null : { id: s.id, label: s.label, y: y(last) };
      })
      .filter((c): c is NonNullable<typeof c> => c != null)
      .sort((a, b) => a.y - b.y);
    for (const c of candidates) {
      if (placed.some((p) => Math.abs(p.y - c.y) < 16)) continue;
      placed.push(c);
    }
    return placed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, yMax, height]);
  const wantRoom = endLabels.length ? Math.min(132, Math.max(...endLabels.map((l) => l.label.length)) * 7 + 14) : 0;
  // On narrow screens the legend carries identity instead.
  const labelRoom = wantRoom > (width - M.left - M.right) * 0.3 ? 0 : wantRoom;
  const innerW = width - M.left - M.right - labelRoom;

  const n = years.length;
  const x = (i: number) => M.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);

  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = "";
        let areaD = "";
        let run: [number, number][] = [];
        const flush = () => {
          if (!run.length) return;
          d += run.map(([px, py], k) => `${k ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
          if (area) {
            const base = (M.top + innerH).toFixed(1);
            areaD += `M${run[0][0].toFixed(1)},${base}` + run.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join("") + `L${run[run.length - 1][0].toFixed(1)},${base}Z`;
          }
          run = [];
        };
        s.values.forEach((v, i) => (v == null ? flush() : run.push([x(i), y(v)])));
        flush();
        return { id: s.id, color: s.color, d, areaD };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, width, height, yMax, area, labelRoom],
  );

  const xTickEvery = innerW < 420 ? 10 : 5;
  const selIdx = years.indexOf(selectedYear);
  const activeIdx = hover ?? (selIdx >= 0 ? selIdx : null);


  const indexFromPointer = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - M.left) / innerW) * (n - 1));
    return Math.min(n - 1, Math.max(0, i));
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!onSelectYear || selIdx < 0) return;
    const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = Math.min(n - 1, Math.max(0, selIdx + step));
    onSelectYear(years[next]);
  };

  const tipLeft = hover == null ? 0 : x(hover);
  const tipOnLeft = tipLeft > width * 0.6;

  return (
    <div className="chart" ref={wrapRef}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerMove={(e) => setHover(indexFromPointer(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onSelectYear?.(years[indexFromPointer(e)])}
        style={{ cursor: onSelectYear ? "pointer" : "default" }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} className={t === 0 ? "axis-base" : "grid"} />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tick">
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {years.map((yr, i) =>
          yr % xTickEvery === 0 ? (
            <text key={yr} x={x(i)} y={height - 8} textAnchor="middle" className="tick">
              {yr}
            </text>
          ) : null,
        )}

        {selIdx >= 0 && <line x1={x(selIdx)} x2={x(selIdx)} y1={M.top} y2={M.top + innerH} className="sel-line" />}

        {paths.map((p) => (
          <g key={p.id}>
            {area && p.areaD && <path d={p.areaD} fill={p.color} opacity={0.1} />}
            <path d={p.d} fill="none" stroke={p.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}

        {hover != null && hover !== selIdx && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} className="crosshair" />}

        {activeIdx != null &&
          series.map((s) => {
            const v = s.values[activeIdx];
            return v == null ? null : <circle key={s.id} cx={x(activeIdx)} cy={y(v)} r={4.5} fill={s.color} className="dot" />;
          })}

        {endLabels.map((l) => (
          <text key={l.id} x={M.left + innerW + 8} y={l.y} dy="0.32em" className="end-label" style={{ display: labelRoom ? undefined : "none" }}>
            {l.label}
          </text>
        ))}
      </svg>

      {hover != null && (
        <div
          className="tooltip"
          style={{ left: tipLeft, top: M.top, transform: tipOnLeft ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
          aria-hidden
        >
          <div className="tooltip-title">ปีเพาะปลูก {years[hover]}</div>
          {series.map((s) => (
            <div key={s.id} className="tooltip-row">
              <span className="line-key" style={{ background: s.color }} />
              <strong>{fmt(s.values[hover])}</strong>
              <span className="muted">{series.length > 1 ? s.label : unit}</span>
            </div>
          ))}
          {series.length > 1 && <div className="tooltip-unit">หน่วย: {unit}</div>}
        </div>
      )}
    </div>
  );
}

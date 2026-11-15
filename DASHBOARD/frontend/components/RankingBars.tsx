"use client";

import { change, fmt, fmtCompact, fmtPct } from "@/lib/format";
import type { RankingRow } from "@/lib/types";

interface Props {
  rows: RankingRow[];
  unit: string;
  isRatio: boolean;
  selectedId: number;
  onSelect: (locationId: number) => void;
  showRegion: boolean;
}

export function RankingBars({ rows, unit, isRatio, selectedId, onSelect, showRegion }: Props) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const hasSelection = rows.some((r) => r.location_id === selectedId);

  return (
    <div className="rank">
      <div className="rank-row rank-head" aria-hidden>
        <span>#</span>
        <span>พื้นที่</span>
        <span className="rank-bar-col" aria-hidden />
        <span className="num">{unit}</span>
        <span className="num">{isRatio ? "เทียบปีก่อน" : "สัดส่วนประเทศ"}</span>
        {!isRatio && <span className="num hide-sm">เทียบปีก่อน</span>}
      </div>
      {rows.map((r) => {
        const yoy = change(r.value, r.prev_value);
        const selected = r.location_id === selectedId;
        return (
          <button
            key={r.location_id}
            type="button"
            className={`rank-row${selected ? " is-selected" : ""}${hasSelection && !selected ? " is-dim" : ""}${isRatio ? " no-share" : ""}`}
            onClick={() => onSelect(r.location_id)}
            aria-label={`อันดับ ${r.rank_no} ${r.name_th} ${fmt(r.value)} ${unit}`}
            aria-pressed={selected}
          >
            <span className="rank-no">{r.rank_no}</span>
            <span className="rank-name">
              {r.name_th}
              {showRegion && r.region_th && <small>{r.region_th}</small>}
            </span>
            <span className="rank-bar-col" aria-hidden>
              <span className="rank-bar" style={{ width: `${Math.max(0.4, (r.value / max) * 100)}%` }} />
            </span>
            <span className="num strong">{fmtCompact(r.value)}</span>
            {isRatio ? (
              <span className="num"><Delta value={yoy} /></span>
            ) : (
              <>
                <span className="num">{fmtPct(r.national_share)}</span>
                <span className="num hide-sm"><Delta value={yoy} /></span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="muted">–</span>;
  const dir = value > 0.0005 ? "up" : value < -0.0005 ? "down" : "flat";
  return (
    <span className={`delta delta-${dir}`}>
      <span aria-hidden>{dir === "up" ? "▲" : dir === "down" ? "▼" : "●"}</span> {fmtPct(value, true)}
    </span>
  );
}

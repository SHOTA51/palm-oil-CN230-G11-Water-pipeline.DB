"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { change, fmt, fmtCompact, ITEM_SHORT, RATIO_ITEM_ID } from "@/lib/format";
import type { Location, Meta, RankingRow, RegionRow, TrendRow, WithSql } from "@/lib/types";
import { AskPanel } from "./AskPanel";
import { LineChart, type Series } from "./LineChart";
import { Delta, RankingBars } from "./RankingBars";
import { SiteNav } from "./SiteNav";
import { SourceCard } from "./SourceCard";
import { SOURCE } from "@/lib/source";
import Link from "next/link";

const LEVEL_TH: Record<Location["level"], string> = { country: "ประเทศ", region: "ภาค", province: "จังหวัด" };
const TABLE_TH: Record<string, string> = {
  locations: "พื้นที่ (ประเทศ › ภาค › จังหวัด)",
  commodities: "ชนิดสินค้า",
  units: "หน่วยวัด",
  items: "ตัวชี้วัด",
  data_releases: "วันที่เผยแพร่ข้อมูล",
  production_stats: "ตารางข้อเท็จจริง: ค่าสถิติรายปี",
};
const TOP_N = 15;

/** Fetches whenever `deps` change; keeps the previous data while the next one loads. */
function useData<T>(load: (() => Promise<T>) | null, deps: unknown[]) {
  const [nonce, setNonce] = useState(0);
  const key = load ? JSON.stringify([...deps, nonce]) : null;
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({ key: null, data: null, error: null });
  useEffect(() => {
    if (!load || key === null) return;
    let alive = true;
    load()
      .then((data) => alive && setState({ key, data, error: null }))
      .catch((e: unknown) => alive && setState((s) => ({ key, data: s.data, error: e instanceof Error ? e.message : String(e) })));
    return () => {
      alive = false;
    };
    // `key` captures every dependency; `load` is a fresh closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { data: state.data, loading: key !== null && state.key !== key, error: state.key === key ? state.error : null, retry };
}

export function Dashboard() {
  const meta = useData<Meta>(api.meta, []);
  const m = meta.data;

  const [locationId, setLocationId] = useState(1);
  const [year, setYear] = useState<number | null>(null);
  const [itemId, setItemId] = useState(3);
  const [rankLevel, setRankLevel] = useState<"province" | "region">("province");
  const [rankRegion, setRankRegion] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const selYear = year ?? m?.lastYear ?? 2567;
  const ready = !!m;

  const trend = useData<WithSql<TrendRow>>(ready ? () => api.trend(locationId) : null, [locationId]);
  const ranking = useData<WithSql<RankingRow>>(ready ? () => api.ranking(selYear, itemId, rankLevel, rankLevel === "province" ? rankRegion : null) : null, [
    selYear,
    itemId,
    rankLevel,
    rankRegion,
  ]);
  const regionData = useData<WithSql<RegionRow>>(ready ? () => api.regions(itemId) : null, [itemId]);

  const locById = useMemo(() => new Map((m?.locations ?? []).map((l) => [l.location_id, l])), [m]);
  const regionsList = useMemo(() => (m?.locations ?? []).filter((l) => l.level === "region"), [m]);
  const regionColor = useMemo(() => new Map(regionsList.map((r, i) => [r.location_id, `var(--series-${i + 1})`])), [regionsList]);
  const years = useMemo(() => (m ? Array.from({ length: m.lastYear - m.firstYear + 1 }, (_, i) => m.firstYear + i) : []), [m]);

  if (meta.error && !m) return <Offline message={meta.error} onRetry={meta.retry} />;
  if (!m) return <Loading />;

  const location = locById.get(locationId)!;
  const item = ITEM_SHORT[itemId];
  const unit = item.unit;
  const isRatio = itemId === RATIO_ITEM_ID;

  const trendRows = trend.data?.rows ?? [];
  const byYear = new Map(trendRows.map((r) => [r.year, r]));
  const cur = byYear.get(selYear);
  const prev = byYear.get(selYear - 1);
  const firstDataYear = trendRows.find((r) => r[item.key] != null)?.year;

  const trendSeries: Series[] = [
    { id: itemId, label: item.label, color: "var(--series-1)", values: years.map((y) => (byYear.get(y)?.[item.key] as number | null) ?? null) },
  ];

  const regionSeries: Series[] = regionsList.map((r) => {
    const map = new Map((regionData.data?.rows ?? []).filter((row) => row.location_id === r.location_id).map((row) => [row.year, row.value]));
    return { id: r.location_id, label: r.name_th, color: regionColor.get(r.location_id)!, values: years.map((y) => map.get(y) ?? null) };
  });

  const rankRows = ranking.data?.rows ?? [];
  const shownRows = showAll ? rankRows : rankRows.slice(0, TOP_N);
  const latestRelease = m.releases[m.releases.length - 1];
  const parent = location.parent_id ? locById.get(location.parent_id) : null;
  const provincesByRegion = regionsList.map((r) => ({
    region: r,
    provinces: m.locations.filter((l) => l.level === "province" && l.parent_id === r.location_id).sort((a, b) => a.name_th.localeCompare(b.name_th, "th")),
  }));

  const selectLocation = (id: number) => {
    setLocationId(id);
    const l = locById.get(id);
    if (l?.level === "region") {
      setRankLevel("province");
      setRankRegion(id);
    }
  };

  const yearIdx = years.indexOf(selYear);
  const anyError = trend.error || ranking.error || regionData.error;

  return (
    <div className="page">
      <SiteNav />
      <header className="top">
        <div>
          <p className="eyebrow">{m.commodity?.commodity_name ?? "ปาล์มน้ำมัน"} · ปีเพาะปลูก {m.firstYear}–{m.lastYear}</p>
          <h1>แดชบอร์ดปาล์มน้ำมันประเทศไทย</h1>
          <p className="lede">เนื้อที่ยืนต้น เนื้อที่ให้ผล ผลผลิต และผลผลิตต่อไร่ ระดับประเทศ ภาค และจังหวัด ดึงข้อมูลสดจากฐานข้อมูล MySQL</p>
        </div>
        <span className={`badge${anyError ? " badge-warn" : ""}`}>
          <span className="badge-dot" aria-hidden />
          {anyError ? "เชื่อมต่อฐานข้อมูลไม่สมบูรณ์" : "ข้อมูลสด · MySQL"}
        </span>
      </header>

      <AskPanel
        onOpen={(id, y) => {
          if (id) selectLocation(id);
          if (y && years.includes(y)) setYear(y);
          document.getElementById("filters")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <section className="filters" id="filters" aria-label="ตัวกรอง">
        <label className="field">
          <span>พื้นที่</span>
          <select value={locationId} onChange={(e) => selectLocation(Number(e.target.value))}>
            {m.locations
              .filter((l) => l.level === "country")
              .map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.name_th} (ทั้งประเทศ)
                </option>
              ))}
            <optgroup label="ภาค">
              {regionsList.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.name_th}
                </option>
              ))}
            </optgroup>
            {provincesByRegion.map(({ region, provinces }) => (
              <optgroup key={region.location_id} label={`จังหวัด · ${region.name_th}`}>
                {provinces.map((p) => (
                  <option key={p.location_id} value={p.location_id}>
                    {p.name_th}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="field">
          <span id="year-label">ปีเพาะปลูก (พ.ศ.)</span>
          <div className="stepper" role="group" aria-labelledby="year-label">
            <button type="button" onClick={() => setYear(years[yearIdx - 1])} disabled={yearIdx <= 0} aria-label="ปีก่อนหน้า">
              ‹
            </button>
            <select value={selYear} onChange={(e) => setYear(Number(e.target.value))} aria-labelledby="year-label">
              {[...years].reverse().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setYear(years[yearIdx + 1])} disabled={yearIdx >= years.length - 1} aria-label="ปีถัดไป">
              ›
            </button>
          </div>
        </div>

        <div className="field">
          <span id="item-label">ตัวชี้วัด</span>
          <div className="segmented" role="radiogroup" aria-labelledby="item-label">
            {m.items.map((it) => (
              <button
                key={it.item_id}
                type="button"
                role="radio"
                aria-checked={itemId === it.item_id}
                className={itemId === it.item_id ? "on" : ""}
                onClick={() => setItemId(it.item_id)}
                title={`${it.item_name} (${it.unit_name})`}
              >
                {ITEM_SHORT[it.item_id]?.label ?? it.item_name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="kpis" aria-label={`สรุป ${location.name_th} ปี ${selYear}`} style={{ opacity: trend.loading ? 0.6 : 1 }}>
        <div className="kpi-place">
          <p className="eyebrow">{LEVEL_TH[location.level]}{parent && parent.level === "region" ? ` · ${parent.name_th}` : ""}</p>
          <h2>{location.name_th}</h2>
          <p className="muted">
            ปีเพาะปลูก {selYear}
            {cur?.release_th ? ` · ข้อมูลเผยแพร่ ${cur.release_th}` : ""}
          </p>
        </div>
        {m.items.map((it) => {
          const meta2 = ITEM_SHORT[it.item_id];
          const v = (cur?.[meta2.key] as number | null | undefined) ?? null;
          const pv = (prev?.[meta2.key] as number | null | undefined) ?? null;
          return (
            <button
              key={it.item_id}
              type="button"
              className={`kpi${itemId === it.item_id ? " on" : ""}`}
              onClick={() => setItemId(it.item_id)}
              aria-pressed={itemId === it.item_id}
            >
              <span className="kpi-label">{meta2.label}</span>
              <span className="kpi-value">
                {v != null ? fmtCompact(v) : trend.data ? "ไม่มีข้อมูล" : "…"}
                {v != null && <small>{meta2.unit}</small>}
              </span>
              <span className="kpi-delta">
                <Delta value={change(v, pv)} /> <span className="muted">จากปี {selYear - 1}</span>
              </span>
            </button>
          );
        })}
      </section>

      <div className="cards">
        <Card
          className="span-2"
          title={`${item.label} · ${location.name_th}`}
          subtitle={`ปีเพาะปลูก ${m.firstYear}–${m.lastYear} · หน่วย ${unit} · คลิกที่กราฟเพื่อเลือกปี`}
          sql={trend.data?.sql}
          loading={trend.loading}
          error={trend.error}
          onRetry={trend.retry}
        >
          {firstDataYear && firstDataYear > m.firstYear && (
            <p className="note">จังหวัดนี้มีข้อมูลตั้งแต่ปี {firstDataYear}</p>
          )}
          <LineChart
            years={years}
            series={trendSeries}
            unit={unit}
            selectedYear={selYear}
            onSelectYear={setYear}
            area
            ariaLabel={`กราฟเส้น${item.label}ของ${location.name_th} ปี ${m.firstYear} ถึง ${m.lastYear}`}
          />
        </Card>

        <Card
          title={`อันดับ${rankLevel === "province" ? "จังหวัด" : "ภาค"} · ${item.label} ปี ${selYear}`}
          subtitle={
            isRatio
              ? "เรียงจากผลผลิตต่อไร่สูงสุด · คลิกแถวเพื่อดูรายละเอียดพื้นที่"
              : "สัดส่วนเทียบกับตัวเลขทั้งประเทศของปีเดียวกัน · คลิกแถวเพื่อดูรายละเอียดพื้นที่"
          }
          sql={ranking.data?.sql}
          loading={ranking.loading}
          error={ranking.error}
          onRetry={ranking.retry}
        >
          <div className="chips" role="group" aria-label="ระดับพื้นที่">
            <Chip on={rankLevel === "province"} onClick={() => setRankLevel("province")}>
              จังหวัด
            </Chip>
            <Chip on={rankLevel === "region"} onClick={() => setRankLevel("region")}>
              ภาค
            </Chip>
            {rankLevel === "province" && (
              <>
                <span className="chips-sep" aria-hidden />
                <Chip on={rankRegion === null} onClick={() => setRankRegion(null)}>
                  ทุกภาค
                </Chip>
                {regionsList.map((r) => (
                  <Chip key={r.location_id} on={rankRegion === r.location_id} onClick={() => setRankRegion(r.location_id)}>
                    {r.name_th.replace(/^ภาค/, "")}
                  </Chip>
                ))}
              </>
            )}
          </div>
          {rankRows.length === 0 && !ranking.loading ? (
            <p className="empty">ไม่มีข้อมูลสำหรับปี {selYear}</p>
          ) : (
            <RankingBars
              rows={shownRows}
              unit={unit}
              isRatio={isRatio}
              selectedId={locationId}
              onSelect={selectLocation}
              showRegion={rankLevel === "province" && rankRegion === null}
            />
          )}
          {rankRows.length > TOP_N && (
            <button type="button" className="link-btn" onClick={() => setShowAll((s) => !s)}>
              {showAll ? `แสดงเฉพาะ ${TOP_N} อันดับแรก` : `แสดงทั้งหมด ${rankRows.length} ${rankLevel === "province" ? "จังหวัด" : "ภาค"}`}
            </button>
          )}
        </Card>

        <Card
          title={`${item.label}รายภาค`}
          subtitle={`เปรียบเทียบ 4 ภาค ปี ${m.firstYear}–${m.lastYear} · หน่วย ${unit}`}
          sql={regionData.data?.sql}
          loading={regionData.loading}
          error={regionData.error}
          onRetry={regionData.retry}
        >
          <ul className="legend" aria-label="คำอธิบายสี">
            {regionSeries.map((s) => (
              <li key={s.id}>
                <span className="legend-line" style={{ background: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>
          <LineChart
            years={years}
            series={regionSeries}
            unit={unit}
            selectedYear={selYear}
            onSelectYear={setYear}
            height={300}
            ariaLabel={`กราฟเส้นเปรียบเทียบ${item.label}ของ 4 ภาค`}
          />
          {!isRatio && (
            <p className="note">ภาคใต้เป็นแหล่งผลิตหลัก ตัวเลขของภาคอื่นจึงอยู่ใกล้แกนล่าง ชี้ที่กราฟเพื่อดูค่าทุกภาค</p>
          )}
        </Card>

        <Card className="span-2" title="เกี่ยวกับฐานข้อมูล" subtitle={`ฐานข้อมูล plam-oil · Star schema (ตารางมิติ 5 ตาราง + ตารางข้อเท็จจริง 1 ตาราง)`} sql={m.sql}>
          <div className="about">
            <table className="tbl">
              <thead>
                <tr>
                  <th>ตาราง</th>
                  <th>คำอธิบาย</th>
                  <th className="num">จำนวนแถว</th>
                </tr>
              </thead>
              <tbody>
                {m.tables.map((t) => (
                  <tr key={t.table_name}>
                    <td>
                      <code>{t.table_name}</code>
                    </td>
                    <td>{TABLE_TH[t.table_name] ?? ""}</td>
                    <td className="num">{fmt(t.row_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="about-notes">
              <h3>ข้อควรรู้</h3>
              <ul>
                <li>ปีทั้งหมดเป็นปีเพาะปลูกแบบพุทธศักราช (พ.ศ.)</li>
                <li>ข้อมูลระดับประเทศ ภาค และจังหวัดซ้อนกันเป็นลำดับชั้น จึงไม่ควรนำมาบวกรวมกัน เพราะจะนับซ้ำ</li>
                <li>ผลผลิตต่อไร่ (กิโลกรัมต่อไร่) เป็นอัตราส่วน จึงไม่แสดงสัดส่วนต่อประเทศ</li>
                <li>
                  ข้อมูลมาจาก {m.releases.length} รอบการเผยแพร่ ล่าสุดเมื่อ {latestRelease?.data_date_th}
                </li>
                <li>
                  <Link href="/normalization">ดูขั้นตอน normalization</Link> ว่าไฟล์ต้นทาง 3 ไฟล์กลายเป็น 6 ตารางนี้ได้อย่างไร
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <SourceCard className="span-2" />
      </div>

      <footer className="foot">
        ข้อมูล: {SOURCE.publisher} · ชุดข้อมูล “{SOURCE.title}” · ฐานข้อมูล <code>plam-oil</code> ตาราง <code>production_stats</code>{" "}
        {fmt(m.tables.find((t) => t.table_name === "production_stats")?.row_count)} แถว
      </footer>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  sql,
  loading,
  error,
  onRetry,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  sql?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <section className={`card ${className}`} aria-busy={loading || undefined}>
      <header className="card-head">
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
      </header>
      {error && (
        <p className="error" role="alert">
          โหลดข้อมูลไม่สำเร็จ ({error}){" "}
          {onRetry && (
            <button type="button" className="link-btn" onClick={onRetry}>
              ลองใหม่
            </button>
          )}
        </p>
      )}
      <div className="card-body" style={{ opacity: loading ? 0.55 : 1 }}>
        {children}
      </div>
      {sql && (
        <details className="sql">
          <summary>ดูคำสั่ง SQL ที่ใช้</summary>
          <pre>
            <code>{sql}</code>
          </pre>
        </details>
      )}
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function Loading() {
  return (
    <div className="page center">
      <p className="muted">กำลังโหลดข้อมูลจากฐานข้อมูล…</p>
    </div>
  );
}

function Offline({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="page center">
      <div className="card offline">
        <h1>เชื่อมต่อฐานข้อมูลไม่ได้</h1>
        <p className="muted">
          เว็บไซต์ติดต่อ API ไม่ได้ ({message}) ตรวจสอบว่ารัน <code>docker compose up -d</code> แล้ว และ API เปิดอยู่ที่{" "}
          <code>{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}</code>
        </p>
        <button type="button" className="btn" onClick={onRetry}>
          ลองใหม่
        </button>
      </div>
    </div>
  );
}

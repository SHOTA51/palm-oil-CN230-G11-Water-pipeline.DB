import type { TrendRow } from "./types";

const full = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const oneDp = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });
const twoDp = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt = (n: number | null | undefined) => (n == null ? "–" : full.format(n));

/** Large values in ล้าน (millions), everything else in full. */
export function fmtCompact(n: number | null | undefined): string {
  if (n == null) return "–";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(abs >= 10_000_000 ? oneDp : twoDp).format(n / 1_000_000)} ล้าน`;
  return full.format(n);
}

/** Axis ticks: "2 ล้าน", "500,000", "1,000". */
export function fmtTick(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${oneDp.format(n / 1_000_000)} ล้าน`;
  return full.format(n);
}

export function fmtPct(n: number | null | undefined, signed = false): string {
  if (n == null || !Number.isFinite(n)) return "–";
  const s = oneDp.format(Math.abs(n * 100));
  if (!signed) return `${s}%`;
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${s}%`;
}

export const change = (cur: number | null | undefined, prev: number | null | undefined) =>
  cur == null || prev == null || prev === 0 ? null : cur / prev - 1;

/** Short Thai label + unit per item id; the database names stay the source of truth. */
export const ITEM_SHORT: Record<number, { label: string; unit: string; key: keyof TrendRow }> = {
  1: { label: "เนื้อที่ยืนต้น", unit: "ไร่", key: "planted" },
  2: { label: "เนื้อที่ให้ผล", unit: "ไร่", key: "harvested" },
  3: { label: "ผลผลิต", unit: "ตัน", key: "production" },
  4: { label: "ผลผลิตต่อไร่", unit: "กก./ไร่", key: "yield" },
};
export const RATIO_ITEM_ID = 4;

/** Nice round ticks from 0 to at least `max`. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

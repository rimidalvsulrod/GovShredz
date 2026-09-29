// Everything is stored in kg / cm; the UI converts to the user's preferred unit.

export type Unit = "lb" | "kg";
export const KG_PER_LB = 0.45359237;

export const toKg = (v: number, unit: Unit) => (unit === "lb" ? v * KG_PER_LB : v);
export const fromKg = (kg: number, unit: Unit) => (unit === "lb" ? kg / KG_PER_LB : kg);

/** Rounds a weight for display: whole numbers when big, halves when small. */
export function roundW(v: number) {
  if (!isFinite(v)) return 0;
  return Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 2) / 2;
}

export const fmtNum = (v: number, digits = 0) =>
  v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function fmtW(kg: number, unit: Unit, withUnit = true) {
  const v = roundW(fromKg(kg, unit));
  return withUnit ? `${fmtNum(v, 1)} ${unit}` : fmtNum(v, 1);
}

/** Big totals like volume: 12,400 lb → "12.4k lb". */
export function fmtBig(kg: number, unit: Unit) {
  const v = fromKg(kg, unit);
  if (v >= 1_000_000) return `${fmtNum(v / 1_000_000, 2)}M ${unit}`;
  if (v >= 10_000) return `${fmtNum(v / 1000, 1)}k ${unit}`;
  return `${fmtNum(Math.round(v))} ${unit}`;
}

export function cmToFtIn(cm: number) {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) {
    ft += 1;
    inch = 0;
  }
  return { ft, inch };
}

export const ftInToCm = (ft: number, inch: number) => (ft * 12 + inch) * 2.54;

export function fmtHeight(cm: number | null | undefined, unit: Unit) {
  if (!cm) return "—";
  if (unit === "kg") return `${Math.round(cm)} cm`;
  const { ft, inch } = cmToFtIn(cm);
  return `${ft}′${inch}″`;
}

/** Local calendar day, YYYY-MM-DD (meals, water and bodyweight are logged per local day). */
export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftDay(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dayKey(dt);
}

export function ago(iso: string | Date) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

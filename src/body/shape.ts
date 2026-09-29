// Turns body stats (+ optional photo measurements) into proportions for the 3D model.
// All lengths are fractions of standing height unless noted.

import { composition, type BodyStats, type PhotoMetrics } from "@/shared/physique";
import { clamp, lerp } from "@/shared/units";
import type { Group } from "@/shared/exercises";

export type Shape = {
  heightM: number;
  female: boolean;
  /** 0 = untrained … 1 = very muscular (FFMI-based), can exceed 1 slightly */
  muscle: number;
  /** 0 = very lean … 1 = high body fat */
  fat: number;
  shoulder: number; // half bideltoid width
  chestW: number;
  chestD: number;
  waistW: number;
  waistD: number;
  hipW: number;
  hipD: number;
  arm: number; // upper arm radius
  forearm: number;
  thigh: number;
  calf: number;
  neck: number;
  abs: number; // 0..1 six-pack visibility
  belly: number; // 0..1
  bust: number; // 0..1 (female)
  skin: string;
  /** Rank colours per muscle group for the "rank map" view. */
  groupColors?: Partial<Record<Group | "none", string>>;
};

/** Model-only proportions from composition (no photo). */
export function shapeFromStats(s: BodyStats, skin = "#c68863"): Shape {
  const c = composition(s);
  const female = s.sex === "female";
  const muscle = female ? clamp((c.ffmi - 14.5) / 6.5, 0, 1.25) : clamp((c.ffmi - 17.5) / 7, 0, 1.25);
  const fat = female ? clamp((c.bodyFat - 0.16) / 0.26, 0, 1.3) : clamp((c.bodyFat - 0.07) / 0.25, 0, 1.3);
  const f = female ? 1 : 0;
  return {
    heightM: s.heightCm / 100,
    female,
    muscle,
    fat,
    shoulder: 0.118 + 0.022 * muscle + 0.008 * fat - 0.012 * f,
    chestW: 0.094 + 0.014 * muscle + 0.012 * fat - 0.01 * f,
    chestD: 0.058 + 0.012 * muscle + 0.013 * fat - 0.004 * f,
    waistW: 0.074 + 0.004 * muscle + 0.034 * fat - 0.008 * f,
    waistD: 0.052 + 0.003 * muscle + 0.034 * fat - 0.004 * f,
    hipW: 0.086 + 0.004 * muscle + 0.024 * fat + 0.012 * f,
    hipD: 0.058 + 0.004 * muscle + 0.016 * fat + 0.006 * f,
    arm: 0.023 + 0.012 * muscle + 0.007 * fat - 0.002 * f,
    forearm: 0.02 + 0.007 * muscle + 0.003 * fat - 0.002 * f,
    thigh: 0.047 + 0.013 * muscle + 0.016 * fat + 0.004 * f,
    calf: 0.029 + 0.007 * muscle + 0.006 * fat,
    neck: 0.03 + 0.009 * muscle + 0.005 * fat - 0.005 * f,
    abs: female ? clamp((0.2 - c.bodyFat) / 0.06, 0, 1) : clamp((0.14 - c.bodyFat) / 0.06, 0, 1),
    belly: clamp((fat - 0.35) / 0.8, 0, 1),
    bust: female ? clamp(0.35 + fat * 0.6, 0, 1) : 0,
    skin,
  };
}

// The photo measures silhouette widths (full widths ÷ height). Our model's full widths at the same
// levels are roughly these, so the difference nudges the model toward what the camera saw.
function modelWidths(sh: Shape): PhotoMetrics {
  return {
    shoulder: 2 * (sh.shoulder + sh.arm * 0.5),
    chest: 2 * sh.chestW * 1.02,
    waist: 2 * sh.waistW,
    hip: 2 * (sh.hipW + sh.fat * 0.004),
    thigh: 2 * sh.thigh,
    arm: 2 * sh.arm,
    calf: 2 * sh.calf,
  };
}

/** Photo-derived corrections (in shape units) to apply on top of a model shape. */
export type Correction = Partial<Record<"shoulder" | "chestW" | "waistW" | "hipW" | "thigh" | "arm" | "calf", number>>;

export function photoCorrection(model: Shape, m: PhotoMetrics | null | undefined): Correction {
  if (!m) return {};
  const mw = modelWidths(model);
  const d = (k: keyof PhotoMetrics, scale: number, limit: number) => {
    const a = m[k];
    const b = mw[k];
    if (!a || !b) return 0;
    return clamp(((a - b) / 2) * scale, -limit, limit);
  };
  return {
    shoulder: d("shoulder", 0.7, 0.03),
    chestW: d("chest", 0.6, 0.02),
    waistW: d("waist", 0.75, 0.03),
    hipW: d("hip", 0.6, 0.025),
    thigh: d("thigh", 0.5, 0.012),
    arm: d("arm", 0.4, 0.008),
    calf: d("calf", 0.4, 0.006),
  };
}

export function applyCorrection(sh: Shape, c: Correction): Shape {
  const out = { ...sh };
  for (const [k, v] of Object.entries(c) as [keyof Correction, number][]) out[k] = Math.max(0.01, out[k] + v);
  // Waist depth follows waist width changes a little.
  if (c.waistW) out.waistD = Math.max(0.035, out.waistD + c.waistW * 0.6);
  return out;
}

export function mixShapes(a: Shape, b: Shape, t: number): Shape {
  const out = { ...a };
  for (const k of Object.keys(a) as (keyof Shape)[]) {
    const va = a[k];
    const vb = b[k];
    if (typeof va === "number" && typeof vb === "number") (out as Record<string, unknown>)[k] = lerp(va, vb, t);
  }
  return out;
}

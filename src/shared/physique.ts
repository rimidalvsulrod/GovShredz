// Body composition estimates and the "future you" projection.
// Everything here is an estimate from published formulas — good for motivation, not medicine.

import { clamp } from "./units";
import type { Sex } from "./ranks";

/** Widths measured on a front-facing full-body photo, as a fraction of standing height. */
export type PhotoMetrics = {
  shoulder: number;
  chest: number;
  waist: number;
  hip: number;
  thigh?: number;
  arm?: number;
  calf?: number;
};

export type BodyStats = {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  age: number;
  /** Fraction (0.15 = 15%). When missing it's estimated. */
  bodyFat?: number | null;
  metrics?: PhotoMetrics | null;
  /** Overall strength rank score (0–21), used to tell muscle from fat. */
  strength?: number;
};

export const bmi = (heightCm: number, weightKg: number) => weightKg / (heightCm / 100) ** 2;

/** Deurenberg (1991): body fat from BMI, age and sex. */
export function bfFromBmi(b: number, age: number, sex: Sex) {
  return (1.2 * b + 0.23 * age - 10.8 * (sex === "male" ? 1 : 0) - 5.4) / 100;
}

/** Waist circumference (cm) from the front-view waist width, treating the waist as an ellipse. */
export function waistCircumference(waistRatio: number, heightCm: number) {
  const w = waistRatio * heightCm;
  const depth = 0.7 + 0.25 * clamp((waistRatio - 0.15) / 0.07, 0, 1);
  const a = w / 2;
  const b = (w * depth) / 2;
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/** Relative Fat Mass (Woolcott & Bergman 2018): body fat from height and waist circumference. */
export function bfFromWaist(heightCm: number, waistCm: number, sex: Sex) {
  return ((sex === "male" ? 64 : 76) - 20 * (heightCm / waistCm)) / 100;
}

export function estimateBodyFat(s: BodyStats) {
  if (s.bodyFat && s.bodyFat > 0.02) return s.bodyFat;
  const lo = s.sex === "male" ? 0.04 : 0.1;
  const hi = s.sex === "male" ? 0.5 : 0.55;
  // BMI can't tell muscle from fat; strong lifters get pulled down a little.
  const muscular = clamp(((s.strength ?? 0) - 8) * 0.007, 0, 0.07);
  const fromBmi = bfFromBmi(bmi(s.heightCm, s.weightKg), s.age || 30, s.sex) - muscular;
  if (s.metrics?.waist) {
    const fromWaist = bfFromWaist(s.heightCm, waistCircumference(s.metrics.waist, s.heightCm), s.sex);
    return clamp(0.65 * fromWaist + 0.35 * fromBmi, lo, hi);
  }
  return clamp(fromBmi, lo, hi);
}

export function composition(s: BodyStats) {
  const bf = estimateBodyFat(s);
  const h = s.heightCm / 100;
  const leanKg = s.weightKg * (1 - bf);
  const ffmi = leanKg / (h * h) + 6.1 * (1.8 - h);
  const m = s.metrics;
  return {
    bmi: bmi(s.heightCm, s.weightKg),
    bodyFat: bf,
    leanKg,
    fatKg: s.weightKg - leanKg,
    ffmi,
    waistCm: m?.waist ? waistCircumference(m.waist, s.heightCm) : null,
    shoulderToWaist: m?.waist ? m.shoulder / m.waist : null,
    shoulderToHip: m?.hip ? m.shoulder / m.hip : null,
  };
}

/** Descriptive band for a body fat %. */
export function bfLabel(bf: number, sex: Sex) {
  const t = sex === "male" ? [0.06, 0.1, 0.15, 0.2, 0.25] : [0.14, 0.18, 0.23, 0.28, 0.33];
  const names = ["Stage lean", "Shredded", "Athletic", "Fit", "Average", "Soft"];
  const i = t.findIndex((x) => bf < x);
  return names[i === -1 ? names.length - 1 : i];
}

export function ffmiLabel(ffmi: number, sex: Sex) {
  const t = sex === "male" ? [18, 20, 22, 23.5, 25] : [15, 16.5, 18, 19.5, 21];
  const names = ["Below average", "Average", "Muscular", "Very muscular", "Elite natural", "Freak"];
  const i = t.findIndex((x) => ffmi < x);
  return names[i === -1 ? names.length - 1 : i];
}

/* ------------------------------- projection -------------------------------- */

export type Goal = "cut" | "maintain" | "recomp" | "bulk";
export type Experience = "new" | "beginner" | "intermediate" | "advanced";

export const GOALS: { id: Goal; name: string; blurb: string }[] = [
  { id: "cut", name: "Cut", blurb: "Lose fat, keep muscle" },
  { id: "recomp", name: "Recomp", blurb: "Lose fat, build muscle slowly" },
  { id: "maintain", name: "Maintain", blurb: "Stay the same weight" },
  { id: "bulk", name: "Lean bulk", blurb: "Build muscle, small surplus" },
];

export const EXPERIENCES: { id: Experience; name: string }[] = [
  { id: "new", name: "Brand new" },
  { id: "beginner", name: "< 1 year" },
  { id: "intermediate", name: "1–3 years" },
  { id: "advanced", name: "3+ years" },
];

/** A sensible default from the lifter's current overall rank. */
export function experienceFromStrength(score: number): Experience {
  if (score < 5) return "new";
  if (score < 10) return "beginner";
  if (score < 15) return "intermediate";
  return "advanced";
}

export type Plan = {
  goal: Goal;
  weeks: number;
  days: number;
  experience: Experience;
  /** Average daily calories vs maintenance from the meal log, when there's enough of it. */
  kcalDelta?: number | null;
};

export type ProjectionPoint = { week: number; weightKg: number; bodyFat: number; leanKg: number; strength: number };

const EXP = ["new", "beginner", "intermediate", "advanced"] as const;
// Natural lean gain per month as a fraction of bodyweight (Aragon), and rank levels gained per month.
const LEAN_RATE = [0.015, 0.01, 0.005, 0.0025];
const RANK_RATE = [1.2, 0.8, 0.35, 0.15];
// Weeks spent at each experience level before moving up.
const EXP_WEEKS = [16, 52, 104, Infinity];
const FREQ = [0, 0.35, 0.65, 0.85, 1, 1.05, 1.08, 1.1];

export function project(now: BodyStats & { bodyFat: number }, plan: Plan): ProjectionPoint[] {
  const male = now.sex === "male";
  const floor = male ? 0.06 : 0.13;
  const cap = male ? 25 : 21;
  const capBase = male ? 19 : 15.5;
  const h = now.heightCm / 100;
  const freq = FREQ[clamp(Math.round(plan.days), 0, 7)];
  let e = EXP.indexOf(plan.experience);
  let weeksAtLevel = 0;
  let lean = now.weightKg * (1 - now.bodyFat);
  let fat = now.weightKg - lean;
  let strength = now.strength ?? 0;
  const out: ProjectionPoint[] = [{ week: 0, weightKg: now.weightKg, bodyFat: now.bodyFat, leanKg: lean, strength }];

  for (let week = 1; week <= plan.weeks; week++) {
    const w = lean + fat;
    const bf = fat / w;
    const ffmi = lean / (h * h) + 6.1 * (1.8 - h);
    const ceiling = Math.pow(clamp((cap - ffmi) / (cap - capBase), 0, 1), 0.7);
    const goalLean = { bulk: 1, recomp: 0.55, maintain: 0.35, cut: [0.5, 0.35, 0.15, 0.05][e] }[plan.goal];
    let leanGain = ((w * LEAN_RATE[e] * (male ? 1 : 0.5)) / 4.345) * freq * goalLean * ceiling;
    const room = clamp((bf - floor) / 0.06, 0, 1);
    let fatChange: number;

    if (plan.kcalDelta != null) {
      // Energy balance from the meal log: ~7700 kcal per kg of body weight change.
      const total = (plan.kcalDelta * 7) / 7700;
      if (plan.kcalDelta < -300) leanGain *= 0.5;
      fatChange = total - leanGain;
    } else if (plan.goal === "cut") fatChange = -w * 0.0065 * Math.max(0.25, room);
    else if (plan.goal === "bulk") fatChange = leanGain * [0.6, 0.9, 1.2, 1.5][e] + w * 0.0005;
    else if (plan.goal === "recomp") fatChange = -w * 0.0022 * room;
    else fatChange = -leanGain * 0.8;

    lean += leanGain;
    fat = Math.max(floor * (lean + fat) * 0.98, fat + fatChange);
    const goalStr = { cut: 0.5, maintain: 0.75, recomp: 0.9, bulk: 1.1 }[plan.goal];
    strength = Math.min(24, strength + ((RANK_RATE[e] * freq * goalStr * Math.max(0.15, 1 - strength / 24)) / 4.345));

    if (++weeksAtLevel >= EXP_WEEKS[e]) {
      e = Math.min(3, e + 1);
      weeksAtLevel = 0;
    }
    out.push({ week, weightKg: lean + fat, bodyFat: fat / (lean + fat), leanKg: lean, strength });
  }
  return out;
}

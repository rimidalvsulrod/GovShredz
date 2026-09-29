import type { Sex } from "./ranks";
import type { Goal } from "./physique";
import { clamp } from "./units";

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export const MEALS = [
  { id: "breakfast", name: "Breakfast" },
  { id: "lunch", name: "Lunch" },
  { id: "dinner", name: "Dinner" },
  { id: "snack", name: "Snacks" },
] as const;
export type MealType = (typeof MEALS)[number]["id"];

/** Resting burn: Mifflin–St Jeor, averaged with Katch–McArdle when body fat is known. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number, bodyFat?: number | null) {
  const mifflin = 10 * weightKg + 6.25 * heightCm - 5 * (age || 30) + (sex === "male" ? 5 : -161);
  if (!bodyFat) return mifflin;
  const katch = 370 + 21.6 * weightKg * (1 - bodyFat);
  return (mifflin + katch) / 2;
}

/** Maintenance calories, from resting burn and how often you train. */
export function tdee(base: number, workoutsPerWeek: number) {
  return base * (1.3 + 0.06 * clamp(workoutsPerWeek, 0, 7));
}

export type TargetInput = {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  bodyFat?: number | null;
  goal: Goal;
  workoutsPerWeek: number;
  kcalOverride?: number | null;
  proteinOverride?: number | null;
};

export function targets(t: TargetInput): Macros & { maintenance: number } {
  const maintenance = tdee(bmr(t.sex, t.weightKg, t.heightCm, t.age, t.bodyFat), t.workoutsPerWeek);
  const byGoal = { cut: maintenance * 0.8, recomp: maintenance - 150, maintain: maintenance, bulk: maintenance + 300 }[t.goal];
  const kcal = Math.round(t.kcalOverride || byGoal);
  // Protein ~2 g/kg (more on a cut), capped for higher body fat.
  const refKg = t.bodyFat ? Math.min(t.weightKg, (t.weightKg * (1 - t.bodyFat)) / 0.8) : t.weightKg;
  const protein = Math.round(t.proteinOverride || refKg * (t.goal === "cut" ? 2.2 : 2.0));
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(50, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, maintenance: Math.round(maintenance) };
}

export const sumMacros = (rows: Macros[]): Macros =>
  rows.reduce((s, r) => ({ kcal: s.kcal + r.kcal, protein: s.protein + r.protein, carbs: s.carbs + r.carbs, fat: s.fat + r.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

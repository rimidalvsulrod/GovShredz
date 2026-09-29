import "server-only";
import { query, queryOne } from "./db";
import { profileRanks, type Bests, type Sex } from "@/shared/ranks";
import { estimateBodyFat, type PhotoMetrics } from "@/shared/physique";
import { targets } from "@/shared/nutrition";
import { age, type UserRow } from "./auth";
import { num } from "./api";

export async function bestsFor(userId: string): Promise<Bests> {
  const rows = await query<{ exercise: string; m: number }>(
    `SELECT exercise, MAX(metric) AS m FROM sets WHERE user_id = $1 AND metric > 0 GROUP BY exercise`,
    [userId],
  );
  return Object.fromEntries(rows.map((r) => [r.exercise, num(r.m)]));
}

/** Best metric per exercise for every user (the whole squad is small). */
export async function allBests(): Promise<Map<string, Bests>> {
  const rows = await query<{ user_id: string; exercise: string; m: number }>(
    `SELECT user_id, exercise, MAX(metric) AS m FROM sets WHERE metric > 0 GROUP BY user_id, exercise`,
  );
  const out = new Map<string, Bests>();
  for (const r of rows) {
    const b = out.get(r.user_id) ?? {};
    b[r.exercise] = num(r.m);
    out.set(r.user_id, b);
  }
  return out;
}

export function overallScore(bests: Bests | undefined, sex: Sex) {
  return bests ? profileRanks(bests, sex).overall : 0;
}

/** Days (YYYY-MM-DD) with a workout or a meal logged, newest first. */
export async function activeDays(userId: string) {
  const rows = await query<{ day: string }>(
    `SELECT day FROM (SELECT day FROM workouts WHERE user_id = $1 UNION SELECT day FROM meals WHERE user_id = $1) d ORDER BY day DESC LIMIT 400`,
    [userId],
  );
  return rows.map((r) => r.day);
}

/** Consecutive active days ending today (or yesterday, so the streak survives until tonight). */
export function streakFrom(days: string[], today: string) {
  const set = new Set(days);
  const d = new Date(`${today}T12:00:00Z`);
  const key = (x: Date) => x.toISOString().slice(0, 10);
  if (!set.has(key(d))) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (set.has(key(d))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

export async function workoutsPerWeek(userId: string) {
  const r = await queryOne<{ n: number }>(`SELECT count(*) AS n FROM workouts WHERE user_id = $1 AND started_at > now() - interval '28 days'`, [userId]);
  return num(r?.n) / 4;
}

export async function latestScan(userId: string) {
  return queryOne<{ id: string; height_cm: number; weight_kg: number; body_fat: number; metrics: PhotoMetrics | null; skin: string; created_at: string }>(
    `SELECT id, height_cm, weight_kg, body_fat, metrics, skin, created_at FROM body_scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
}

/** Calorie and macro targets for a user, from their profile, latest scan and training frequency. */
export async function nutritionTargets(u: UserRow) {
  const [perWeek, scan, bests] = await Promise.all([workoutsPerWeek(u.id), latestScan(u.id), bestsFor(u.id)]);
  const weightKg = u.weight_kg ?? 75;
  const heightCm = u.height_cm ?? 175;
  const bodyFat =
    scan?.body_fat ??
    estimateBodyFat({ sex: u.sex, heightCm, weightKg, age: age(u), strength: profileRanks(bests, u.sex).overall });
  return {
    ...targets({
      sex: u.sex,
      weightKg,
      heightCm,
      age: age(u),
      bodyFat,
      goal: u.goal,
      workoutsPerWeek: perWeek,
      kcalOverride: u.kcal_target,
      proteinOverride: u.protein_target,
    }),
    workoutsPerWeek: perWeek,
  };
}

export async function canSeeWorkouts(viewer: UserRow, owner: { id: string; public_workouts: boolean }, isAdmin: boolean) {
  return isAdmin || viewer.id === owner.id || owner.public_workouts;
}

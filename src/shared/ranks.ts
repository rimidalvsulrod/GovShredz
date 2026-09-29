// GovShredz rank system (modelled on Liftoff): every set is scored against strength standards for
// the lifter's sex and bodyweight, giving a rank per exercise, per muscle group and overall.
//
// Ladder (22 ranks): Noob, Noob 2, Noob 3, Rookie … Rookie 3, Amateur, Athlete, Pro, Elite, Olympian
// (3 divisions each) and Legend at the top. Internally a rank is a continuous "score" from 0 to 21+;
// SR (shred rating) is score × 100.

import { GROUPS, OVERALL_GROUPS, getExercise, type Exercise, type Group } from "./exercises";

export type Sex = "male" | "female";

export type Tier = { id: string; name: string; c1: string; c2: string; ink: string };

export const TIERS: Tier[] = [
  { id: "noob", name: "Noob", c1: "#d6d3d1", c2: "#57534e", ink: "#e7e5e4" },
  { id: "rookie", name: "Rookie", c1: "#f5b47a", c2: "#8a4513", ink: "#fdba74" },
  { id: "amateur", name: "Amateur", c1: "#f8fafc", c2: "#7b8aa3", ink: "#e2e8f0" },
  { id: "athlete", name: "Athlete", c1: "#ffe68a", c2: "#c27803", ink: "#fcd34d" },
  { id: "pro", name: "Pro", c1: "#8ef9e0", c2: "#0b8a74", ink: "#5eead4" },
  { id: "elite", name: "Elite", c1: "#b3d4ff", c2: "#2b50ff", ink: "#93c5fd" },
  { id: "olympian", name: "Olympian", c1: "#f9b8ff", c2: "#8420f0", ink: "#f0abfc" },
  { id: "legend", name: "Legend", c1: "#ffe070", c2: "#ff2d2d", ink: "#fca5a5" },
];

export const LEGEND_LEVEL = 21;

export function levelName(level: number) {
  const l = Math.max(0, Math.min(LEGEND_LEVEL, Math.floor(level)));
  if (l >= LEGEND_LEVEL) return "Legend";
  const t = TIERS[Math.floor(l / 3)];
  const div = (l % 3) + 1;
  return div === 1 ? t.name : `${t.name} ${div}`;
}

export const tierOf = (level: number) => TIERS[Math.min(TIERS.length - 1, Math.floor(Math.max(0, Math.min(level, LEGEND_LEVEL)) / 3))];
export const divisionOf = (level: number) => (level >= LEGEND_LEVEL ? 0 : (Math.floor(Math.max(0, level)) % 3) + 1);

/** Estimated one-rep max (Epley). */
export function e1rm(weight: number, reps: number) {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, 30) / 30);
}

/** Weight you'd need for `reps` reps to hit an estimated max. */
export function weightForReps(max: number, reps: number) {
  return reps <= 1 ? max : max / (1 + Math.min(reps, 30) / 30);
}

/**
 * The number a set is ranked by. Weighted moves: estimated 1RM ÷ bodyweight.
 * Bodyweight moves: equivalent reps at bodyweight (added weight counts extra, assisted counts less).
 */
export function setMetric(ex: Exercise, weightKg: number, reps: number, bwKg: number) {
  if (!(bwKg > 0) || !(reps > 0)) return 0;
  if (ex.kind === "bodyweight") {
    const load = Math.max(0, bwKg + weightKg);
    return Math.max(0, (load / bwKg) * (30 + Math.min(reps, 100)) - 30);
  }
  if (!(weightKg > 0)) return 0;
  return e1rm(weightKg, reps) / bwKg;
}

/** Standards for this exercise and sex, plus a "world class" point above elite. */
export function standards(ex: Exercise, sex: Sex): number[] {
  const f = sex === "female" ? ex.f : 1;
  const s = ex.std.map((v) => v * f);
  return [...s, s[4] + (s[4] - s[3]) * 1.2];
}

// Anchors: 0 → Noob, beginner → Rookie, novice → Amateur, halfway to intermediate → Athlete,
// intermediate → Pro, advanced → Elite, elite → Olympian, world class → Legend.
function anchors(std: number[]): [number, number][] {
  return [
    [0, 0],
    [std[0], 3],
    [std[1], 6],
    [(std[1] + std[2]) / 2, 9],
    [std[2], 12],
    [std[3], 15],
    [std[4], 18],
    [std[5], 21],
  ];
}

export function scoreFromMetric(metric: number, std: number[]): number {
  if (!(metric > 0)) return 0;
  const a = anchors(std);
  for (let i = 1; i < a.length; i++) {
    if (metric <= a[i][0]) {
      const [m0, l0] = a[i - 1];
      const [m1, l1] = a[i];
      return l0 + ((metric - m0) / (m1 - m0)) * (l1 - l0);
    }
  }
  const [m0] = a[a.length - 2];
  const [m1] = a[a.length - 1];
  return Math.min(24.99, 21 + ((metric - m1) / (m1 - m0)) * 3);
}

export function metricForScore(score: number, std: number[]) {
  const a = anchors(std);
  if (score <= 0) return 0;
  for (let i = 1; i < a.length; i++) {
    if (score <= a[i][1]) {
      const [m0, l0] = a[i - 1];
      const [m1, l1] = a[i];
      return m0 + ((score - l0) / (l1 - l0)) * (m1 - m0);
    }
  }
  return a[a.length - 1][0];
}

export type RankInfo = {
  score: number;
  level: number;
  name: string;
  tier: Tier;
  division: number;
  progress: number;
  sr: number;
  nextName: string | null;
};

export function rankInfo(score: number): RankInfo {
  const s = Math.max(0, score || 0);
  const level = Math.min(LEGEND_LEVEL, Math.floor(s));
  return {
    score: s,
    level,
    name: levelName(level),
    tier: tierOf(level),
    division: divisionOf(level),
    progress: level >= LEGEND_LEVEL ? 1 : s - level,
    sr: Math.round(s * 100),
    nextName: level >= LEGEND_LEVEL ? null : levelName(level + 1),
  };
}

export const ALL_LEVELS = Array.from({ length: LEGEND_LEVEL + 1 }, (_, i) => i);

/* ------------------------------ profile ranks ------------------------------ */

/** exercise id → best metric the user has hit */
export type Bests = Record<string, number>;

export type ExerciseRank = { id: string; metric: number; score: number };
export type ProfileRanks = {
  exercises: ExerciseRank[];
  groups: Record<Group, { score: number; best: string | null }>;
  overall: number;
  counted: number;
  missing: Group[];
};

/**
 * Exercise rank = best set. Muscle group rank = its best exercise. Overall = average of chest, back,
 * shoulders, arms and legs (a group you've never trained counts as zero, so you can't farm one lift).
 */
export function profileRanks(bests: Bests, sex: Sex): ProfileRanks {
  const exercises: ExerciseRank[] = [];
  for (const [id, metric] of Object.entries(bests)) {
    const ex = getExercise(id);
    if (!ex || !(metric > 0)) continue;
    exercises.push({ id, metric, score: scoreFromMetric(metric, standards(ex, sex)) });
  }
  exercises.sort((a, b) => b.score - a.score);
  const groups = Object.fromEntries(GROUPS.map((g) => [g.id, { score: 0, best: null }])) as ProfileRanks["groups"];
  for (const e of exercises) {
    const g = getExercise(e.id)!.group;
    if (e.score > groups[g].score) groups[g] = { score: e.score, best: e.id };
  }
  const missing = OVERALL_GROUPS.filter((g) => !groups[g].best);
  const overall = OVERALL_GROUPS.reduce((s, g) => s + groups[g].score, 0) / OVERALL_GROUPS.length;
  return { exercises, groups, overall, counted: OVERALL_GROUPS.length - missing.length, missing };
}

/** Human description of a metric: "1.52× BW" or "14 reps". */
export function fmtMetric(ex: Exercise, metric: number) {
  return ex.kind === "bodyweight" ? `${Math.round(metric)} reps` : `${metric.toFixed(2)}× BW`;
}

/**
 * What it takes to reach `level` on an exercise: weighted moves return the estimated 1RM in kg
 * (per dumbbell for dumbbell moves); bodyweight moves return reps at bodyweight.
 */
export function requirement(ex: Exercise, sex: Sex, level: number, bwKg: number) {
  const m = metricForScore(level, standards(ex, sex));
  return ex.kind === "bodyweight" ? { reps: Math.max(1, Math.ceil(m)), kg: 0 } : { reps: 0, kg: m * bwKg };
}

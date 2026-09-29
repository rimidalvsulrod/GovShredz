// Response shapes of the API, shared by pages.
import type { WorkoutListItem } from "@/lib/workouts";
import type { loadChallenges } from "@/lib/challenges";

export type Workout = WorkoutListItem;
export type Challenge = Awaited<ReturnType<typeof loadChallenges>>[number];
export type WorkoutDetail = {
  workout: Workout;
  exercises: { exercise: string; sets: { weightKg: number; reps: number; e1rmKg: number; metric: number; pr: boolean }[] }[];
};
export type Pr = { exercise: string; e1rmKg: number; weightKg: number; reps: number; metric: number; date: string };
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };
export type Targets = Macros & { maintenance: number; workoutsPerWeek: number };
export type Player = {
  id: string;
  username: string;
  name: string;
  color: string;
  bio: string;
  joinedAt: string;
  lastSeen: string | null;
  workouts: number;
  workoutsThisWeek: number;
  following: boolean;
  followsMe: boolean;
  isMe: boolean;
  score: number;
};
export type Scan = {
  id: string;
  heightCm: number;
  weightKg: number;
  bodyFat: number;
  metrics: import("@/shared/physique").PhotoMetrics | null;
  skin: string;
  source: string;
  createdAt: string;
};

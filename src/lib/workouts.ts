import "server-only";
import { query } from "./db";
import { num } from "./api";

export type WorkoutListItem = {
  id: string;
  title: string;
  notes: string;
  startedAt: string;
  day: string;
  durationSec: number;
  volumeKg: number;
  setCount: number;
  prCount: number;
  bwKg: number;
  props: number;
  propped: boolean;
  user: { id: string; username: string; name: string; color: string; sex: "male" | "female" };
  exercises: { id: string; sets: number; bestE1rmKg: number; pr: boolean }[];
};

type Row = {
  id: string;
  title: string;
  notes: string;
  started_at: string;
  day: string;
  duration_sec: number;
  volume_kg: number;
  set_count: number;
  pr_count: number;
  bw_kg: number;
  props: number;
  propped: boolean;
  user_id: string;
  username: string;
  name: string;
  color: string;
  sex: "male" | "female";
};

/** Workouts matching `where` (on w = workouts, u = users), newest first, with a per-exercise summary. */
export async function listWorkouts(where: string, params: unknown[], viewerId: string, limit = 20): Promise<WorkoutListItem[]> {
  const p = [...params, viewerId];
  const rows = await query<Row>(
    `SELECT w.id, w.title, w.notes, w.started_at, w.day, w.duration_sec, w.volume_kg, w.set_count, w.pr_count, w.bw_kg,
       (SELECT count(*) FROM props pr WHERE pr.workout_id = w.id) AS props,
       EXISTS (SELECT 1 FROM props pr WHERE pr.workout_id = w.id AND pr.user_id = $${p.length}) AS propped,
       u.id AS user_id, u.username, u.name, u.color, u.sex
     FROM workouts w JOIN users u ON u.id = w.user_id
     WHERE ${where}
     ORDER BY w.started_at DESC LIMIT ${Math.max(1, Math.min(100, Math.floor(limit)))}`,
    p,
  );
  if (!rows.length) return [];
  const sum = await query<{ workout_id: string; exercise: string; n: number; best: number; pr: boolean; pos: number }>(
    `SELECT workout_id, exercise, count(*) AS n, MAX(e1rm_kg) AS best, bool_or(is_pr) AS pr, MIN(position) AS pos
     FROM sets WHERE workout_id = ANY($1) GROUP BY workout_id, exercise`,
    [rows.map((r) => r.id)],
  );
  const byWorkout = new Map<string, WorkoutListItem["exercises"]>();
  for (const s of sum.sort((a, b) => num(a.pos) - num(b.pos))) {
    const list = byWorkout.get(s.workout_id) ?? [];
    list.push({ id: s.exercise, sets: num(s.n), bestE1rmKg: num(s.best), pr: !!s.pr });
    byWorkout.set(s.workout_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    notes: r.notes,
    startedAt: r.started_at,
    day: r.day,
    durationSec: num(r.duration_sec),
    volumeKg: num(r.volume_kg),
    setCount: num(r.set_count),
    prCount: num(r.pr_count),
    bwKg: num(r.bw_kg),
    props: num(r.props),
    propped: !!r.propped,
    user: { id: r.user_id, username: r.username, name: r.name, color: r.color, sex: r.sex },
    exercises: byWorkout.get(r.id) ?? [],
  }));
}

export async function workoutSets(workoutId: string) {
  const rows = await query<{ exercise: string; position: number; set_no: number; weight_kg: number; reps: number; e1rm_kg: number; metric: number; is_pr: boolean }>(
    `SELECT exercise, position, set_no, weight_kg, reps, e1rm_kg, metric, is_pr FROM sets WHERE workout_id = $1 ORDER BY position, set_no`,
    [workoutId],
  );
  const out: { exercise: string; sets: { weightKg: number; reps: number; e1rmKg: number; metric: number; pr: boolean }[] }[] = [];
  for (const r of rows) {
    let ex = out[out.length - 1];
    if (!ex || ex.exercise !== r.exercise) {
      ex = { exercise: r.exercise, sets: [] };
      out.push(ex);
    }
    ex.sets.push({ weightKg: num(r.weight_kg), reps: num(r.reps), e1rmKg: num(r.e1rm_kg), metric: num(r.metric), pr: !!r.is_pr });
  }
  return out;
}

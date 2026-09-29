import type { NextRequest } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { bad, body, handle, num } from "@/lib/api";
import { isOwner, requireUser, type UserRow } from "@/lib/auth";
import { bestsFor } from "@/lib/stats";
import { listWorkouts } from "@/lib/workouts";
import { CUSTOM_PREFIX, getExercise } from "@/shared/exercises";
import { e1rm, profileRanks, setMetric } from "@/shared/ranks";

export const GET = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const me = auth.user;
  const q = req.nextUrl.searchParams;
  const username = q.get("user");
  let owner: Pick<UserRow, "id" | "public_workouts"> = me;
  if (username && username !== me.username) {
    const u = await queryOne<Pick<UserRow, "id" | "public_workouts">>(`SELECT id, public_workouts FROM users WHERE username = $1`, [username]);
    if (!u) return bad("Player not found", 404);
    if (!u.public_workouts && !isOwner(me)) return Response.json({ workouts: [], private: true });
    owner = u;
  }
  const before = q.get("before");
  const params: unknown[] = [owner.id];
  let where = "w.user_id = $1";
  if (before) {
    params.push(before);
    where += ` AND w.started_at < $2`;
  }
  const workouts = await listWorkouts(where, params, me.id, Number(q.get("limit") ?? 20));
  return Response.json({ workouts });
});

const exerciseId = z
  .string()
  .max(60)
  .refine((id) => !!getExercise(id) || (id.startsWith(CUSTOM_PREFIX) && id.length > CUSTOM_PREFIX.length), "Unknown exercise");

const schema = z.object({
  title: z.string().trim().min(1, "Give the workout a name").max(60),
  notes: z.string().trim().max(500).default(""),
  startedAt: z.string().max(40),
  durationSec: z.number().int().min(0).max(24 * 3600),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  exercises: z
    .array(
      z.object({
        exercise: exerciseId,
        sets: z
          .array(z.object({ weightKg: z.number().min(-250).max(1500), reps: z.number().int().min(1).max(200) }))
          .min(1)
          .max(40),
      }),
    )
    .min(1, "Log at least one set")
    .max(40),
});

type SetRow = { exercise: string; position: number; setNo: number; weight: number; reps: number; e1rm: number; metric: number; isPr: boolean };

export const POST = handle(async (req: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const u = auth.user;
  const data = await body(req, schema);
  if (data instanceof Response) return data;
  if (!u.weight_kg) return bad("Set your bodyweight in Settings first.");
  const bw = u.weight_kg;

  // Workouts can be logged up to two weeks late, never in the future.
  const now = Date.now();
  let started = new Date(data.startedAt).getTime();
  if (!isFinite(started) || started > now + 5 * 60_000 || started < now - 14 * 86400_000) started = now;
  const startedAt = new Date(started).toISOString();

  const ids = [...new Set(data.exercises.map((e) => e.exercise))];
  const [prevRows, beforeBests] = await Promise.all([
    query<{ exercise: string; m: number; e: number }>(
      `SELECT exercise, MAX(metric) AS m, MAX(e1rm_kg) AS e FROM sets WHERE user_id = $1 AND exercise = ANY($2) GROUP BY exercise`,
      [u.id, ids],
    ),
    bestsFor(u.id),
  ]);
  const prev = new Map(prevRows.map((r) => [r.exercise, { m: num(r.m), e: num(r.e) }]));

  const rows: SetRow[] = [];
  let volume = 0;
  data.exercises.forEach((ex, position) => {
    const def = getExercise(ex.exercise);
    ex.sets.forEach((s, i) => {
      const load = def?.kind === "bodyweight" ? Math.max(0, bw + s.weightKg) : Math.max(0, s.weightKg);
      volume += load * s.reps * (def?.perHand ? 2 : 1);
      rows.push({
        exercise: ex.exercise,
        position,
        setNo: i + 1,
        weight: s.weightKg,
        reps: s.reps,
        e1rm: e1rm(load, s.reps),
        metric: def ? setMetric(def, s.weightKg, s.reps, bw) : 0,
        isPr: false,
      });
    });
  });

  // A PR is the best set of an exercise beating everything logged before (first time counts).
  const prs: { exercise: string; e1rmKg: number; weightKg: number; reps: number; metric: number; first: boolean }[] = [];
  for (const id of ids) {
    const ranked = !!getExercise(id);
    const val = (r: SetRow) => (ranked ? r.metric : r.e1rm);
    const best = rows.filter((r) => r.exercise === id).reduce((a, b) => (val(b) > val(a) ? b : a));
    const p = prev.get(id);
    const prevVal = p ? (ranked ? p.m : p.e) : 0;
    if (val(best) > 0 && val(best) > prevVal + 1e-9) {
      best.isPr = true;
      prs.push({ exercise: id, e1rmKg: best.e1rm, weightKg: best.weight, reps: best.reps, metric: best.metric, first: !p });
    }
  }

  const w = await queryOne<{ id: string }>(
    `INSERT INTO workouts (user_id, title, notes, bw_kg, started_at, day, duration_sec, volume_kg, set_count, pr_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [u.id, data.title, data.notes, bw, startedAt, data.day, data.durationSec, volume, rows.length, prs.length],
  );
  const params: unknown[] = [];
  const values = rows.map((r) => {
    params.push(w!.id, u.id, r.exercise, r.position, r.setNo, r.weight, r.reps, r.e1rm, r.metric, r.isPr, startedAt);
    const b = params.length - 11;
    return `(${Array.from({ length: 11 }, (_, i) => `$${b + i + 1}`).join(", ")})`;
  });
  try {
    await query(
      `INSERT INTO sets (workout_id, user_id, exercise, position, set_no, weight_kg, reps, e1rm_kg, metric, is_pr, done_at) VALUES ${values.join(", ")}`,
      params,
    );
  } catch (e) {
    await query(`DELETE FROM workouts WHERE id = $1`, [w!.id]);
    throw e;
  }

  // What ranked up.
  const afterBests = { ...beforeBests };
  for (const r of rows) if (r.metric > (afterBests[r.exercise] ?? 0)) afterBests[r.exercise] = r.metric;
  const before = profileRanks(beforeBests, u.sex);
  const after = profileRanks(afterBests, u.sex);
  const rankUps: { kind: "exercise" | "group" | "overall"; id: string; from: number; to: number }[] = [];
  for (const e of after.exercises) {
    const b = before.exercises.find((x) => x.id === e.id)?.score ?? 0;
    if (Math.floor(e.score) > Math.floor(b) || (b === 0 && e.score > 0)) rankUps.push({ kind: "exercise", id: e.id, from: b, to: e.score });
  }
  for (const g of Object.keys(after.groups) as (keyof typeof after.groups)[]) {
    const b = before.groups[g].score;
    const a = after.groups[g].score;
    if (Math.floor(a) > Math.floor(b)) rankUps.push({ kind: "group", id: g, from: b, to: a });
  }
  if (Math.floor(after.overall) > Math.floor(before.overall)) rankUps.push({ kind: "overall", id: "overall", from: before.overall, to: after.overall });

  return Response.json({ id: w!.id, volumeKg: volume, sets: rows.length, prs, rankUps, overall: { before: before.overall, after: after.overall } });
});

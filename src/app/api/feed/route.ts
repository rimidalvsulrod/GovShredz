import type { NextRequest } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { bad, body, handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listWorkouts } from "@/lib/workouts";

// ?scope=all (everyone public) | following (people you follow + you)
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const q = req.nextUrl.searchParams;
  const params: unknown[] = [auth.user.id];
  let where = `NOT u.banned AND (u.public_workouts OR w.user_id = $1)`;
  if (q.get("scope") === "following") where += ` AND (w.user_id = $1 OR EXISTS (SELECT 1 FROM follows f WHERE f.follower = $1 AND f.followee = w.user_id))`;
  const before = q.get("before");
  if (before) {
    params.push(before);
    where += ` AND w.started_at < $${params.length}`;
  }
  const workouts = await listWorkouts(where, params, auth.user.id, Number(q.get("limit") ?? 20));
  return Response.json({ workouts });
});

// Give (or take back) 🔥 props on a workout.
export const POST = handle(async (req: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const data = await body(req, z.object({ workoutId: z.string().uuid(), on: z.boolean() }));
  if (data instanceof Response) return data;
  const w = await queryOne(`SELECT 1 FROM workouts WHERE id = $1`, [data.workoutId]);
  if (!w) return bad("Workout not found", 404);
  if (data.on) await query(`INSERT INTO props (user_id, workout_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [auth.user.id, data.workoutId]);
  else await query(`DELETE FROM props WHERE user_id = $1 AND workout_id = $2`, [auth.user.id, data.workoutId]);
  return Response.json({ ok: true });
});

import type { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { bad, handle, num } from "@/lib/api";
import { requireUser } from "@/lib/auth";

// ?exercise=bench[&user=name]&mode=history → best set per workout over time (for charts)
// ?exercise=bench&mode=last → your sets from the last time you did it (logger "previous" column)
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const q = req.nextUrl.searchParams;
  const exercise = q.get("exercise") ?? "";
  if (!exercise) return bad("Missing exercise");
  let userId = auth.user.id;
  const username = q.get("user");
  if (username && username !== auth.user.username) {
    const u = await queryOne<{ id: string }>(`SELECT id FROM users WHERE username = $1`, [username]);
    if (!u) return bad("Player not found", 404);
    userId = u.id;
  }

  if (q.get("mode") === "last") {
    const rows = await query<{ weight_kg: number; reps: number }>(
      `SELECT weight_kg, reps FROM sets
       WHERE exercise = $2 AND workout_id = (SELECT workout_id FROM sets WHERE user_id = $1 AND exercise = $2 ORDER BY done_at DESC, id DESC LIMIT 1)
       ORDER BY set_no`,
      [userId, exercise],
    );
    return Response.json({ sets: rows.map((r) => ({ weightKg: num(r.weight_kg), reps: num(r.reps) })) });
  }

  const rows = await query<{ t: string; e: number; m: number; sets: number; top_w: number; top_r: number }>(
    `SELECT w.started_at AS t, MAX(s.e1rm_kg) AS e, MAX(s.metric) AS m, count(*) AS sets,
       (ARRAY_AGG(s.weight_kg ORDER BY s.e1rm_kg DESC))[1] AS top_w,
       (ARRAY_AGG(s.reps ORDER BY s.e1rm_kg DESC))[1] AS top_r
     FROM sets s JOIN workouts w ON w.id = s.workout_id
     WHERE s.user_id = $1 AND s.exercise = $2
     GROUP BY w.id, w.started_at ORDER BY w.started_at ASC LIMIT 300`,
    [userId, exercise],
  );
  return Response.json({
    points: rows.map((r) => ({ t: r.t, e1rmKg: num(r.e), metric: num(r.m), sets: num(r.sets), weightKg: num(r.top_w), reps: num(r.top_r) })),
  });
});

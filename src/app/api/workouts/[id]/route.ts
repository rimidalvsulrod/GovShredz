import type { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { bad, handle } from "@/lib/api";
import { isOwner, requireUser } from "@/lib/auth";
import { listWorkouts, workoutSets } from "@/lib/workouts";

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/workouts/[id]">) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return bad("Not found", 404);
  const [w] = await listWorkouts("w.id = $1", [id], auth.user.id, 1);
  if (!w) return bad("Workout not found", 404);
  const owner = await queryOne<{ public_workouts: boolean }>(`SELECT public_workouts FROM users WHERE id = $1`, [w.user.id]);
  if (w.user.id !== auth.user.id && !owner?.public_workouts && !isOwner(auth.user)) return bad("This workout is private.", 403);
  return Response.json({ workout: w, exercises: await workoutSets(id) });
});

export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/workouts/[id]">) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return bad("Not found", 404);
  const rows = await query(`DELETE FROM workouts WHERE id = $1 AND user_id = $2 RETURNING id`, [id, auth.user.id]);
  if (!rows.length) return bad("Workout not found", 404);
  return Response.json({ ok: true });
});

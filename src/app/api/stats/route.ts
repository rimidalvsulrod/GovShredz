import type { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { bad, handle, num } from "@/lib/api";
import { requireUser, type UserRow } from "@/lib/auth";

// Best lifts for a player (ranks are public, so anyone signed in can see anyone's).
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const username = req.nextUrl.searchParams.get("user");
  const u = username
    ? await queryOne<Pick<UserRow, "id" | "username" | "name" | "sex" | "weight_kg" | "color">>(
        `SELECT id, username, name, sex, weight_kg, color FROM users WHERE username = $1`,
        [username],
      )
    : auth.user;
  if (!u) return bad("Player not found", 404);
  const rows = await query<{ exercise: string; e1rm_kg: number; weight_kg: number; reps: number; metric: number; done_at: string }>(
    `SELECT DISTINCT ON (exercise) exercise, e1rm_kg, weight_kg, reps, metric, done_at
     FROM sets WHERE user_id = $1 ORDER BY exercise, metric DESC, e1rm_kg DESC, done_at DESC`,
    [u.id],
  );
  const bests: Record<string, number> = {};
  for (const r of rows) if (num(r.metric) > 0) bests[r.exercise] = num(r.metric);
  return Response.json({
    user: { id: u.id, username: u.username, name: u.name, sex: u.sex, color: u.color },
    bests,
    records: rows.map((r) => ({ exercise: r.exercise, e1rmKg: num(r.e1rm_kg), weightKg: num(r.weight_kg), reps: num(r.reps), metric: num(r.metric), date: r.done_at })),
  });
});

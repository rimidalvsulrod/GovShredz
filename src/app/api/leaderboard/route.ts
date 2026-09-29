import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { bad, handle, num } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { allBests, overallScore } from "@/lib/stats";
import { getExercise } from "@/shared/exercises";
import { scoreFromMetric, standards, type Sex } from "@/shared/ranks";

type P = { id: string; username: string; name: string; color: string; sex: Sex };
const PLAYERS = `SELECT id, username, name, color, sex FROM users WHERE email_verified_at IS NOT NULL AND NOT banned AND onboarded`;

// kind = overall | lift (&exercise=) | volume (7 days) | workouts (30 days)
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const q = req.nextUrl.searchParams;
  const kind = q.get("kind") ?? "overall";
  const players = await query<P>(PLAYERS);
  const base = (p: P) => ({ id: p.id, username: p.username, name: p.name, color: p.color, isMe: p.id === auth.user.id });

  if (kind === "overall") {
    const bests = await allBests();
    const rows = players.map((p) => ({ ...base(p), score: overallScore(bests.get(p.id), p.sex), value: 0 }));
    return Response.json({ rows: rows.sort((a, b) => b.score - a.score) });
  }

  if (kind === "lift") {
    const ex = getExercise(q.get("exercise") ?? "");
    if (!ex) return bad("Unknown exercise");
    const best = await query<{ user_id: string; metric: number; e1rm_kg: number; weight_kg: number; reps: number }>(
      `SELECT DISTINCT ON (user_id) user_id, metric, e1rm_kg, weight_kg, reps FROM sets WHERE exercise = $1 AND metric > 0 ORDER BY user_id, metric DESC`,
      [ex.id],
    );
    const by = new Map(best.map((b) => [b.user_id, b]));
    const rows = players
      .filter((p) => by.has(p.id))
      .map((p) => {
        const b = by.get(p.id)!;
        return {
          ...base(p),
          score: scoreFromMetric(num(b.metric), standards(ex, p.sex)),
          value: num(b.e1rm_kg),
          metric: num(b.metric),
          weightKg: num(b.weight_kg),
          reps: num(b.reps),
        };
      });
    return Response.json({ rows: rows.sort((a, b) => b.score - a.score) });
  }

  if (kind === "volume" || kind === "workouts") {
    const agg =
      kind === "volume"
        ? `SELECT user_id, SUM(volume_kg) AS v FROM workouts WHERE started_at > now() - interval '7 days' GROUP BY user_id`
        : `SELECT user_id, count(*) AS v FROM workouts WHERE started_at > now() - interval '30 days' GROUP BY user_id`;
    const vals = new Map((await query<{ user_id: string; v: number }>(agg)).map((r) => [r.user_id, num(r.v)]));
    const bests = await allBests();
    const rows = players.map((p) => ({ ...base(p), value: vals.get(p.id) ?? 0, score: overallScore(bests.get(p.id), p.sex) }));
    return Response.json({ rows: rows.sort((a, b) => b.value - a.value) });
  }

  return bad("Unknown leaderboard");
});

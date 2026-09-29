import type { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { bad, handle, num } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { activeDays, bestsFor, nutritionTargets, streakFrom } from "@/lib/stats";
import { loadChallenges } from "@/lib/challenges";
import { listWorkouts } from "@/lib/workouts";

// Everything the home screen needs in one round trip.
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const u = auth.user;
  const today = req.nextUrl.searchParams.get("today") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return bad("Bad date");

  const [bests, days, week, prs, eaten, targets, challenges, feed, announcements, unread, water] = await Promise.all([
    bestsFor(u.id),
    activeDays(u.id),
    queryOne<{ n: number; vol: number; sets: number }>(
      `SELECT count(*) AS n, COALESCE(SUM(volume_kg), 0) AS vol, COALESCE(SUM(set_count), 0) AS sets FROM workouts WHERE user_id = $1 AND started_at > now() - interval '7 days'`,
      [u.id],
    ),
    query<{ exercise: string; e1rm_kg: number; weight_kg: number; reps: number; metric: number; done_at: string }>(
      `SELECT exercise, e1rm_kg, weight_kg, reps, metric, done_at FROM sets WHERE user_id = $1 AND is_pr ORDER BY done_at DESC, id DESC LIMIT 6`,
      [u.id],
    ),
    queryOne<{ kcal: number; protein: number; carbs: number; fat: number }>(
      `SELECT COALESCE(SUM(kcal),0) AS kcal, COALESCE(SUM(protein),0) AS protein, COALESCE(SUM(carbs),0) AS carbs, COALESCE(SUM(fat),0) AS fat FROM meals WHERE user_id = $1 AND day = $2`,
      [u.id, today],
    ),
    nutritionTargets(u),
    loadChallenges(
      `c.ends_at > now() - interval '3 days' AND NOT c.cancelled AND EXISTS (SELECT 1 FROM challenge_players cp WHERE cp.challenge_id = c.id AND cp.user_id = $1 AND cp.status <> 'declined')`,
      [u.id],
    ),
    listWorkouts(`NOT u.banned AND (u.public_workouts OR w.user_id = $1) AND w.started_at > now() - interval '14 days'`, [u.id], u.id, 5),
    query<{ id: string; body: string; tone: string; created_at: string }>(`SELECT id, body, tone, created_at FROM announcements WHERE active ORDER BY id DESC LIMIT 3`),
    queryOne<{ n: number }>(`SELECT count(*) AS n FROM support_messages WHERE user_id = $1 AND from_admin AND read_at IS NULL`, [u.id]),
    queryOne<{ ml: number }>(`SELECT ml FROM water WHERE user_id = $1 AND day = $2`, [u.id, today]),
  ]);

  return Response.json({
    bests,
    streak: streakFrom(days, today),
    activeDays: days.slice(0, 60),
    week: { workouts: num(week?.n), volumeKg: num(week?.vol), sets: num(week?.sets) },
    prs: prs.map((p) => ({ exercise: p.exercise, e1rmKg: num(p.e1rm_kg), weightKg: num(p.weight_kg), reps: num(p.reps), metric: num(p.metric), date: p.done_at })),
    nutrition: {
      eaten: { kcal: num(eaten?.kcal), protein: num(eaten?.protein), carbs: num(eaten?.carbs), fat: num(eaten?.fat) },
      targets,
      waterMl: num(water?.ml),
    },
    challenges,
    feed,
    announcements: announcements.map((a) => ({ id: num(a.id), body: a.body, tone: a.tone, createdAt: a.created_at })),
    unreadSupport: num(unread?.n),
  });
});

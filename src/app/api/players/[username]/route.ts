import type { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { bad, handle, num } from "@/lib/api";
import { isOwner, requireUser, type UserRow } from "@/lib/auth";
import { activeDays, bestsFor, latestScan, streakFrom } from "@/lib/stats";
import { listWorkouts } from "@/lib/workouts";

export const GET = handle(async (req: NextRequest, ctx: RouteContext<"/api/players/[username]">) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { username } = await ctx.params;
  const today = req.nextUrl.searchParams.get("today") ?? new Date().toISOString().slice(0, 10);
  const u = await queryOne<UserRow>(
    `SELECT id, username, name, bio, color, sex, public_workouts, share_physique, created_at, weight_kg, height_cm, birth_year, banned, onboarded, email_verified_at, email FROM users WHERE username = $1`,
    [username.toLowerCase()],
  );
  if (!u || (u.banned && !isOwner(auth.user))) return bad("Player not found", 404);
  const self = u.id === auth.user.id;
  const admin = isOwner(auth.user);
  const [counts, bests, days, scan] = await Promise.all([
    queryOne<{ workouts: number; volume: number; prs: number; followers: number; following: number; i_follow: boolean }>(
      `SELECT (SELECT count(*) FROM workouts WHERE user_id = $1) AS workouts,
         (SELECT COALESCE(SUM(volume_kg), 0) FROM workouts WHERE user_id = $1) AS volume,
         (SELECT count(*) FROM sets WHERE user_id = $1 AND is_pr) AS prs,
         (SELECT count(*) FROM follows WHERE followee = $1) AS followers,
         (SELECT count(*) FROM follows WHERE follower = $1) AS following,
         EXISTS (SELECT 1 FROM follows WHERE follower = $2 AND followee = $1) AS i_follow`,
      [u.id, auth.user.id],
    ),
    bestsFor(u.id),
    activeDays(u.id),
    self || admin || u.share_physique ? latestScan(u.id) : Promise.resolve(null),
  ]);
  const canSeeWorkouts = self || admin || u.public_workouts;
  const workouts = canSeeWorkouts ? await listWorkouts("w.user_id = $1", [u.id], auth.user.id, 10) : [];
  return Response.json({
    player: {
      id: u.id,
      username: u.username,
      name: u.name,
      bio: u.bio,
      color: u.color,
      sex: u.sex,
      joinedAt: u.created_at,
      isMe: self,
      following: !!counts?.i_follow,
      publicWorkouts: u.public_workouts,
      sharePhysique: u.share_physique,
    },
    stats: {
      workouts: num(counts?.workouts),
      volumeKg: num(counts?.volume),
      prs: num(counts?.prs),
      followers: num(counts?.followers),
      following: num(counts?.following),
      streak: streakFrom(days, today),
    },
    bests,
    workouts,
    workoutsPrivate: !canSeeWorkouts,
    physique: scan
      ? {
          heightCm: num(scan.height_cm),
          weightKg: num(scan.weight_kg),
          bodyFat: num(scan.body_fat),
          metrics: scan.metrics,
          skin: scan.skin,
          age: u.birth_year ? new Date().getFullYear() - u.birth_year : 30,
          scannedAt: scan.created_at,
        }
      : null,
  });
});

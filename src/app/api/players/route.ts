import { query } from "@/lib/db";
import { handle, num } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { allBests, overallScore } from "@/lib/stats";
import type { Sex } from "@/shared/ranks";

// Everyone in the squad with their overall rank.
export const GET = handle(async () => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const me = auth.user.id;
  const [rows, bests] = await Promise.all([
    query<{
      id: string;
      username: string;
      name: string;
      color: string;
      sex: Sex;
      bio: string;
      created_at: string;
      last_seen: string | null;
      workouts: number;
      week: number;
      following: boolean;
      follows_me: boolean;
    }>(
      `SELECT u.id, u.username, u.name, u.color, u.sex, u.bio, u.created_at,
         (SELECT MAX(last_seen) FROM user_ips i WHERE i.user_id = u.id) AS last_seen,
         (SELECT count(*) FROM workouts w WHERE w.user_id = u.id) AS workouts,
         (SELECT count(*) FROM workouts w WHERE w.user_id = u.id AND w.started_at > now() - interval '7 days') AS week,
         EXISTS (SELECT 1 FROM follows f WHERE f.follower = $1 AND f.followee = u.id) AS following,
         EXISTS (SELECT 1 FROM follows f WHERE f.follower = u.id AND f.followee = $1) AS follows_me
       FROM users u
       WHERE u.email_verified_at IS NOT NULL AND NOT u.banned AND u.onboarded`,
      [me],
    ),
    allBests(),
  ]);
  const players = rows
    .map((r) => ({
      id: r.id,
      username: r.username,
      name: r.name,
      color: r.color,
      bio: r.bio,
      joinedAt: r.created_at,
      lastSeen: r.last_seen,
      workouts: num(r.workouts),
      workoutsThisWeek: num(r.week),
      following: !!r.following,
      followsMe: !!r.follows_me,
      isMe: r.id === me,
      score: overallScore(bests.get(r.id), r.sex),
    }))
    .sort((a, b) => b.score - a.score);
  return Response.json({ players });
});

import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { bad, body, handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { loadChallenges } from "@/lib/challenges";
import { getExercise } from "@/shared/exercises";

export const GET = handle(async () => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const challenges = await loadChallenges(
    `EXISTS (SELECT 1 FROM challenge_players cp WHERE cp.challenge_id = c.id AND cp.user_id = $1 AND cp.status <> 'declined')`,
    [auth.user.id],
  );
  return Response.json({ challenges });
});

export const POST = handle(async (req: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const data = await body(
    req,
    z.object({
      title: z.string().trim().min(1, "Name the challenge").max(60),
      kind: z.enum(["volume", "workouts", "e1rm", "relative"]),
      exercise: z.string().max(40).nullable().default(null),
      stakes: z.string().trim().max(120).default(""),
      days: z.number().int().min(1).max(90),
      opponents: z.array(z.string().max(40)).min(1, "Pick at least one opponent").max(20),
    }),
  );
  if (data instanceof Response) return data;
  if ((data.kind === "e1rm" || data.kind === "relative") && !getExercise(data.exercise ?? "")) return bad("Pick an exercise for this challenge.");
  const opponents = await query<{ id: string }>(
    `SELECT id FROM users WHERE username = ANY($1) AND id <> $2 AND email_verified_at IS NOT NULL AND NOT banned`,
    [data.opponents, auth.user.id],
  );
  if (!opponents.length) return bad("Those players weren't found.");
  const c = await queryOne<{ id: string }>(
    `INSERT INTO challenges (creator, title, kind, exercise, stakes, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5, now(), now() + make_interval(days => $6)) RETURNING id`,
    [auth.user.id, data.title, data.kind, data.kind === "e1rm" || data.kind === "relative" ? data.exercise : null, data.stakes, data.days],
  );
  await query(`INSERT INTO challenge_players (challenge_id, user_id, status) VALUES ($1, $2, 'accepted')`, [c!.id, auth.user.id]);
  for (const o of opponents) await query(`INSERT INTO challenge_players (challenge_id, user_id, status) VALUES ($1, $2, 'invited')`, [c!.id, o.id]);
  return Response.json({ id: c!.id });
});

import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { bad, body, handle, usernameSchema } from "@/lib/api";
import { currentUserRow, publicMe, USER_COLS, type UserRow } from "@/lib/auth";

export const GET = handle(async () => {
  const u = await currentUserRow();
  if (!u) return bad("Sign in required", 401);
  return Response.json({ user: publicMe(u) });
});

const patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  username: usernameSchema.optional(),
  bio: z.string().trim().max(160).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sex: z.enum(["male", "female"]).optional(),
  birthYear: z.number().int().min(1920).max(new Date().getFullYear() - 10).nullable().optional(),
  heightCm: z.number().min(100).max(250).optional(),
  weightKg: z.number().min(30).max(300).optional(),
  unit: z.enum(["lb", "kg"]).optional(),
  goal: z.enum(["cut", "maintain", "recomp", "bulk"]).optional(),
  kcalTarget: z.number().int().min(800).max(8000).nullable().optional(),
  proteinTarget: z.number().int().min(20).max(500).nullable().optional(),
  publicWorkouts: z.boolean().optional(),
  sharePhysique: z.boolean().optional(),
  onboarded: z.boolean().optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const COLS: Record<string, string> = {
  name: "name",
  username: "username",
  bio: "bio",
  color: "color",
  sex: "sex",
  birthYear: "birth_year",
  heightCm: "height_cm",
  weightKg: "weight_kg",
  unit: "unit",
  goal: "goal",
  kcalTarget: "kcal_target",
  proteinTarget: "protein_target",
  publicWorkouts: "public_workouts",
  sharePhysique: "share_physique",
  onboarded: "onboarded",
};

export const PATCH = handle(async (req: Request) => {
  const u = await currentUserRow();
  if (!u) return bad("Sign in required", 401);
  const data = await body(req, patch);
  if (data instanceof Response) return data;
  if (data.username && data.username !== u.username && (await queryOne(`SELECT 1 FROM users WHERE username = $1`, [data.username]))) {
    return bad("That username is taken.", 409);
  }
  const sets: string[] = [];
  const params: unknown[] = [u.id];
  for (const [k, col] of Object.entries(COLS)) {
    const v = (data as Record<string, unknown>)[k];
    if (v === undefined) continue;
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  }
  let row: UserRow | null = u;
  if (sets.length) row = await queryOne<UserRow>(`UPDATE users SET ${sets.join(", ")} WHERE id = $1 RETURNING ${USER_COLS}`, params);
  // A new bodyweight also goes into the weight log for that day.
  if (data.weightKg && data.day) {
    await query(
      `INSERT INTO bodyweights (user_id, day, weight_kg) VALUES ($1, $2, $3) ON CONFLICT (user_id, day) DO UPDATE SET weight_kg = $3`,
      [u.id, data.day, data.weightKg],
    );
  }
  return Response.json({ user: publicMe(row!) });
});

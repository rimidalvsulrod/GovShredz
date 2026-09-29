import type { NextRequest } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { bad, body, handle, num } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { nutritionTargets } from "@/lib/stats";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bad date");

type MealRow = { id: string; meal: string; name: string; serving: string; servings: number; kcal: number; protein: number; carbs: number; fat: number; created_at: string };

const mapMeal = (m: MealRow) => ({
  id: m.id,
  meal: m.meal,
  name: m.name,
  serving: m.serving,
  servings: num(m.servings),
  kcal: num(m.kcal),
  protein: num(m.protein),
  carbs: num(m.carbs),
  fat: num(m.fat),
  createdAt: m.created_at,
});

export const GET = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const d = day.safeParse(req.nextUrl.searchParams.get("day"));
  if (!d.success) return bad("Bad date");
  const [meals, water, t] = await Promise.all([
    query<MealRow>(`SELECT id, meal, name, serving, servings, kcal, protein, carbs, fat, created_at FROM meals WHERE user_id = $1 AND day = $2 ORDER BY created_at`, [auth.user.id, d.data]),
    queryOne<{ ml: number }>(`SELECT ml FROM water WHERE user_id = $1 AND day = $2`, [auth.user.id, d.data]),
    nutritionTargets(auth.user),
  ]);
  return Response.json({ meals: meals.map(mapMeal), waterMl: num(water?.ml), targets: t, goal: auth.user.goal });
});

const macro = z.number().min(0).max(20000);

export const POST = handle(async (req: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const data = await body(
    req,
    z.object({
      day,
      meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      name: z.string().trim().min(1, "Name the food").max(120),
      serving: z.string().trim().max(80).default(""),
      servings: z.number().min(0.05).max(100).default(1),
      kcal: macro,
      protein: macro.default(0),
      carbs: macro.default(0),
      fat: macro.default(0),
    }),
  );
  if (data instanceof Response) return data;
  const row = await queryOne<MealRow>(
    `INSERT INTO meals (user_id, day, meal, name, serving, servings, kcal, protein, carbs, fat)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, meal, name, serving, servings, kcal, protein, carbs, fat, created_at`,
    [auth.user.id, data.day, data.meal, data.name, data.serving, data.servings, data.kcal, data.protein, data.carbs, data.fat],
  );
  return Response.json({ meal: mapMeal(row!) });
});

export const DELETE = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return bad("Not found", 404);
  await query(`DELETE FROM meals WHERE id = $1 AND user_id = $2`, [id, auth.user.id]);
  return Response.json({ ok: true });
});

import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { bad, handle, num } from "@/lib/api";
import { requireUser } from "@/lib/auth";

// Daily totals for charts and energy balance, plus foods you log often (for one-tap re-adding).
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const q = req.nextUrl.searchParams;
  const today = q.get("today") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return bad("Bad date");
  const days = Math.max(1, Math.min(90, Number(q.get("days") ?? 14)));
  const from = new Date(`${today}T12:00:00Z`);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  const fromKey = from.toISOString().slice(0, 10);
  const [totals, recent] = await Promise.all([
    query<{ day: string; kcal: number; protein: number; carbs: number; fat: number; n: number }>(
      `SELECT day, SUM(kcal) AS kcal, SUM(protein) AS protein, SUM(carbs) AS carbs, SUM(fat) AS fat, count(*) AS n
       FROM meals WHERE user_id = $1 AND day >= $2 AND day <= $3 GROUP BY day ORDER BY day`,
      [auth.user.id, fromKey, today],
    ),
    query<{ name: string; serving: string; servings: number; kcal: number; protein: number; carbs: number; fat: number; uses: number }>(
      `SELECT name, (ARRAY_AGG(serving ORDER BY created_at DESC))[1] AS serving,
         (ARRAY_AGG(servings ORDER BY created_at DESC))[1] AS servings,
         (ARRAY_AGG(kcal ORDER BY created_at DESC))[1] AS kcal,
         (ARRAY_AGG(protein ORDER BY created_at DESC))[1] AS protein,
         (ARRAY_AGG(carbs ORDER BY created_at DESC))[1] AS carbs,
         (ARRAY_AGG(fat ORDER BY created_at DESC))[1] AS fat,
         count(*) AS uses
       FROM meals WHERE user_id = $1 AND created_at > now() - interval '60 days'
       GROUP BY name ORDER BY count(*) DESC, MAX(created_at) DESC LIMIT 24`,
      [auth.user.id],
    ),
  ]);
  return Response.json({
    days: totals.map((t) => ({ day: t.day, kcal: num(t.kcal), protein: num(t.protein), carbs: num(t.carbs), fat: num(t.fat), items: num(t.n) })),
    // Per single serving, so re-adding can pick a new amount.
    recent: recent.map((r) => {
      const s = num(r.servings) || 1;
      return { name: r.name, serving: r.serving, kcal: num(r.kcal) / s, protein: num(r.protein) / s, carbs: num(r.carbs) / s, fat: num(r.fat) / s, uses: num(r.uses) };
    }),
  });
});

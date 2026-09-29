import type { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { bad, body, handle, num } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = handle(async () => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const rows = await query<{ day: string; weight_kg: number }>(`SELECT day, weight_kg FROM bodyweights WHERE user_id = $1 ORDER BY day DESC LIMIT 180`, [auth.user.id]);
  return Response.json({ weights: rows.reverse().map((r) => ({ day: r.day, weightKg: num(r.weight_kg) })) });
});

export const POST = handle(async (req: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const data = await body(req, z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weightKg: z.number().min(30).max(300) }));
  if (data instanceof Response) return data;
  await query(
    `INSERT INTO bodyweights (user_id, day, weight_kg) VALUES ($1, $2, $3) ON CONFLICT (user_id, day) DO UPDATE SET weight_kg = $3`,
    [auth.user.id, data.day, data.weightKg],
  );
  // The newest entry is your current bodyweight (used for ranking new sets).
  await query(
    `UPDATE users SET weight_kg = (SELECT weight_kg FROM bodyweights WHERE user_id = $1 ORDER BY day DESC LIMIT 1) WHERE id = $1`,
    [auth.user.id],
  );
  return Response.json({ ok: true });
});

export const DELETE = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const d = req.nextUrl.searchParams.get("day") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return bad("Bad date");
  await query(`DELETE FROM bodyweights WHERE user_id = $1 AND day = $2`, [auth.user.id, d]);
  return Response.json({ ok: true });
});

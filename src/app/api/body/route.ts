import type { NextRequest } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { bad, body, handle, num } from "@/lib/api";
import { isOwner, requireUser, type UserRow } from "@/lib/auth";

type ScanRow = { id: string; height_cm: number; weight_kg: number; body_fat: number; metrics: Record<string, number> | null; skin: string; source: string; created_at: string };

const mapScan = (s: ScanRow) => ({
  id: s.id,
  heightCm: num(s.height_cm),
  weightKg: num(s.weight_kg),
  bodyFat: num(s.body_fat),
  metrics: s.metrics,
  skin: s.skin,
  source: s.source,
  createdAt: s.created_at,
});

// Photos never reach the server: the body scan runs on the phone and only these measurements are saved.
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const username = req.nextUrl.searchParams.get("user");
  let owner: Pick<UserRow, "id" | "share_physique"> = auth.user;
  if (username && username !== auth.user.username) {
    const u = await queryOne<Pick<UserRow, "id" | "share_physique">>(`SELECT id, share_physique FROM users WHERE username = $1`, [username]);
    if (!u) return bad("Player not found", 404);
    if (!u.share_physique && !isOwner(auth.user)) return Response.json({ scans: [], private: true });
    owner = u;
  }
  const scans = await query<ScanRow>(
    `SELECT id, height_cm, weight_kg, body_fat, metrics, skin, source, created_at FROM body_scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [owner.id],
  );
  const weights = await query<{ day: string; weight_kg: number }>(
    `SELECT day, weight_kg FROM bodyweights WHERE user_id = $1 ORDER BY day DESC LIMIT 120`,
    [owner.id],
  );
  return Response.json({ scans: scans.map(mapScan), weights: weights.reverse().map((w) => ({ day: w.day, weightKg: num(w.weight_kg) })) });
});

const ratio = z.number().min(0.01).max(0.6);

export const POST = handle(async (req: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const data = await body(
    req,
    z.object({
      heightCm: z.number().min(100).max(250),
      weightKg: z.number().min(30).max(300),
      bodyFat: z.number().min(0.02).max(0.7),
      metrics: z
        .object({ shoulder: ratio, chest: ratio, waist: ratio, hip: ratio, thigh: ratio.optional(), arm: ratio.optional(), calf: ratio.optional() })
        .nullable()
        .default(null),
      skin: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#c68863"),
      source: z.enum(["photo", "stats"]),
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  );
  if (data instanceof Response) return data;
  const scan = await queryOne<ScanRow>(
    `INSERT INTO body_scans (user_id, height_cm, weight_kg, body_fat, metrics, skin, source) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, height_cm, weight_kg, body_fat, metrics, skin, source, created_at`,
    [auth.user.id, data.heightCm, data.weightKg, data.bodyFat, data.metrics ? JSON.stringify(data.metrics) : null, data.skin, data.source],
  );
  await query(`UPDATE users SET height_cm = $2, weight_kg = $3 WHERE id = $1`, [auth.user.id, data.heightCm, data.weightKg]);
  await query(
    `INSERT INTO bodyweights (user_id, day, weight_kg) VALUES ($1, $2, $3) ON CONFLICT (user_id, day) DO UPDATE SET weight_kg = $3`,
    [auth.user.id, data.day, data.weightKg],
  );
  return Response.json({ scan: mapScan(scan!) });
});

export const DELETE = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return bad("Not found", 404);
  await query(`DELETE FROM body_scans WHERE id = $1 AND user_id = $2`, [id, auth.user.id]);
  return Response.json({ ok: true });
});

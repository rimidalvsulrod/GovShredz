import { z } from "zod";
import { queryOne } from "@/lib/db";
import { body, handle, num } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const POST = handle(async (req: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const data = await body(req, z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ml: z.number().int().min(0).max(20000) }));
  if (data instanceof Response) return data;
  const row = await queryOne<{ ml: number }>(
    `INSERT INTO water (user_id, day, ml) VALUES ($1, $2, $3) ON CONFLICT (user_id, day) DO UPDATE SET ml = $3 RETURNING ml`,
    [auth.user.id, data.day, data.ml],
  );
  return Response.json({ waterMl: num(row?.ml) });
});

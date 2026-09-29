import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { bad, body, handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const POST = handle(async (req: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const data = await body(req, z.object({ username: z.string().max(40), follow: z.boolean() }));
  if (data instanceof Response) return data;
  const u = await queryOne<{ id: string }>(`SELECT id FROM users WHERE username = $1`, [data.username]);
  if (!u || u.id === auth.user.id) return bad("Player not found", 404);
  if (data.follow) await query(`INSERT INTO follows (follower, followee) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [auth.user.id, u.id]);
  else await query(`DELETE FROM follows WHERE follower = $1 AND followee = $2`, [auth.user.id, u.id]);
  return Response.json({ following: data.follow });
});

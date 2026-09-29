import type { NextRequest } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { bad, body, handle } from "@/lib/api";
import { isOwner, requireUser } from "@/lib/auth";
import { loadChallenges } from "@/lib/challenges";

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/challenges/[id]">) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return bad("Not found", 404);
  const [c] = await loadChallenges(`c.id = $1`, [id]);
  if (!c) return bad("Challenge not found", 404);
  if (!c.players.some((p) => p.id === auth.user.id) && !isOwner(auth.user)) return bad("You're not in this challenge.", 403);
  return Response.json({ challenge: c });
});

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/challenges/[id]">) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return bad("Not found", 404);
  const data = await body(req, z.object({ action: z.enum(["accept", "decline", "cancel"]) }));
  if (data instanceof Response) return data;
  const c = await queryOne<{ creator: string }>(`SELECT creator FROM challenges WHERE id = $1`, [id]);
  if (!c) return bad("Challenge not found", 404);
  if (data.action === "cancel") {
    if (c.creator !== auth.user.id) return bad("Only the creator can cancel.", 403);
    await query(`UPDATE challenges SET cancelled = true WHERE id = $1`, [id]);
  } else {
    const rows = await query(
      `UPDATE challenge_players SET status = $3 WHERE challenge_id = $1 AND user_id = $2 AND status = 'invited' RETURNING 1`,
      [id, auth.user.id, data.action === "accept" ? "accepted" : "declined"],
    );
    if (!rows.length) return bad("No pending invite.");
  }
  return Response.json({ ok: true });
});

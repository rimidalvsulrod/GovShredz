import type { NextRequest } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { bad, body, handle, num } from "@/lib/api";
import { rateLimit, requireUser } from "@/lib/auth";

type Msg = { id: string; body: string; created_at: string; user_id: string; username: string; name: string; color: string };
const map = (m: Msg) => ({ id: num(m.id), body: m.body, createdAt: m.created_at, user: { id: m.user_id, username: m.username, name: m.name, color: m.color } });

// The squad's group chat ("Locker Room"). Polled while open.
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const after = Number(req.nextUrl.searchParams.get("after") ?? 0);
  const rows = after
    ? await query<Msg>(
        `SELECT m.id, m.body, m.created_at, u.id AS user_id, u.username, u.name, u.color FROM chat_messages m JOIN users u ON u.id = m.user_id
         WHERE NOT m.deleted AND m.id > $1 ORDER BY m.id LIMIT 100`,
        [after],
      )
    : (
        await query<Msg>(
          `SELECT m.id, m.body, m.created_at, u.id AS user_id, u.username, u.name, u.color FROM chat_messages m JOIN users u ON u.id = m.user_id
           WHERE NOT m.deleted ORDER BY m.id DESC LIMIT 80`,
        )
      ).reverse();
  return Response.json({ messages: rows.map(map), muted: auth.user.chat_muted });
});

export const POST = handle(async (req: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.chat_muted) return bad("You've been muted in the Locker Room.", 403);
  const data = await body(req, z.object({ body: z.string().trim().min(1).max(1000) }));
  if (data instanceof Response) return data;
  if (!(await rateLimit(`chat:${auth.user.id}`, 20, 60))) return bad("Slow down a little.", 429);
  const m = await queryOne<Msg>(
    `WITH ins AS (INSERT INTO chat_messages (user_id, body) VALUES ($1, $2) RETURNING id, body, created_at, user_id)
     SELECT ins.id, ins.body, ins.created_at, u.id AS user_id, u.username, u.name, u.color FROM ins JOIN users u ON u.id = ins.user_id`,
    [auth.user.id, data.body],
  );
  return Response.json({ message: map(m!) });
});

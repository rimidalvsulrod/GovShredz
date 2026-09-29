import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { bad, body, handle, num } from "@/lib/api";
import { OWNER_EMAIL, rateLimit, requireUser } from "@/lib/auth";
import { noticeEmail, sendEmail } from "@/lib/email";

type Row = { id: string; from_admin: boolean; body: string; created_at: string; read_at: string | null };
const map = (r: Row) => ({ id: num(r.id), fromAdmin: r.from_admin, body: r.body, createdAt: r.created_at });

// A private thread between each player and the admin.
export const GET = handle(async () => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const rows = await query<Row>(`SELECT id, from_admin, body, created_at, read_at FROM support_messages WHERE user_id = $1 ORDER BY id`, [auth.user.id]);
  await query(`UPDATE support_messages SET read_at = now() WHERE user_id = $1 AND from_admin AND read_at IS NULL`, [auth.user.id]);
  return Response.json({ messages: rows.map(map) });
});

export const POST = handle(async (req: Request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const data = await body(req, z.object({ body: z.string().trim().min(1, "Write a message").max(2000) }));
  if (data instanceof Response) return data;
  if (!(await rateLimit(`support:${auth.user.id}`, 10, 600))) return bad("Too many messages. Try again soon.", 429);
  const r = await queryOne<Row>(
    `INSERT INTO support_messages (user_id, from_admin, body) VALUES ($1, false, $2) RETURNING id, from_admin, body, created_at, read_at`,
    [auth.user.id, data.body],
  );
  // Let the admin know by email (best effort).
  sendEmail({
    to: OWNER_EMAIL,
    ...noticeEmail({ subject: `GovShredz message from @${auth.user.username}`, heading: `@${auth.user.username} wrote:`, body: data.body }),
  }).catch(() => {});
  return Response.json({ message: map(r!) });
});

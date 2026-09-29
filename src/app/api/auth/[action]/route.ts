import bcrypt from "bcryptjs";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { bad, body, usernameSchema } from "@/lib/api";
import { checkCode, clientIp, currentUserRow, endSession, issueCode, publicMe, rateLimit, startSession, USER_COLS, type UserRow } from "@/lib/auth";
import { codeEmail, sendEmail } from "@/lib/email";
import { audit, getSettings } from "@/lib/settings";

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(200);
const password = z.string().min(8, "Password must be at least 8 characters").max(200);
const code = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

type Row = UserRow & { password_hash: string };
const ALL = `${USER_COLS}, password_hash`;

const COLORS = ["#c8ff2e", "#2ee6ff", "#ff4d2e", "#b36bff", "#ffd23f", "#ff5ea8", "#3dffa2"];

async function sendCode(user: { id: string; email: string; name: string }, purpose: "verify" | "reset") {
  const c = await issueCode(user.id, purpose);
  return sendEmail({ to: user.email, ...codeEmail({ name: user.name, code: c, purpose }) });
}

const handlers: Record<string, (req: Request) => Promise<Response>> = {
  async signup(req) {
    const data = await body(
      req,
      z.object({
        name: z.string().trim().min(1, "Enter your name").max(60),
        username: usernameSchema,
        email,
        password,
        invite: z.string().trim().max(100).optional(),
      }),
    );
    if (data instanceof Response) return data;
    if (!(await rateLimit(`signup:${await clientIp()}`, 8, 3600))) return bad("Too many attempts. Try again later.", 429);
    const settings = await getSettings();
    const bootstrap = !(await queryOne(`SELECT 1 FROM users LIMIT 1`));
    if (!bootstrap && settings.registration === "closed") return bad("Sign-ups are closed right now.", 403);
    if (!bootstrap && settings.registration === "invite" && data.invite !== settings.inviteCode) return bad("That invite code isn't right.", 403);
    if (await queryOne(`SELECT 1 FROM users WHERE email = $1`, [data.email])) return bad("An account with this email already exists. Sign in instead.", 409);
    if (await queryOne(`SELECT 1 FROM users WHERE username = $1`, [data.username])) return bad("That username is taken.", 409);
    const hash = await bcrypt.hash(data.password, 11);
    const user = await queryOne<Row>(
      `INSERT INTO users (email, username, name, password_hash, color) VALUES ($1, $2, $3, $4, $5) RETURNING ${ALL}`,
      [data.email, data.username, data.name, hash, COLORS[Math.floor(Math.random() * COLORS.length)]],
    );
    await startSession(user!.id, user!.session_version);
    const sent = await sendCode(user!, "verify");
    await audit("signup", data.email, `@${data.username}`, await clientIp());
    return Response.json({ user: publicMe(user!), emailSent: sent.ok });
  },

  async login(req) {
    const data = await body(req, z.object({ email: z.string().trim().toLowerCase().min(1, "Enter your email or username").max(200), password: z.string().min(1, "Enter your password").max(200) }));
    if (data instanceof Response) return data;
    if (!(await rateLimit(`login:${data.email}`, 10, 900))) return bad("Too many attempts. Try again in a few minutes.", 429);
    const user = await queryOne<Row>(`SELECT ${ALL} FROM users WHERE email = $1 OR username = $1`, [data.email]);
    if (!user || !(await bcrypt.compare(data.password, user.password_hash))) return bad("Incorrect email or password.", 401);
    if (user.banned) return bad("This account has been suspended.", 403);
    await startSession(user.id, user.session_version);
    return Response.json({ user: publicMe(user) });
  },

  async logout() {
    await endSession();
    return Response.json({ ok: true });
  },

  async verify(req) {
    const data = await body(req, z.object({ code }));
    if (data instanceof Response) return data;
    const user = await currentUserRow();
    if (!user) return bad("Sign in required", 401);
    if (user.email_verified_at) return Response.json({ user: publicMe(user) });
    const result = await checkCode(user.id, "verify", data.code);
    if (result === "expired") return bad("That code has expired. Send a new one.");
    if (result === "locked") return bad("Too many incorrect attempts. Send a new code.");
    if (result === "invalid") return bad("That code isn't right. Check your email and try again.");
    const updated = await queryOne<UserRow>(`UPDATE users SET email_verified_at = now() WHERE id = $1 RETURNING ${USER_COLS}`, [user.id]);
    return Response.json({ user: publicMe(updated!) });
  },

  async resend() {
    const user = await currentUserRow();
    if (!user) return bad("Sign in required", 401);
    if (user.email_verified_at) return Response.json({ ok: true });
    if (!(await rateLimit(`resend:${user.id}`, 5, 3600))) return bad("Too many emails sent. Try again later.", 429);
    const sent = await sendCode(user, "verify");
    return sent.ok ? Response.json({ ok: true }) : bad("We couldn't send the email. Try again shortly.", 502);
  },

  async forgot(req) {
    const data = await body(req, z.object({ email }));
    if (data instanceof Response) return data;
    if (!(await rateLimit(`forgot:${data.email}`, 5, 3600))) return bad("Too many requests. Try again later.", 429);
    const user = await queryOne<Row>(`SELECT ${ALL} FROM users WHERE email = $1`, [data.email]);
    if (user) await sendCode(user, "reset");
    // Same response either way so emails can't be enumerated.
    return Response.json({ ok: true });
  },

  async reset(req) {
    const data = await body(req, z.object({ email, code, password }));
    if (data instanceof Response) return data;
    const user = await queryOne<Row>(`SELECT ${ALL} FROM users WHERE email = $1`, [data.email]);
    if (!user) return bad("That code isn't right.");
    const result = await checkCode(user.id, "reset", data.code);
    if (result !== "ok") return bad(result === "invalid" ? "That code isn't right." : "That code has expired. Request a new one.");
    const hash = await bcrypt.hash(data.password, 11);
    // A reset proves inbox access, so it also verifies the email; bumping the version signs out other devices.
    const updated = await queryOne<Row>(
      `UPDATE users SET password_hash = $2, session_version = session_version + 1, email_verified_at = COALESCE(email_verified_at, now())
       WHERE id = $1 RETURNING ${ALL}`,
      [user.id, hash],
    );
    await startSession(updated!.id, updated!.session_version);
    return Response.json({ user: publicMe(updated!) });
  },

  async password(req) {
    const data = await body(req, z.object({ current: z.string().min(1), password }));
    if (data instanceof Response) return data;
    const me = await currentUserRow();
    if (!me) return bad("Sign in required", 401);
    const row = await queryOne<Row>(`SELECT ${ALL} FROM users WHERE id = $1`, [me.id]);
    if (!(await bcrypt.compare(data.current, row!.password_hash))) return bad("Your current password is incorrect.");
    const hash = await bcrypt.hash(data.password, 11);
    const updated = await queryOne<Row>(`UPDATE users SET password_hash = $2, session_version = session_version + 1 WHERE id = $1 RETURNING ${ALL}`, [me.id, hash]);
    await startSession(updated!.id, updated!.session_version);
    return Response.json({ ok: true });
  },

  async delete(req) {
    const data = await body(req, z.object({ password: z.string().min(1, "Enter your password") }));
    if (data instanceof Response) return data;
    const me = await currentUserRow();
    if (!me) return bad("Sign in required", 401);
    const row = await queryOne<Row>(`SELECT ${ALL} FROM users WHERE id = $1`, [me.id]);
    if (!(await bcrypt.compare(data.password, row!.password_hash))) return bad("Incorrect password.");
    await query(`DELETE FROM users WHERE id = $1`, [me.id]);
    await audit("account_deleted", me.email, "by owner");
    await endSession();
    return Response.json({ ok: true });
  },
};

export async function POST(req: Request, ctx: RouteContext<"/api/auth/[action]">) {
  const { action } = await ctx.params;
  const handler = handlers[action];
  if (!handler) return bad("Not found", 404);
  try {
    return await handler(req);
  } catch (e) {
    console.error(`auth/${action}`, e);
    return bad("Something went wrong. Please try again.", 500);
  }
}

// GET /api/auth/config → what the sign-up form needs to know.
export async function GET(_req: Request, ctx: RouteContext<"/api/auth/[action]">) {
  const { action } = await ctx.params;
  if (action !== "config") return bad("Not found", 404);
  const s = await getSettings().catch(() => null);
  return Response.json({ registration: s?.registration ?? "open" });
}

import "server-only";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomInt } from "node:crypto";
import { query, queryOne } from "./db";
import { trackIp } from "./ips";
import type { Unit } from "@/shared/units";
import type { Sex } from "@/shared/ranks";
import type { Goal } from "@/shared/physique";

/** The only account that can open the admin panel (once its email is verified). */
export const OWNER_EMAIL = "vladimirdorlus08@gmail.com";

export const SESSION_COOKIE = "gs_session";
const SESSION_TTL = 60 * 60 * 24 * 180;

export type UserRow = {
  id: string;
  email: string;
  username: string;
  name: string;
  email_verified_at: string | null;
  session_version: number;
  banned: boolean;
  chat_muted: boolean;
  onboarded: boolean;
  sex: Sex;
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  unit: Unit;
  goal: Goal;
  kcal_target: number | null;
  protein_target: number | null;
  bio: string;
  color: string;
  public_workouts: boolean;
  share_physique: boolean;
  created_at: string;
};

export const USER_COLS =
  "id, email, username, name, email_verified_at, session_version, banned, chat_muted, onboarded, sex, birth_year, height_cm, weight_kg, unit, goal, kcal_target, protein_target, bio, color, public_workouts, share_physique, created_at";

export const isOwner = (u: { email: string; email_verified_at: string | null }) =>
  u.email.toLowerCase() === OWNER_EMAIL && !!u.email_verified_at;

// Without AUTH_SECRET the key is derived from the database URL (which is itself secret),
// so a deploy only needs DATABASE_URL + RESEND_API_KEY to work.
let cachedKey: Uint8Array | null = null;
function key() {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!secret && process.env.VERCEL) throw new Error("AUTH_SECRET is not configured.");
  cachedKey = new Uint8Array(createHash("sha256").update(`govshredz-session:${secret ?? "local-dev"}`).digest());
  return cachedKey;
}

export function secretKeyMaterial() {
  return Buffer.from(key());
}

async function readSession(): Promise<{ sub: string; ver: number } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, ver: typeof payload.ver === "number" ? payload.ver : 1 };
  } catch {
    return null;
  }
}

export async function currentUserRow(): Promise<UserRow | null> {
  const s = await readSession();
  if (!s) return null;
  const row = await queryOne<UserRow>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [s.sub]);
  if (!row || row.session_version !== s.ver) return null;
  await trackIp(row.id);
  return row;
}

export function age(u: Pick<UserRow, "birth_year">) {
  return u.birth_year ? Math.max(13, new Date().getFullYear() - u.birth_year) : 30;
}

/** What the browser gets to know about the signed-in user. */
export function publicMe(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    verified: !!u.email_verified_at,
    onboarded: u.onboarded,
    sex: u.sex,
    birthYear: u.birth_year,
    age: age(u),
    heightCm: u.height_cm,
    weightKg: u.weight_kg,
    unit: u.unit,
    goal: u.goal,
    kcalTarget: u.kcal_target,
    proteinTarget: u.protein_target,
    bio: u.bio,
    color: u.color,
    publicWorkouts: u.public_workouts,
    sharePhysique: u.share_physique,
    chatMuted: u.chat_muted,
    isAdmin: isOwner(u),
    createdAt: u.created_at,
  };
}
export type Me = ReturnType<typeof publicMe>;

type Fail = { error: Response };
const fail = (error: string, status: number): Fail => ({ error: Response.json({ error }, { status }) });

/** For app data routes: signed in, verified and not suspended. */
export async function requireUser(): Promise<{ user: UserRow } | Fail> {
  const user = await currentUserRow();
  if (!user) return fail("Sign in required", 401);
  if (!user.email_verified_at) return fail("Verify your email first", 403);
  if (user.banned) return fail("This account has been suspended.", 403);
  return { user };
}

export async function requireAdmin(): Promise<{ user: UserRow } | Fail> {
  const user = await currentUserRow();
  if (!user) return fail("Sign in required", 401);
  if (!isOwner(user)) return fail("Not allowed", 403);
  return { user };
}

export async function startSession(userId: string, ver: number) {
  await trackIp(userId, true);
  const token = await new SignJWT({ ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(key());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/* ------------------------------ email codes ------------------------------- */

const hashCode = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");

export async function issueCode(userId: string, purpose: "verify" | "reset"): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await query(
    `INSERT INTO email_codes (user_id, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '15 minutes')
     ON CONFLICT (user_id, purpose) DO UPDATE SET code_hash = $3, attempts = 0, expires_at = now() + interval '15 minutes', created_at = now()`,
    [userId, purpose, hashCode(userId, code)],
  );
  return code;
}

export async function checkCode(userId: string, purpose: "verify" | "reset", code: string): Promise<"ok" | "invalid" | "expired" | "locked"> {
  const row = await queryOne<{ code_hash: string; attempts: number; expired: boolean }>(
    `SELECT code_hash, attempts, expires_at < now() AS expired FROM email_codes WHERE user_id = $1 AND purpose = $2`,
    [userId, purpose],
  );
  if (!row || row.expired) return "expired";
  if (row.attempts >= 5) return "locked";
  if (row.code_hash !== hashCode(userId, code.trim())) {
    await query(`UPDATE email_codes SET attempts = attempts + 1 WHERE user_id = $1 AND purpose = $2`, [userId, purpose]);
    return "invalid";
  }
  await query(`DELETE FROM email_codes WHERE user_id = $1 AND purpose = $2`, [userId, purpose]);
  return "ok";
}

/* ------------------------------- rate limits ------------------------------ */

export async function rateLimit(k: string, limit: number, windowSec: number): Promise<boolean> {
  const row = await queryOne<{ count: number }>(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES ($1, 1, now() + make_interval(secs => $2))
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.reset_at < now() THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at < now() THEN now() + make_interval(secs => $2) ELSE rate_limits.reset_at END
     RETURNING count`,
    [k, windowSec],
  );
  return (row?.count ?? 0) <= limit;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbKind, query, queryOne } from "@/lib/db";
import { bad, body, handle, num, usernameSchema } from "@/lib/api";
import { clientIp, issueCode, OWNER_EMAIL, requireAdmin, USER_COLS, type UserRow } from "@/lib/auth";
import { codeEmail, emailConfigured, noticeEmail, sendEmail } from "@/lib/email";
import { audit, getSettings, saveSettings, secretStatus, setSecret } from "@/lib/settings";
import { allBests, bestsFor, overallScore } from "@/lib/stats";
import { listWorkouts } from "@/lib/workouts";
import { loadChallenges } from "@/lib/challenges";

// Admin panel API. Every route checks that the caller is the verified owner account.

type Ctx = RouteContext<"/api/admin/[...path]">;

const USER_LIST = `SELECT u.id, u.email, u.username, u.name, u.color, u.sex, u.email_verified_at, u.banned, u.chat_muted, u.onboarded, u.created_at,
  (SELECT count(*) FROM workouts w WHERE w.user_id = u.id) AS workouts,
  (SELECT count(*) FROM meals m WHERE m.user_id = u.id) AS meals,
  (SELECT count(*) FROM body_scans b WHERE b.user_id = u.id) AS scans,
  li.ip AS last_ip, li.country AS last_country, li.city AS last_city, li.last_seen
  FROM users u
  LEFT JOIN LATERAL (SELECT ip, country, city, last_seen FROM user_ips i WHERE i.user_id = u.id ORDER BY last_seen DESC LIMIT 1) li ON true`;

type ListRow = {
  id: string;
  email: string;
  username: string;
  name: string;
  color: string;
  sex: "male" | "female";
  email_verified_at: string | null;
  banned: boolean;
  chat_muted: boolean;
  onboarded: boolean;
  created_at: string;
  workouts: number;
  meals: number;
  scans: number;
  last_ip: string | null;
  last_country: string | null;
  last_city: string | null;
  last_seen: string | null;
};

const summary = (u: ListRow, score = 0) => ({
  id: u.id,
  email: u.email,
  username: u.username,
  name: u.name,
  color: u.color,
  verified: !!u.email_verified_at,
  banned: u.banned,
  chatMuted: u.chat_muted,
  onboarded: u.onboarded,
  createdAt: u.created_at,
  workouts: num(u.workouts),
  meals: num(u.meals),
  scans: num(u.scans),
  lastIp: u.last_ip,
  lastCountry: u.last_country,
  lastCity: u.last_city,
  lastSeen: u.last_seen,
  score,
  isOwner: u.email.toLowerCase() === OWNER_EMAIL,
});

const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v == null ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
};

export const GET = handle(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const [section, id] = (await ctx.params).path;
  const q = req.nextUrl.searchParams;

  if (section === "stats") {
    const [c] = await query<Record<string, string>>(
      `SELECT
        (SELECT count(*) FROM users) AS users,
        (SELECT count(*) FROM users WHERE email_verified_at IS NOT NULL) AS verified,
        (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days') AS new7,
        (SELECT count(*) FROM users WHERE banned) AS banned,
        (SELECT count(DISTINCT user_id) FROM user_ips WHERE last_seen > now() - interval '1 day') AS active24,
        (SELECT count(DISTINCT user_id) FROM user_ips WHERE last_seen > now() - interval '7 days') AS active7,
        (SELECT count(DISTINCT ip) FROM user_ips) AS ips,
        (SELECT count(*) FROM workouts) AS workouts,
        (SELECT count(*) FROM sets) AS sets,
        (SELECT COALESCE(SUM(volume_kg), 0) FROM workouts) AS volume,
        (SELECT count(*) FROM sets WHERE is_pr) AS prs,
        (SELECT count(*) FROM meals) AS meals,
        (SELECT count(*) FROM body_scans) AS scans,
        (SELECT count(*) FROM challenges) AS challenges,
        (SELECT count(*) FROM chat_messages) AS chat,
        (SELECT count(*) FROM support_messages WHERE NOT from_admin AND read_at IS NULL) AS unread`,
    );
    const [signups, workouts, activity] = await Promise.all([
      query<{ d: string; n: string }>(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS d, count(*) AS n FROM users WHERE created_at > now() - interval '14 days' GROUP BY 1 ORDER BY 1`,
      ),
      query<{ d: string; n: string }>(
        `SELECT to_char(date_trunc('day', started_at), 'YYYY-MM-DD') AS d, count(*) AS n FROM workouts WHERE started_at > now() - interval '14 days' GROUP BY 1 ORDER BY 1`,
      ),
      query<{ kind: string; at: string; username: string; user_id: string; label: string }>(
        `(SELECT 'signup' AS kind, u.created_at AS at, u.username, u.id AS user_id, u.email AS label FROM users u ORDER BY u.created_at DESC LIMIT 10)
         UNION ALL
         (SELECT 'workout', w.created_at, u.username, u.id, w.title || ' · ' || w.set_count || ' sets' FROM workouts w JOIN users u ON u.id = w.user_id ORDER BY w.created_at DESC LIMIT 15)
         UNION ALL
         (SELECT 'meal', m.created_at, u.username, u.id, m.name || ' · ' || round(m.kcal) || ' kcal' FROM meals m JOIN users u ON u.id = m.user_id ORDER BY m.created_at DESC LIMIT 15)
         UNION ALL
         (SELECT 'scan', b.created_at, u.username, u.id, round(b.body_fat * 100) || '% body fat' FROM body_scans b JOIN users u ON u.id = b.user_id ORDER BY b.created_at DESC LIMIT 5)
         ORDER BY at DESC LIMIT 30`,
      ),
    ]);
    return Response.json({
      counts: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)])),
      signups: signups.map((s) => ({ day: s.d, n: Number(s.n) })),
      workouts: workouts.map((s) => ({ day: s.d, n: Number(s.n) })),
      activity,
      system: { db: await dbKind(), email: await emailConfigured() },
    });
  }

  if (section === "users" && !id) {
    const term = (q.get("q") ?? "").trim();
    const [rows, bests] = await Promise.all([
      query<ListRow>(
        `${USER_LIST} WHERE ($1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.name ILIKE '%' || $1 || '%' OR u.username ILIKE '%' || $1 || '%'
           OR EXISTS (SELECT 1 FROM user_ips s WHERE s.user_id = u.id AND s.ip LIKE $1 || '%'))
         ORDER BY u.created_at DESC LIMIT 200`,
        [term],
      ),
      allBests(),
    ]);
    return Response.json({ users: rows.map((r) => summary(r, overallScore(bests.get(r.id), r.sex))) });
  }

  if (section === "users" && id) {
    const [row, u] = await Promise.all([
      queryOne<ListRow>(`${USER_LIST} WHERE u.id = $1`, [id]),
      queryOne<UserRow & { admin_note: string }>(`SELECT ${USER_COLS}, admin_note FROM users WHERE id = $1`, [id]),
    ]);
    if (!row || !u) return bad("User not found", 404);
    const [bests, workouts, meals, water, weights, scans, ips, chat, support, challenges, followers, following, records] = await Promise.all([
      bestsFor(id),
      listWorkouts("w.user_id = $1", [id], auth.user.id, 50),
      query(`SELECT id, day, meal, name, serving, servings, kcal, protein, carbs, fat, created_at FROM meals WHERE user_id = $1 ORDER BY day DESC, created_at DESC LIMIT 500`, [id]),
      query(`SELECT day, ml FROM water WHERE user_id = $1 ORDER BY day DESC LIMIT 60`, [id]),
      query(`SELECT day, weight_kg FROM bodyweights WHERE user_id = $1 ORDER BY day DESC LIMIT 120`, [id]),
      query(`SELECT id, height_cm, weight_kg, body_fat, metrics, skin, source, created_at FROM body_scans WHERE user_id = $1 ORDER BY created_at DESC`, [id]),
      query(
        `SELECT ip, first_seen, last_seen, hits, user_agent, country, region, city,
           (SELECT count(*) FROM user_ips o WHERE o.ip = i.ip AND o.user_id <> i.user_id)::int AS shared
         FROM user_ips i WHERE i.user_id = $1 ORDER BY last_seen DESC LIMIT 200`,
        [id],
      ),
      query(`SELECT id, body, deleted, created_at FROM chat_messages WHERE user_id = $1 ORDER BY id DESC LIMIT 100`, [id]),
      query(`SELECT id, from_admin, body, created_at FROM support_messages WHERE user_id = $1 ORDER BY id`, [id]),
      loadChallenges(`EXISTS (SELECT 1 FROM challenge_players cp WHERE cp.challenge_id = c.id AND cp.user_id = $1)`, [id]),
      query(`SELECT u.username FROM follows f JOIN users u ON u.id = f.follower WHERE f.followee = $1`, [id]),
      query(`SELECT u.username FROM follows f JOIN users u ON u.id = f.followee WHERE f.follower = $1`, [id]),
      query(
        `SELECT DISTINCT ON (exercise) exercise, e1rm_kg, weight_kg, reps, metric, done_at FROM sets WHERE user_id = $1 ORDER BY exercise, metric DESC, e1rm_kg DESC`,
        [id],
      ),
    ]);
    return Response.json({
      user: {
        ...summary(row, overallScore(bests, u.sex)),
        adminNote: u.admin_note,
        sex: u.sex,
        birthYear: u.birth_year,
        heightCm: u.height_cm,
        weightKg: u.weight_kg,
        unit: u.unit,
        goal: u.goal,
        kcalTarget: u.kcal_target,
        proteinTarget: u.protein_target,
        bio: u.bio,
        publicWorkouts: u.public_workouts,
        sharePhysique: u.share_physique,
      },
      bests,
      records,
      workouts,
      meals,
      water,
      weights,
      scans,
      ips,
      chat,
      support,
      challenges,
      followers: followers.map((f) => (f as { username: string }).username),
      following: following.map((f) => (f as { username: string }).username),
    });
  }

  if (section === "ips") {
    const ip = (q.get("ip") ?? "").trim();
    if (!ip) return bad("Missing ip");
    const rows = await query(
      `SELECT u.id, u.email, u.username, u.name, u.banned, i.first_seen, i.last_seen, i.hits, i.user_agent, i.country, i.region, i.city
       FROM user_ips i JOIN users u ON u.id = i.user_id WHERE i.ip = $1 ORDER BY i.last_seen DESC`,
      [ip],
    );
    return Response.json({ ip, accounts: rows });
  }

  if (section === "support" && !id) {
    const threads = await query(
      `SELECT u.id, u.username, u.name, u.color, u.email,
         (SELECT body FROM support_messages s WHERE s.user_id = u.id ORDER BY id DESC LIMIT 1) AS last,
         (SELECT created_at FROM support_messages s WHERE s.user_id = u.id ORDER BY id DESC LIMIT 1) AS last_at,
         (SELECT count(*) FROM support_messages s WHERE s.user_id = u.id AND NOT from_admin AND read_at IS NULL)::int AS unread
       FROM users u WHERE EXISTS (SELECT 1 FROM support_messages s WHERE s.user_id = u.id) ORDER BY last_at DESC`,
    );
    return Response.json({ threads });
  }

  if (section === "support" && id) {
    const [user, messages] = await Promise.all([
      queryOne(`SELECT id, username, name, color, email FROM users WHERE id = $1`, [id]),
      query(`SELECT id, from_admin, body, created_at FROM support_messages WHERE user_id = $1 ORDER BY id`, [id]),
    ]);
    await query(`UPDATE support_messages SET read_at = now() WHERE user_id = $1 AND NOT from_admin AND read_at IS NULL`, [id]);
    return Response.json({ user, messages });
  }

  if (section === "chat") {
    const messages = await query(
      `SELECT m.id, m.body, m.deleted, m.created_at, u.id AS user_id, u.username, u.name, u.color, u.chat_muted
       FROM chat_messages m JOIN users u ON u.id = m.user_id ORDER BY m.id DESC LIMIT 300`,
    );
    return Response.json({ messages });
  }

  if (section === "announcements") return Response.json({ announcements: await query(`SELECT * FROM announcements ORDER BY id DESC LIMIT 50`) });
  if (section === "notes") return Response.json({ notes: await query(`SELECT * FROM admin_notes ORDER BY updated_at DESC`) });
  if (section === "audit") return Response.json({ log: await query(`SELECT * FROM audit_log ORDER BY id DESC LIMIT 300`) });

  if (section === "settings") {
    return Response.json({ settings: await getSettings(), secrets: await secretStatus(), emailFromEnv: process.env.EMAIL_FROM ?? null });
  }

  if (section === "export") {
    const which = id ?? "users";
    const sqls: Record<string, string> = {
      users: `SELECT u.id, u.email, u.username, u.name, u.sex, u.birth_year, u.height_cm, u.weight_kg, u.goal, u.email_verified_at, u.banned, u.created_at,
                (SELECT ip FROM user_ips i WHERE i.user_id = u.id ORDER BY last_seen DESC LIMIT 1) AS last_ip,
                (SELECT count(*) FROM workouts w WHERE w.user_id = u.id) AS workouts FROM users u ORDER BY u.created_at`,
      workouts: `SELECT u.username, w.day, w.title, e.exercise, e.set_no, e.weight_kg, e.reps, e.e1rm_kg, e.is_pr, w.bw_kg
                 FROM sets e JOIN workouts w ON w.id = e.workout_id JOIN users u ON u.id = w.user_id ORDER BY w.started_at, e.position, e.set_no`,
      meals: `SELECT u.username, m.day, m.meal, m.name, m.serving, m.servings, m.kcal, m.protein, m.carbs, m.fat
              FROM meals m JOIN users u ON u.id = m.user_id ORDER BY m.day, m.created_at`,
      ips: `SELECT u.username, u.email, i.ip, i.country, i.region, i.city, i.first_seen, i.last_seen, i.hits, i.user_agent
            FROM user_ips i JOIN users u ON u.id = i.user_id ORDER BY i.last_seen DESC`,
    };
    if (!sqls[which]) return bad("Unknown export", 404);
    const rows = await query<Record<string, unknown>>(sqls[which]);
    await audit("export", which, `${rows.length} rows`, await clientIp());
    return new Response(csv(rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="govshredz-${which}.csv"` },
    });
  }

  return bad("Not found", 404);
});

const userAction = z.object({
  action: z.enum([
    "verify",
    "unverify",
    "signout",
    "ban",
    "unban",
    "mute",
    "unmute",
    "delete",
    "rename",
    "set_password",
    "send_reset",
    "note",
    "set_stats",
    "delete_workout",
    "delete_meal",
    "delete_scan",
    "clear_chat",
  ]),
  name: z.string().trim().min(1).max(60).optional(),
  username: usernameSchema.optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200).optional(),
  note: z.string().max(5000).optional(),
  heightCm: z.number().min(100).max(250).optional(),
  weightKg: z.number().min(30).max(300).optional(),
  sex: z.enum(["male", "female"]).optional(),
  targetId: z.string().uuid().optional(),
});

export const POST = handle(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const [section, id] = (await ctx.params).path;
  const ip = await clientIp();

  if (section === "users" && id) {
    const data = await body(req, userAction);
    if (data instanceof Response) return data;
    const target = await queryOne<{ email: string; name: string; username: string }>(`SELECT email, name, username FROM users WHERE id = $1`, [id]);
    if (!target) return bad("User not found", 404);
    if (id === auth.user.id && ["ban", "delete", "mute", "unverify"].includes(data.action)) return bad("You can't do that to your own account.");
    const a = data.action;
    if (a === "rename") {
      if (data.username && (await queryOne(`SELECT 1 FROM users WHERE username = $1 AND id <> $2`, [data.username, id]))) return bad("That username is taken.");
      await query(`UPDATE users SET name = COALESCE($2, name), username = COALESCE($3, username) WHERE id = $1`, [id, data.name ?? null, data.username ?? null]);
    } else if (a === "set_password") {
      if (!data.password) return bad("Enter a password");
      await query(`UPDATE users SET password_hash = $2, session_version = session_version + 1 WHERE id = $1`, [id, await bcrypt.hash(data.password, 11)]);
    } else if (a === "send_reset") {
      const code = await issueCode(id, "reset");
      const sent = await sendEmail({ to: target.email, ...codeEmail({ name: target.name, code, purpose: "reset" }) });
      if (!sent.ok) return bad(sent.error ?? "Email failed", 502);
    } else if (a === "note") {
      await query(`UPDATE users SET admin_note = $2 WHERE id = $1`, [id, data.note ?? ""]);
    } else if (a === "set_stats") {
      await query(`UPDATE users SET height_cm = COALESCE($2, height_cm), weight_kg = COALESCE($3, weight_kg), sex = COALESCE($4, sex) WHERE id = $1`, [
        id,
        data.heightCm ?? null,
        data.weightKg ?? null,
        data.sex ?? null,
      ]);
    } else if (a === "delete_workout" || a === "delete_meal" || a === "delete_scan") {
      if (!data.targetId) return bad("Missing item");
      const table = { delete_workout: "workouts", delete_meal: "meals", delete_scan: "body_scans" }[a];
      await query(`DELETE FROM ${table} WHERE id = $1 AND user_id = $2`, [data.targetId, id]);
    } else {
      const sql: Record<string, string> = {
        verify: `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1`,
        unverify: `UPDATE users SET email_verified_at = NULL WHERE id = $1`,
        signout: `UPDATE users SET session_version = session_version + 1 WHERE id = $1`,
        ban: `UPDATE users SET banned = true, session_version = session_version + 1 WHERE id = $1`,
        unban: `UPDATE users SET banned = false WHERE id = $1`,
        mute: `UPDATE users SET chat_muted = true WHERE id = $1`,
        unmute: `UPDATE users SET chat_muted = false WHERE id = $1`,
        delete: `DELETE FROM users WHERE id = $1`,
        clear_chat: `UPDATE chat_messages SET deleted = true WHERE user_id = $1`,
      };
      await query(sql[a], [id]);
    }
    await audit(`user.${a}`, `@${target.username}`, a === "note" || a === "set_password" ? "" : JSON.stringify({ ...data, action: undefined, password: undefined }), ip);
    return Response.json({ ok: true });
  }

  if (section === "support" && id) {
    const data = await body(req, z.object({ body: z.string().trim().min(1).max(4000) }));
    if (data instanceof Response) return data;
    const user = await queryOne<{ email: string; name: string }>(`SELECT email, name FROM users WHERE id = $1`, [id]);
    if (!user) return bad("User not found", 404);
    await query(`INSERT INTO support_messages (user_id, from_admin, body) VALUES ($1, true, $2)`, [id, data.body]);
    sendEmail({ to: user.email, ...noticeEmail({ subject: "New message from GovShredz", heading: "The admin replied", body: data.body }) }).catch(() => {});
    return Response.json({ ok: true });
  }

  if (section === "chat" && id) {
    const data = await body(req, z.object({ action: z.enum(["delete", "restore"]) }));
    if (data instanceof Response) return data;
    await query(`UPDATE chat_messages SET deleted = $2 WHERE id = $1`, [Number(id), data.action === "delete"]);
    await audit(`chat.${data.action}`, `#${id}`, "", ip);
    return Response.json({ ok: true });
  }

  if (section === "announcements") {
    if (!id) {
      const data = await body(req, z.object({ body: z.string().trim().min(1).max(500), tone: z.enum(["info", "hype", "warn"]).default("info") }));
      if (data instanceof Response) return data;
      await query(`INSERT INTO announcements (body, tone) VALUES ($1, $2)`, [data.body, data.tone]);
      await audit("announcement.create", "", data.body, ip);
    } else {
      const data = await body(req, z.object({ action: z.enum(["toggle", "delete"]) }));
      if (data instanceof Response) return data;
      if (data.action === "toggle") await query(`UPDATE announcements SET active = NOT active WHERE id = $1`, [Number(id)]);
      else await query(`DELETE FROM announcements WHERE id = $1`, [Number(id)]);
    }
    return Response.json({ ok: true });
  }

  if (section === "notes") {
    const data = await body(req, z.object({ title: z.string().max(200).optional(), body: z.string().max(50000).optional(), action: z.enum(["save", "delete"]).default("save") }));
    if (data instanceof Response) return data;
    if (id && data.action === "delete") await query(`DELETE FROM admin_notes WHERE id = $1`, [id]);
    else if (id) await query(`UPDATE admin_notes SET title = COALESCE($2, title), body = COALESCE($3, body), updated_at = now() WHERE id = $1`, [id, data.title ?? null, data.body ?? null]);
    else {
      const n = await queryOne<{ id: string }>(`INSERT INTO admin_notes (title, body) VALUES ($1, $2) RETURNING id`, [data.title ?? "Untitled", data.body ?? ""]);
      return Response.json({ id: n!.id });
    }
    return Response.json({ ok: true });
  }

  if (section === "settings") {
    const data = await body(
      req,
      z.object({
        registration: z.enum(["open", "invite", "closed"]).optional(),
        inviteCode: z.string().trim().max(60).optional(),
        emailFrom: z.string().trim().max(120).optional(),
        resendKey: z.string().trim().max(200).optional(),
      }),
    );
    if (data instanceof Response) return data;
    const { resendKey, ...rest } = data;
    if (resendKey !== undefined) await setSecret("RESEND_API_KEY", resendKey);
    const settings = await saveSettings(rest);
    await audit("settings.update", "", Object.keys(data).join(", "), ip);
    return Response.json({ settings, secrets: await secretStatus() });
  }

  if (section === "test_email") {
    const sent = await sendEmail({
      to: OWNER_EMAIL,
      ...noticeEmail({ subject: "GovShredz test email", heading: "Email works ✅", body: "Verification and reset emails will go out from this sender." }),
    });
    return sent.ok ? Response.json({ ok: true }) : bad(sent.error ?? "Email failed", 502);
  }

  return bad("Not found", 404);
});

import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { query, queryOne } from "./db";
import { secretKeyMaterial } from "./auth";

/* ------------------------------ app settings ------------------------------- */

export type AppSettings = {
  /** open: anyone can sign up · invite: needs the invite code · closed: no new accounts */
  registration: "open" | "invite" | "closed";
  inviteCode: string;
  emailFrom: string;
};

const DEFAULTS: AppSettings = { registration: "open", inviteCode: "", emailFrom: "" };

export async function getSettings(): Promise<AppSettings> {
  const rows = await query<{ key: string; value: string }>(`SELECT key, value FROM app_settings WHERE key LIKE 'app:%'`).catch(() => []);
  const out = { ...DEFAULTS } as Record<string, string>;
  for (const r of rows) out[r.key.slice(4)] = r.value;
  return out as AppSettings;
}

export async function saveSettings(patch: Partial<AppSettings>) {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    await query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
      [`app:${k}`, String(v)],
    );
  }
  return getSettings();
}

/* --------------------------------- secrets --------------------------------- */

/** API keys the admin can paste in Admin → Settings. A Vercel env var with the same name always wins. */
export const SECRET_NAMES = ["RESEND_API_KEY"] as const;
export type SecretName = (typeof SECRET_NAMES)[number];

const aesKey = () => createHash("sha256").update(Buffer.concat([Buffer.from("govshredz-secrets:"), secretKeyMaterial()])).digest();

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", aesKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

function decrypt(stored: string) {
  try {
    const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64"));
    const d = createDecipheriv("aes-256-gcm", aesKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export async function getSecret(name: SecretName) {
  const env = process.env[name]?.trim();
  if (env) return env;
  const row = await queryOne<{ value: string }>(`SELECT value FROM app_settings WHERE key = $1`, [`secret:${name}`]).catch(() => null);
  return row ? decrypt(row.value) : "";
}

export async function setSecret(name: SecretName, value: string) {
  if (!value) await query(`DELETE FROM app_settings WHERE key = $1`, [`secret:${name}`]);
  else
    await query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
      [`secret:${name}`, encrypt(value)],
    );
}

/** Where each key comes from, with a masked preview (never the full value). */
export async function secretStatus() {
  const out: Record<string, { source: "vercel" | "saved" | "none"; preview: string }> = {};
  for (const n of SECRET_NAMES) {
    const env = process.env[n]?.trim();
    const v = env || (await getSecret(n));
    out[n] = { source: env ? "vercel" : v ? "saved" : "none", preview: v ? `••••${v.slice(-4)}` : "" };
  }
  return out;
}

/* ------------------------------- audit log --------------------------------- */

export async function audit(action: string, target = "", detail = "", ip: string | null = null) {
  await query(`INSERT INTO audit_log (action, target, detail, ip) VALUES ($1, $2, $3, $4)`, [action, target, detail, ip]).catch(() => {});
}

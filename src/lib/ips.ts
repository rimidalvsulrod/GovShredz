import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { query } from "./db";

// Which IP addresses each account uses, for the admin panel. Location comes from Vercel's edge
// headers (city level); nothing is looked up from third parties.

export type IpMeta = { ip: string; userAgent: string | null; country: string | null; region: string | null; city: string | null };

const decode = (v: string | null) => {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

export async function requestMeta(): Promise<IpMeta> {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "",
    userAgent: h.get("user-agent")?.slice(0, 400) ?? null,
    country: h.get("x-vercel-ip-country"),
    region: decode(h.get("x-vercel-ip-country-region")),
    city: decode(h.get("x-vercel-ip-city")),
  };
}

// One write per account + IP every few minutes per server instance keeps this off the hot path.
const recent = new Map<string, number>();
const EVERY = 5 * 60_000;

/** Record the current request's IP for this account. `force` writes even if it was seen recently (sign-ins). */
export async function trackIp(userId: string, force = false) {
  let m: IpMeta;
  try {
    m = await requestMeta();
  } catch {
    return;
  }
  if (!m.ip) m.ip = "local";
  const k = `${userId}|${m.ip}`;
  const now = Date.now();
  if (!force && now - (recent.get(k) ?? 0) < EVERY) return;
  if (recent.size > 20_000) recent.clear();
  recent.set(k, now);
  after(() =>
    query(
      `INSERT INTO user_ips (user_id, ip, user_agent, country, region, city) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, ip) DO UPDATE SET
         last_seen = now(), hits = user_ips.hits + 1,
         user_agent = COALESCE($3, user_ips.user_agent), country = COALESCE($4, user_ips.country),
         region = COALESCE($5, user_ips.region), city = COALESCE($6, user_ips.city)`,
      [userId, m.ip, m.userAgent, m.country, m.region, m.city],
    ).catch(() => {}),
  );
}

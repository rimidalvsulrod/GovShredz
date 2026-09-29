import "server-only";
import { query } from "./db";
import { num } from "./api";

export type ChallengeKind = "volume" | "workouts" | "e1rm" | "relative";

export const KIND_LABEL: Record<ChallengeKind, string> = {
  volume: "Most volume lifted",
  workouts: "Most workouts",
  e1rm: "Heaviest lift (est. 1RM)",
  relative: "Strongest pound-for-pound",
};

type ChallengeRow = {
  id: string;
  creator: string;
  title: string;
  kind: ChallengeKind;
  exercise: string | null;
  stakes: string;
  starts_at: string;
  ends_at: string;
  cancelled: boolean;
  created_at: string;
};

type PlayerRow = { challenge_id: string; user_id: string; status: string; username: string; name: string; color: string };

/** Challenges where `where` matches (c = challenges), with players and live standings. */
export async function loadChallenges(where: string, params: unknown[]) {
  const rows = await query<ChallengeRow>(`SELECT c.* FROM challenges c WHERE ${where} ORDER BY c.ends_at DESC LIMIT 50`, params);
  if (!rows.length) return [];
  const players = await query<PlayerRow>(
    `SELECT cp.challenge_id, cp.user_id, cp.status, u.username, u.name, u.color
     FROM challenge_players cp JOIN users u ON u.id = cp.user_id WHERE cp.challenge_id = ANY($1)`,
    [rows.map((r) => r.id)],
  );
  const out = [];
  for (const c of rows) {
    const ps = players.filter((p) => p.challenge_id === c.id);
    const scores = await standings(c, ps.filter((p) => p.status === "accepted").map((p) => p.user_id));
    const now = Date.now();
    const ended = new Date(c.ends_at).getTime() <= now;
    const status = c.cancelled ? "cancelled" : ended ? "done" : "active";
    const table = ps
      .map((p) => ({ id: p.user_id, username: p.username, name: p.name, color: p.color, status: p.status, value: scores.get(p.user_id) ?? 0 }))
      .sort((a, b) => (a.status === "accepted" ? 0 : 1) - (b.status === "accepted" ? 0 : 1) || b.value - a.value);
    const top = table.filter((p) => p.status === "accepted" && p.value > 0);
    const winner = status === "done" && top.length && (top.length === 1 || top[0].value > top[1].value) ? top[0].id : null;
    out.push({
      id: c.id,
      creator: c.creator,
      title: c.title,
      kind: c.kind,
      exercise: c.exercise,
      stakes: c.stakes,
      startsAt: c.starts_at,
      endsAt: c.ends_at,
      status,
      winner,
      players: table,
    });
  }
  return out;
}

async function standings(c: ChallengeRow, ids: string[]) {
  const m = new Map<string, number>();
  if (!ids.length) return m;
  // Counted by when the workout was logged, so back-dating can't game a challenge.
  const p = [ids, c.starts_at, c.ends_at];
  let rows: { user_id: string; v: number }[] = [];
  if (c.kind === "volume")
    rows = await query(`SELECT user_id, SUM(volume_kg) AS v FROM workouts WHERE user_id = ANY($1) AND created_at >= $2 AND created_at <= $3 GROUP BY user_id`, p);
  else if (c.kind === "workouts")
    rows = await query(`SELECT user_id, count(*) AS v FROM workouts WHERE user_id = ANY($1) AND created_at >= $2 AND created_at <= $3 GROUP BY user_id`, p);
  else {
    const col = c.kind === "e1rm" ? "s.e1rm_kg" : "s.metric";
    rows = await query(
      `SELECT s.user_id, MAX(${col}) AS v FROM sets s JOIN workouts w ON w.id = s.workout_id
       WHERE s.user_id = ANY($1) AND w.created_at >= $2 AND w.created_at <= $3 AND s.exercise = $4 GROUP BY s.user_id`,
      [...p, c.exercise],
    );
  }
  for (const r of rows) m.set(r.user_id, num(r.v));
  return m;
}

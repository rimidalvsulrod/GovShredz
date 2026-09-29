import "server-only";

type Row = Record<string, unknown>;
type Client = { kind: "neon" | "pglite"; query: <T = Row>(text: string, params?: unknown[]) => Promise<T[]> };

// Tables are created on first use, so a fresh database needs no migration step.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    username text UNIQUE NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    email_verified_at timestamptz,
    session_version int NOT NULL DEFAULT 1,
    banned boolean NOT NULL DEFAULT false,
    chat_muted boolean NOT NULL DEFAULT false,
    onboarded boolean NOT NULL DEFAULT false,
    sex text NOT NULL DEFAULT 'male',
    birth_year int,
    height_cm real,
    weight_kg real,
    unit text NOT NULL DEFAULT 'lb',
    goal text NOT NULL DEFAULT 'maintain',
    kcal_target int,
    protein_target int,
    bio text NOT NULL DEFAULT '',
    color text NOT NULL DEFAULT '#c8ff2e',
    public_workouts boolean NOT NULL DEFAULT true,
    share_physique boolean NOT NULL DEFAULT false,
    admin_note text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS email_codes (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose text NOT NULL,
    code_hash text NOT NULL,
    attempts int NOT NULL DEFAULT 0,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, purpose)
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key text PRIMARY KEY,
    count int NOT NULL,
    reset_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_ips (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip text NOT NULL,
    first_seen timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now(),
    hits int NOT NULL DEFAULT 1,
    user_agent text,
    country text,
    region text,
    city text,
    PRIMARY KEY (user_id, ip)
  )`,
  `CREATE INDEX IF NOT EXISTS user_ips_ip_idx ON user_ips(ip)`,
  `CREATE INDEX IF NOT EXISTS user_ips_last_idx ON user_ips(user_id, last_seen DESC)`,
  `CREATE TABLE IF NOT EXISTS workouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL,
    notes text NOT NULL DEFAULT '',
    bw_kg real NOT NULL,
    started_at timestamptz NOT NULL,
    day text NOT NULL,
    duration_sec int NOT NULL DEFAULT 0,
    volume_kg real NOT NULL DEFAULT 0,
    set_count int NOT NULL DEFAULT 0,
    pr_count int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS workouts_user_idx ON workouts(user_id, started_at DESC)`,
  `CREATE TABLE IF NOT EXISTS sets (
    id bigserial PRIMARY KEY,
    workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise text NOT NULL,
    position int NOT NULL,
    set_no int NOT NULL,
    weight_kg real NOT NULL DEFAULT 0,
    reps int NOT NULL,
    e1rm_kg real NOT NULL DEFAULT 0,
    metric real NOT NULL DEFAULT 0,
    is_pr boolean NOT NULL DEFAULT false,
    done_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS sets_user_ex_idx ON sets(user_id, exercise)`,
  `CREATE INDEX IF NOT EXISTS sets_workout_idx ON sets(workout_id)`,
  `CREATE TABLE IF NOT EXISTS bodyweights (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day text NOT NULL,
    weight_kg real NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day)
  )`,
  `CREATE TABLE IF NOT EXISTS body_scans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    height_cm real NOT NULL,
    weight_kg real NOT NULL,
    body_fat real NOT NULL,
    metrics jsonb,
    skin text NOT NULL DEFAULT '#c68863',
    source text NOT NULL DEFAULT 'stats',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS body_scans_user_idx ON body_scans(user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS meals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day text NOT NULL,
    meal text NOT NULL,
    name text NOT NULL,
    serving text NOT NULL DEFAULT '',
    servings real NOT NULL DEFAULT 1,
    kcal real NOT NULL DEFAULT 0,
    protein real NOT NULL DEFAULT 0,
    carbs real NOT NULL DEFAULT 0,
    fat real NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS meals_user_day_idx ON meals(user_id, day)`,
  `CREATE TABLE IF NOT EXISTS water (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day text NOT NULL,
    ml int NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  )`,
  `CREATE TABLE IF NOT EXISTS follows (
    follower uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower, followee)
  )`,
  `CREATE TABLE IF NOT EXISTS props (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, workout_id)
  )`,
  `CREATE TABLE IF NOT EXISTS challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL,
    kind text NOT NULL,
    exercise text,
    stakes text NOT NULL DEFAULT '',
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    cancelled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS challenge_players (
    challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'invited',
    PRIMARY KEY (challenge_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id bigserial PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body text NOT NULL,
    deleted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS support_messages (
    id bigserial PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_admin boolean NOT NULL DEFAULT false,
    body text NOT NULL,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS support_user_idx ON support_messages(user_id, id)`,
  `CREATE TABLE IF NOT EXISTS announcements (
    id bigserial PRIMARY KEY,
    body text NOT NULL,
    tone text NOT NULL DEFAULT 'info',
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS admin_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id bigserial PRIMARY KEY,
    action text NOT NULL,
    target text NOT NULL DEFAULT '',
    detail text NOT NULL DEFAULT '',
    ip text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
];

let ready: Promise<Client> | null = null;

async function connect(): Promise<Client> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  let client: Client;

  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    client = { kind: "neon", query: async (text, params = []) => (await sql.query(text, params)) as never };
  } else if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not configured for this deployment.");
  } else {
    // Local development fallback: an embedded Postgres persisted to .data/
    const { PGlite } = await import("@electric-sql/pglite");
    const { mkdirSync } = await import("node:fs");
    mkdirSync("./.data", { recursive: true });
    const db = new PGlite("./.data/pglite");
    client = { kind: "pglite", query: async (text, params = []) => (await db.query(text, params)).rows as never };
  }

  for (const statement of SCHEMA) await client.query(statement);
  return client;
}

// Shared through globalThis: Next can load this module more than once in dev (pages vs route
// handlers), and two embedded databases on the same folder would not see each other's writes.
const g = globalThis as unknown as { __govshredzDb?: Promise<Client> | null };

async function client() {
  ready ??= g.__govshredzDb ??= connect().catch((err) => {
    ready = null;
    g.__govshredzDb = null;
    throw err;
  });
  return ready;
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await client()).query<T>(text, params);
}

export async function queryOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function dbKind() {
  return (await client()).kind;
}

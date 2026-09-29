"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Download, Eye, EyeOff, Megaphone, MessageCircleOff, Plus, Search, Send, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/client/api";
import { useMe } from "@/client/me";
import { fail, invalidate, toast, useData } from "@/client/store";
import { Avatar, Button, Card, Empty, Field, Input, Segmented, Select, Skeleton, Textarea } from "@/components/ui";
import { Bars } from "@/components/charts";
import { RankChip } from "@/components/rank";
import { ago, fmtBig } from "@/shared/units";
import { flag, Pill } from "./admin-ui";

type Tab = "overview" | "users" | "support" | "chat" | "broadcast" | "notes" | "settings" | "log";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "support", label: "Support" },
  { id: "chat", label: "Chat" },
  { id: "broadcast", label: "Broadcast" },
  { id: "notes", label: "Notes" },
  { id: "settings", label: "Settings" },
  { id: "log", label: "Audit log" },
];

export default function AdminPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Admin />
    </Suspense>
  );
}

function Admin() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "overview";
  return (
    <div className="rise">
      <div className="no-scrollbar -mx-4 mb-5 overflow-x-auto px-4">
        <Segmented value={tab} onChange={(t) => router.replace(`/admin?tab=${t}`, { scroll: false })} className="min-w-[760px]" options={TABS} />
      </div>
      {tab === "overview" && <Overview />}
      {tab === "users" && <Users />}
      {tab === "support" && <Support />}
      {tab === "chat" && <ChatMod />}
      {tab === "broadcast" && <Broadcast />}
      {tab === "notes" && <Notes />}
      {tab === "settings" && <Settings />}
      {tab === "log" && <AuditLog />}
    </div>
  );
}

/* -------------------------------- overview --------------------------------- */

type Stats = {
  counts: Record<string, number>;
  signups: { day: string; n: number }[];
  workouts: { day: string; n: number }[];
  activity: { kind: string; at: string; username: string; user_id: string; label: string }[];
  system: { db: string; email: boolean };
};

function last14(rows: { day: string; n: number }[]) {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    return { label: String(d.getDate()), value: rows.find((r) => r.day === key)?.n ?? 0, highlight: i === 13 };
  });
}

function Overview() {
  const { me } = useMe();
  const { data } = useData<Stats>("/api/admin/stats");
  if (!data) return <Skeleton className="h-96" />;
  const c = data.counts;
  const tiles: [string, string | number, string?][] = [
    ["Users", c.users, `+${c.new7} this week`],
    ["Verified", c.verified, `${c.banned} suspended`],
    ["Active today", c.active24, `${c.active7} this week`],
    ["IP addresses", c.ips, "unique, all time"],
    ["Workouts", c.workouts, `${c.sets} sets · ${c.prs} PRs`],
    ["Volume lifted", fmtBig(c.volume, me.unit)],
    ["Meals logged", c.meals],
    ["Body scans", c.scans],
    ["Challenges", c.challenges],
    ["Chat messages", c.chat],
    ["Unread support", c.unread],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {tiles.map(([k, v, sub]) => (
          <div key={k} className="card p-3.5">
            <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">{k}</div>
            <div className="font-display tabular mt-1 text-[28px] leading-none font-extrabold">{typeof v === "number" ? v.toLocaleString() : v}</div>
            {sub && <div className="mt-1 text-[12px] text-dim">{sub}</div>}
          </div>
        ))}
        <div className="card space-y-1.5 p-3.5 text-[13px]">
          <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">System</div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-ok" /> Database: {data.system.db === "neon" ? "Neon Postgres" : "Local (PGlite)"}
          </div>
          <div className="flex items-center gap-2">
            <span className={clsx("h-2 w-2 rounded-full", data.system.email ? "bg-ok" : "bg-bad")} /> Email: {data.system.email ? "Resend connected" : "not configured"}
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="mb-3 text-[13px] font-semibold text-muted">Sign-ups · last 14 days</div>
          <Bars data={last14(data.signups)} height={110} />
        </Card>
        <Card>
          <div className="mb-3 text-[13px] font-semibold text-muted">Workouts · last 14 days</div>
          <Bars data={last14(data.workouts)} height={110} color="#2ee6ff" />
        </Card>
      </div>
      <Card className="p-0">
        <div className="border-b border-line px-4 py-3 text-[13px] font-semibold text-muted">Live activity</div>
        {data.activity.length === 0 ? (
          <div className="p-4 text-[13px] text-dim">Nothing yet.</div>
        ) : (
          <div className="divide-y divide-line">
            {data.activity.map((a, i) => (
              <Link key={i} href={`/admin/users/${a.user_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                <Pill tone={a.kind === "signup" ? "lime" : a.kind === "workout" ? "cyan" : a.kind === "meal" ? "warn" : "muted"}>{a.kind}</Pill>
                <span className="font-semibold">@{a.username}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{a.label}</span>
                <span className="shrink-0 text-[12px] text-dim">{ago(a.at)}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------- users ---------------------------------- */

type UserRow = {
  id: string;
  email: string;
  username: string;
  name: string;
  color: string;
  verified: boolean;
  banned: boolean;
  chatMuted: boolean;
  onboarded: boolean;
  createdAt: string;
  workouts: number;
  meals: number;
  scans: number;
  lastIp: string | null;
  lastCountry: string | null;
  lastCity: string | null;
  lastSeen: string | null;
  score: number;
  isOwner: boolean;
};

function Users() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data } = useData<{ users: UserRow[] }>(`/api/admin/users?q=${encodeURIComponent(term)}`);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex h-12 min-w-[240px] flex-1 items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4">
          <Search className="h-4 w-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, username or IP" className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-dim" />
        </label>
        {(["users", "workouts", "meals", "ips"] as const).map((x) => (
          <a key={x} href={`/api/admin/export/${x}`} className="press inline-flex h-12 items-center gap-1.5 rounded-2xl border border-line bg-surface px-3.5 text-[13px] font-semibold">
            <Download className="h-4 w-4" /> {x.toUpperCase()} CSV
          </a>
        ))}
      </div>
      {!data ? (
        <Skeleton className="h-64" />
      ) : data.users.length === 0 ? (
        <Empty title="No users found" />
      ) : (
        <div className="card divide-y divide-line p-0">
          {data.users.map((u) => (
            <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
              <Avatar name={u.name} color={u.color} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold">{u.name}</span>
                  <span className="text-[13px] text-muted">@{u.username}</span>
                  {u.isOwner && <Pill tone="lime">Owner</Pill>}
                  {!u.verified && <Pill tone="warn">Unverified</Pill>}
                  {u.banned && <Pill tone="bad">Suspended</Pill>}
                  {u.chatMuted && <Pill tone="warn">Muted</Pill>}
                  {!u.onboarded && <Pill>Not onboarded</Pill>}
                </div>
                <div className="truncate text-[12px] text-muted">
                  {u.email} · joined {new Date(u.createdAt).toLocaleDateString()} · {u.workouts} workouts · {u.meals} meals · {u.scans} scans
                </div>
                {u.lastIp && (
                  <div className="truncate text-[12px] text-dim">
                    {flag(u.lastCountry)} <span className="font-mono">{u.lastIp}</span>
                    {u.lastCity ? ` · ${u.lastCity}` : ""}
                    {u.lastSeen ? ` · ${ago(u.lastSeen)}` : ""}
                  </div>
                )}
              </div>
              <RankChip score={u.score} showSr />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- support --------------------------------- */

type Thread = { id: string; username: string; name: string; color: string; email: string; last: string; last_at: string; unread: number };
type SMsg = { id: string; from_admin: boolean; body: string; created_at: string };

function Support() {
  const { data } = useData<{ threads: Thread[] }>("/api/admin/support");
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="grid gap-3 md:grid-cols-[320px_1fr]">
      <div className="card divide-y divide-line p-0">
        {!data ? (
          <Skeleton className="m-3 h-40" />
        ) : data.threads.length === 0 ? (
          <div className="p-4 text-[13px] text-muted">No messages yet.</div>
        ) : (
          data.threads.map((t) => (
            <button key={t.id} onClick={() => setOpen(t.id)} className={clsx("flex w-full items-center gap-3 px-4 py-3 text-left", open === t.id && "bg-white/[0.04]")}>
              <Avatar name={t.name} color={t.color} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-bold">{t.name}</span>
                  {t.unread > 0 && <span className="rounded-full bg-hot px-1.5 text-[11px] font-bold text-white">{t.unread}</span>}
                </div>
                <div className="truncate text-[12px] text-muted">{t.last}</div>
              </div>
              <span className="text-[11px] text-dim">{ago(t.last_at)}</span>
            </button>
          ))
        )}
      </div>
      {open ? <SupportThread id={open} /> : <Card className="grid place-items-center text-[14px] text-muted">Pick a conversation</Card>}
    </div>
  );
}

function SupportThread({ id }: { id: string }) {
  const { data, reload } = useData<{ user: { username: string; name: string; email: string }; messages: SMsg[] }>(`/api/admin/support/${id}`);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!data) return <Skeleton className="h-64" />;
  return (
    <Card className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-bold">{data.user.name}</div>
          <div className="text-[12px] text-muted">{data.user.email}</div>
        </div>
        <Link href={`/admin/users/${id}`} className="text-[13px] font-semibold text-lime">
          Open profile
        </Link>
      </div>
      <div className="max-h-[50vh] flex-1 space-y-2 overflow-y-auto">
        {data.messages.map((m) => (
          <div key={m.id} className={clsx("flex", m.from_admin && "justify-end")}>
            <div className={clsx("max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] whitespace-pre-wrap", m.from_admin ? "bg-lime text-black" : "bg-surface-3")}>
              {m.body}
              <div className={clsx("mt-0.5 text-[10px]", m.from_admin ? "text-black/50" : "text-dim")}>{ago(m.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply (they'll get an email too)…" className="min-h-12 flex-1" rows={2} />
        <Button
          className="h-12"
          loading={busy}
          disabled={!text.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/api/admin/support/${id}`, { body: { body: text } });
              setText("");
              await reload();
              invalidate("/api/admin/support");
            } catch (e) {
              fail(e);
            }
            setBusy(false);
          }}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

/* ----------------------------------- chat ---------------------------------- */

type CMsg = { id: string; body: string; deleted: boolean; created_at: string; user_id: string; username: string; name: string; color: string; chat_muted: boolean };

function ChatMod() {
  const { data, reload } = useData<{ messages: CMsg[] }>("/api/admin/chat");
  const act = async (url: string, body: unknown, msg: string) => {
    try {
      await api(url, { body });
      toast(msg);
      await reload();
    } catch (e) {
      fail(e);
    }
  };
  if (!data) return <Skeleton className="h-64" />;
  if (!data.messages.length) return <Empty title="No chat messages yet" />;
  return (
    <div className="card divide-y divide-line p-0">
      {data.messages.map((m) => (
        <div key={m.id} className={clsx("flex items-start gap-3 px-4 py-3", m.deleted && "opacity-50")}>
          <Avatar name={m.name} color={m.color} size={32} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
              <Link href={`/admin/users/${m.user_id}`} className="font-bold hover:underline">
                {m.name}
              </Link>
              <span className="text-dim">{ago(m.created_at)}</span>
              {m.deleted && <Pill tone="bad">Deleted</Pill>}
              {m.chat_muted && <Pill tone="warn">Muted</Pill>}
            </div>
            <div className="mt-0.5 text-[14px] break-words whitespace-pre-wrap">{m.body}</div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              title={m.deleted ? "Restore" : "Delete"}
              className="press grid h-8 w-8 place-items-center rounded-full bg-white/[0.06]"
              onClick={() => act(`/api/admin/chat/${m.id}`, { action: m.deleted ? "restore" : "delete" }, m.deleted ? "Restored" : "Deleted")}
            >
              {m.deleted ? <Eye className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button
              title={m.chat_muted ? "Unmute" : "Mute user"}
              className="press grid h-8 w-8 place-items-center rounded-full bg-white/[0.06]"
              onClick={() => act(`/api/admin/users/${m.user_id}`, { action: m.chat_muted ? "unmute" : "mute" }, m.chat_muted ? "Unmuted" : "Muted")}
            >
              {m.chat_muted ? <ShieldCheck className="h-4 w-4" /> : <MessageCircleOff className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- broadcast -------------------------------- */

type Ann = { id: number; body: string; tone: string; active: boolean; created_at: string };

function Broadcast() {
  const { data, reload } = useData<{ announcements: Ann[] }>("/api/admin/announcements");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<"info" | "hype" | "warn">("hype");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <div className="flex items-center gap-2 font-bold">
          <Megaphone className="h-5 w-5 text-lime" /> New announcement
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Leg day challenge starts Monday. No excuses." maxLength={500} />
        <Segmented value={tone} onChange={setTone} options={[{ id: "hype", label: "Hype (lime)" }, { id: "info", label: "Info (cyan)" }, { id: "warn", label: "Warning" }]} />
        <Button
          loading={busy}
          disabled={!body.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/api/admin/announcements", { body: { body, tone } });
              setBody("");
              toast("Posted to everyone's home screen");
              await reload();
            } catch (e) {
              fail(e);
            }
            setBusy(false);
          }}
        >
          Post
        </Button>
      </Card>
      {data?.announcements.map((a) => (
        <Card key={a.id} className={clsx("flex items-start gap-3", !a.active && "opacity-50")}>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] whitespace-pre-wrap">{a.body}</div>
            <div className="mt-1 flex gap-1.5 text-[12px] text-dim">
              <Pill tone={a.tone === "warn" ? "warn" : a.tone === "hype" ? "lime" : "cyan"}>{a.tone}</Pill> {a.active ? "Live" : "Hidden"} · {ago(a.created_at)}
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => api(`/api/admin/announcements/${a.id}`, { body: { action: "toggle" } }).then(reload, fail)}>
            {a.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="danger" onClick={() => confirm("Delete announcement?") && api(`/api/admin/announcements/${a.id}`, { body: { action: "delete" } }).then(reload, fail)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </Card>
      ))}
    </div>
  );
}

/* ---------------------------------- notes ---------------------------------- */

type Note = { id: string; title: string; body: string; updated_at: string };

function Notes() {
  const { data, reload } = useData<{ notes: Note[] }>("/api/admin/notes");
  const [sel, setSel] = useState<string | null>(null);
  const note = data?.notes.find((n) => n.id === sel) ?? null;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid gap-3 md:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        <Button
          block
          onClick={async () => {
            try {
              const r = await api<{ id: string }>("/api/admin/notes", { body: { title: "Untitled", body: "" } });
              await reload();
              setSel(r.id);
            } catch (e) {
              fail(e);
            }
          }}
        >
          <Plus className="h-4 w-4" /> New note
        </Button>
        <div className="card divide-y divide-line p-0">
          {data?.notes.length ? (
            data.notes.map((n) => (
              <button key={n.id} onClick={() => setSel(n.id)} className={clsx("block w-full px-4 py-3 text-left", sel === n.id && "bg-white/[0.05]")}>
                <div className="truncate font-semibold">{n.title || "Untitled"}</div>
                <div className="truncate text-[12px] text-muted">{n.body.slice(0, 60) || "Empty"}</div>
              </button>
            ))
          ) : (
            <div className="p-4 text-[13px] text-muted">Private notes only you can see — workout plans, ideas, to-dos.</div>
          )}
        </div>
      </div>
      {note ? (
        <Card className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="text-[18px] font-bold" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[50vh] font-mono text-[14px]" placeholder="Write anything…" />
          <div className="flex gap-2">
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/api/admin/notes/${note.id}`, { body: { title, body } });
                  toast("Saved");
                  await reload();
                } catch (e) {
                  fail(e);
                }
                setBusy(false);
              }}
            >
              Save
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm("Delete this note?")) return;
                await api(`/api/admin/notes/${note.id}`, { body: { action: "delete" } }).catch(fail);
                setSel(null);
                await reload();
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="grid min-h-40 place-items-center text-[14px] text-muted">Select or create a note</Card>
      )}
    </div>
  );
}

/* -------------------------------- settings --------------------------------- */

type SettingsData = {
  settings: { registration: "open" | "invite" | "closed"; inviteCode: string; emailFrom: string };
  secrets: Record<string, { source: string; preview: string }>;
  emailFromEnv: string | null;
};

function Settings() {
  const { data, mutate } = useData<SettingsData>("/api/admin/settings");
  const [invite, setInvite] = useState("");
  const [from, setFrom] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (data) {
      setInvite(data.settings.inviteCode);
      setFrom(data.settings.emailFrom);
    }
  }, [data]);
  if (!data) return <Skeleton className="h-64" />;
  const save = async (patch: Record<string, unknown>, what: string) => {
    setBusy(what);
    try {
      const r = await api<Pick<SettingsData, "settings" | "secrets">>("/api/admin/settings", { body: patch });
      mutate({ ...data, ...r });
      toast("Saved");
    } catch (e) {
      fail(e);
    }
    setBusy(null);
  };
  const resend = data.secrets.RESEND_API_KEY;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="space-y-4">
        <div className="font-bold">Sign-ups</div>
        <Field label="Who can create an account">
          <Select value={data.settings.registration} onChange={(e) => save({ registration: e.target.value }, "reg")}>
            <option value="open">Anyone</option>
            <option value="invite">Only with invite code</option>
            <option value="closed">Nobody (closed)</option>
          </Select>
        </Field>
        <Field label="Invite code">
          <div className="flex gap-2">
            <Input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="e.g. SHREDSZN" />
            <Button variant="secondary" loading={busy === "invite"} onClick={() => save({ inviteCode: invite }, "invite")}>
              Save
            </Button>
          </div>
        </Field>
      </Card>
      <Card className="space-y-4">
        <div className="font-bold">Email (verification & reset codes)</div>
        <div className="text-[13px] text-muted">
          Resend API key:{" "}
          {resend.source === "none" ? (
            <Pill tone="bad">not set</Pill>
          ) : (
            <Pill tone="ok">
              {resend.source === "vercel" ? "from Vercel env" : "saved here"} {resend.preview}
            </Pill>
          )}
        </div>
        {resend.source !== "vercel" && (
          <Field label="Resend API key" hint="Or set RESEND_API_KEY in Vercel (that always wins). Stored encrypted.">
            <div className="flex gap-2">
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="re_…" type="password" />
              <Button variant="secondary" loading={busy === "key"} onClick={() => save({ resendKey: key }, "key").then(() => setKey(""))}>
                Save
              </Button>
            </div>
          </Field>
        )}
        <Field label="Send from" hint={data.emailFromEnv ? `EMAIL_FROM env is set: ${data.emailFromEnv}` : "Default: GovShredz <govshredz@neqodigital.com> (domain must be verified in Resend)"}>
          <div className="flex gap-2">
            <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="GovShredz <govshredz@neqodigital.com>" />
            <Button variant="secondary" loading={busy === "from"} onClick={() => save({ emailFrom: from }, "from")}>
              Save
            </Button>
          </div>
        </Field>
        <Button
          variant="outline"
          loading={busy === "test"}
          onClick={async () => {
            setBusy("test");
            try {
              await api("/api/admin/test_email", { body: {} });
              toast("Test email sent to you");
            } catch (e) {
              fail(e);
            }
            setBusy(null);
          }}
        >
          Send test email
        </Button>
      </Card>
    </div>
  );
}

/* --------------------------------- audit ----------------------------------- */

function AuditLog() {
  const { data } = useData<{ log: { id: string; action: string; target: string; detail: string; ip: string | null; created_at: string }[] }>("/api/admin/audit");
  if (!data) return <Skeleton className="h-64" />;
  if (!data.log.length) return <Empty title="Nothing logged yet" />;
  return (
    <div className="card divide-y divide-line p-0">
      {data.log.map((l) => (
        <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
          <Pill tone={l.action.includes("delete") || l.action.includes("ban") ? "bad" : l.action === "signup" ? "lime" : "muted"}>{l.action}</Pill>
          <span className="font-semibold">{l.target}</span>
          <span className="min-w-0 flex-1 truncate text-muted">{l.detail}</span>
          {l.ip && <span className="font-mono text-[12px] text-dim">{l.ip}</span>}
          <span className="text-[12px] text-dim">{ago(l.created_at)}</span>
        </div>
      ))}
    </div>
  );
}


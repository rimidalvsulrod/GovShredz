"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { BadgeCheck, Ban, KeyRound, LogOut, Mail, MessageCircle, MessageCircleOff, Pencil, ShieldCheck, Trash2, Trophy } from "lucide-react";
import { api } from "@/client/api";
import { useMe } from "@/client/me";
import { fail, toast, useData } from "@/client/store";
import type { Challenge, Workout } from "@/client/types";
import { Avatar, Button, Card, Field, Input, SectionTitle, Skeleton, Textarea } from "@/components/ui";
import { RankBadge, RankChip } from "@/components/rank";
import { WorkoutSheet } from "@/components/workout";
import { ChallengeCard } from "@/components/challenge";
import { exerciseName, getExercise, GROUPS } from "@/shared/exercises";
import { fmtMetric, profileRanks, rankInfo, type Sex } from "@/shared/ranks";
import { ago, fmtBig, fmtDuration, fmtHeight, fmtW } from "@/shared/units";
import { device, flag, Pill, place, Table } from "../../admin-ui";

type Detail = {
  user: {
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
    lastSeen: string | null;
    score: number;
    isOwner: boolean;
    adminNote: string;
    sex: Sex;
    birthYear: number | null;
    heightCm: number | null;
    weightKg: number | null;
    unit: string;
    goal: string;
    kcalTarget: number | null;
    proteinTarget: number | null;
    bio: string;
    publicWorkouts: boolean;
    sharePhysique: boolean;
  };
  bests: Record<string, number>;
  records: { exercise: string; e1rm_kg: number; weight_kg: number; reps: number; metric: number; done_at: string }[];
  workouts: Workout[];
  meals: { id: string; day: string; meal: string; name: string; serving: string; servings: number; kcal: number; protein: number; carbs: number; fat: number; created_at: string }[];
  water: { day: string; ml: number }[];
  weights: { day: string; weight_kg: number }[];
  scans: { id: string; height_cm: number; weight_kg: number; body_fat: number; metrics: Record<string, number> | null; skin: string; source: string; created_at: string }[];
  ips: { ip: string; first_seen: string; last_seen: string; hits: number; user_agent: string | null; country: string | null; region: string | null; city: string | null; shared: number }[];
  chat: { id: string; body: string; deleted: boolean; created_at: string }[];
  support: { id: string; from_admin: boolean; body: string; created_at: string }[];
  challenges: Challenge[];
  followers: string[];
  following: string[];
};

type Section = "overview" | "ips" | "workouts" | "meals" | "body" | "social";

export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();
  const { data, error, reload } = useData<Detail>(`/api/admin/users/${id}`);
  const [section, setSection] = useState<Section>("overview");
  const [workout, setWorkout] = useState<string | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (data) setNote(data.user.adminNote);
  }, [data]);

  if (error) return <Card className="text-bad">{error.message}</Card>;
  if (!data) return <Skeleton className="h-96" />;
  const u = data.user;
  const ranks = profileRanks(data.bests, u.sex);
  const r = rankInfo(ranks.overall);

  const run = async (action: string, extra: Record<string, unknown> = {}, done = "Done") => {
    try {
      await api(`/api/admin/users/${id}`, { body: { action, ...extra } });
      toast(done);
      if (action === "delete") router.replace("/admin?tab=users");
      else await reload();
    } catch (e) {
      fail(e);
    }
  };

  const mealDays = [...new Set(data.meals.map((m) => m.day))];

  return (
    <div className="rise space-y-4">
      <Link href="/admin?tab=users" className="text-[13px] text-muted">
        ← All users
      </Link>

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full opacity-20 blur-3xl" style={{ background: r.tier.c2 }} />
        <div className="relative flex flex-wrap items-center gap-4">
          <Avatar name={u.name} color={u.color} size={72} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[30px] leading-none font-black uppercase italic">{u.name}</span>
              <span className="text-muted">@{u.username}</span>
            </div>
            <div className="mt-1 text-[14px]">{u.email}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {u.isOwner && <Pill tone="lime">Owner</Pill>}
              <Pill tone={u.verified ? "ok" : "warn"}>{u.verified ? "Verified" : "Unverified"}</Pill>
              {u.banned && <Pill tone="bad">Suspended</Pill>}
              {u.chatMuted && <Pill tone="warn">Muted in chat</Pill>}
              {!u.onboarded && <Pill>Not onboarded</Pill>}
              <Pill>Joined {new Date(u.createdAt).toLocaleDateString()}</Pill>
              {u.lastSeen && <Pill tone="cyan">Seen {ago(u.lastSeen)}</Pill>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RankBadge score={r.score} size={60} />
            <div>
              <div className="font-bold" style={{ color: r.tier.ink }}>
                {r.name}
              </div>
              <div className="tabular text-[12px] text-muted">{r.sr} SR</div>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Link href={`/u/${u.username}`} className="press inline-flex h-9 items-center rounded-2xl bg-surface-3 px-3.5 text-[13px] font-semibold">
            View public profile
          </Link>
          {!u.verified && (
            <Button size="sm" variant="secondary" onClick={() => run("verify", {}, "Marked verified")}>
              <BadgeCheck className="h-4 w-4" /> Mark verified
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => run("signout", {}, "Signed out everywhere")}>
            <LogOut className="h-4 w-4" /> Sign out everywhere
          </Button>
          <Button size="sm" variant="secondary" onClick={() => run("send_reset", {}, "Reset code emailed")}>
            <Mail className="h-4 w-4" /> Email reset code
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const pw = prompt("New password for this account (min 8 characters):");
              if (pw) void run("set_password", { password: pw }, "Password set · they've been signed out");
            }}
          >
            <KeyRound className="h-4 w-4" /> Set password
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const name = prompt("Name", u.name);
              if (name === null) return;
              const username = prompt("Username", u.username);
              if (username === null) return;
              void run("rename", { name, username }, "Updated");
            }}
          >
            <Pencil className="h-4 w-4" /> Rename
          </Button>
          {!u.isOwner && (
            <>
              <Button size="sm" variant="secondary" onClick={() => run(u.chatMuted ? "unmute" : "mute", {}, u.chatMuted ? "Unmuted" : "Muted")}>
                {u.chatMuted ? <MessageCircle className="h-4 w-4" /> : <MessageCircleOff className="h-4 w-4" />} {u.chatMuted ? "Unmute" : "Mute in chat"}
              </Button>
              <Button size="sm" variant="danger" onClick={() => (u.banned ? run("unban", {}, "Unsuspended") : confirm(`Suspend ${u.email}?`) && run("ban", {}, "Suspended"))}>
                {u.banned ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />} {u.banned ? "Unsuspend" : "Suspend"}
              </Button>
              <Button size="sm" variant="danger" onClick={() => confirm(`Permanently delete ${u.email} and all their data?`) && run("delete", {}, "Deleted")}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </>
          )}
        </div>
      </Card>

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-2">
          {(
            [
              ["overview", "Overview"],
              ["ips", `IP addresses (${data.ips.length})`],
              ["workouts", `Workouts (${u.workouts})`],
              ["meals", `Meals (${u.meals})`],
              ["body", `Body (${u.scans} scans)`],
              ["social", "Social & chat"],
            ] as [Section, string][]
          ).map(([s, label]) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={clsx("press h-9 rounded-full border px-4 text-[13px] font-semibold", section === s ? "border-lime bg-lime text-black" : "border-line bg-surface text-muted")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {section === "overview" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="space-y-2 text-[14px]">
            <div className="font-bold">Profile</div>
            <Row k="Sex" v={u.sex} />
            <Row k="Age" v={u.birthYear ? `${new Date().getFullYear() - u.birthYear} (born ${u.birthYear})` : "—"} />
            <Row k="Height" v={u.heightCm ? `${fmtHeight(u.heightCm, "lb")} · ${Math.round(u.heightCm)} cm` : "—"} />
            <Row k="Bodyweight" v={u.weightKg ? `${fmtW(u.weightKg, "lb")} · ${fmtW(u.weightKg, "kg")}` : "—"} />
            <Row k="Goal" v={u.goal} />
            <Row k="Targets" v={`${u.kcalTarget ?? "auto"} kcal · ${u.proteinTarget ?? "auto"} g protein`} />
            <Row k="Units" v={u.unit} />
            <Row k="Public workouts" v={u.publicWorkouts ? "Yes" : "No"} />
            <Row k="Shares physique" v={u.sharePhysique ? "Yes" : "No"} />
            {u.bio && <Row k="Bio" v={u.bio} />}
            <StatEditor u={u} onSave={(x) => run("set_stats", x, "Stats updated")} />
          </Card>
          <Card className="space-y-3">
            <div className="font-bold">Admin note (private)</div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-32" placeholder="Anything you want to remember about this person…" />
            <Button size="sm" disabled={note === u.adminNote} onClick={() => run("note", { note }, "Note saved")}>
              Save note
            </Button>
          </Card>
          <Card className="p-0 md:col-span-2">
            <div className="px-4 pt-4 pb-2 font-bold">Ranks & best lifts</div>
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {GROUPS.map((g) => (
                <span key={g.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[12px]">
                  {g.name}: {ranks.groups[g.id].best ? <RankChip score={ranks.groups[g.id].score} /> : <span className="text-dim">—</span>}
                </span>
              ))}
            </div>
            <Table head={["Exercise", "Best set", "e1RM", "Relative", "Rank", "When"]}>
              {data.records.map((rec) => {
                const ex = getExercise(rec.exercise);
                const sc = ranks.exercises.find((e) => e.id === rec.exercise)?.score;
                return (
                  <tr key={rec.exercise}>
                    <td className="px-3 py-2 font-semibold">{exerciseName(rec.exercise)}</td>
                    <td className="tabular px-3 py-2">
                      {fmtW(Number(rec.weight_kg), me.unit)} × {rec.reps}
                    </td>
                    <td className="tabular px-3 py-2">{fmtW(Number(rec.e1rm_kg), me.unit)}</td>
                    <td className="tabular px-3 py-2">{ex ? fmtMetric(ex, Number(rec.metric)) : "—"}</td>
                    <td className="px-3 py-2">{sc != null ? <RankChip score={sc} /> : <span className="text-dim">custom</span>}</td>
                    <td className="px-3 py-2 text-dim">{ago(rec.done_at)}</td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </div>
      )}

      {section === "ips" && (
        <>
          <Table head={["IP address", "Location", "Device", "Visits", "First seen", "Last seen", "Shared with"]}>
            {data.ips.map((ip) => (
              <tr key={ip.ip}>
                <td className="px-3 py-2">
                  <Link href={`/admin/ip/${encodeURIComponent(ip.ip)}`} className="font-mono font-semibold text-lime hover:underline">
                    {flag(ip.country)} {ip.ip}
                  </Link>
                </td>
                <td className="px-3 py-2">{place(ip) || "Unknown"}</td>
                <td className="px-3 py-2 text-muted" title={ip.user_agent ?? ""}>
                  {device(ip.user_agent)}
                </td>
                <td className="tabular px-3 py-2">{ip.hits}</td>
                <td className="px-3 py-2 text-dim">{new Date(ip.first_seen).toLocaleString()}</td>
                <td className="px-3 py-2 text-dim">{ago(ip.last_seen)}</td>
                <td className="px-3 py-2">{ip.shared > 0 ? <Pill tone="warn">{ip.shared} other account{ip.shared > 1 ? "s" : ""}</Pill> : <span className="text-dim">—</span>}</td>
              </tr>
            ))}
          </Table>
          <p className="text-[12px] text-dim">Every IP this account signed in or used the app from. Location is approximate (city level, from Vercel).</p>
        </>
      )}

      {section === "workouts" && (
        <div className="card divide-y divide-line p-0">
          {data.workouts.length === 0 && <div className="p-4 text-[14px] text-muted">No workouts.</div>}
          {data.workouts.map((w) => (
            <div key={w.id} className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => setWorkout(w.id)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2 font-semibold">
                  {w.title}
                  {w.prCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[12px] text-warn">
                      <Trophy className="h-3 w-3" /> {w.prCount}
                    </span>
                  )}
                </div>
                <div className="truncate text-[12px] text-muted">
                  {new Date(w.startedAt).toLocaleString()} · {fmtDuration(w.durationSec)} · {w.setCount} sets · {fmtBig(w.volumeKg, me.unit)} · BW {fmtW(w.bwKg, me.unit)}
                </div>
                <div className="truncate text-[12px] text-dim">{w.exercises.map((e) => `${e.sets}× ${exerciseName(e.id)}`).join(" · ")}</div>
              </button>
              <Button size="sm" variant="danger" onClick={() => confirm("Delete this workout (and its PRs)?") && run("delete_workout", { targetId: w.id }, "Workout deleted")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {section === "meals" && (
        <div className="space-y-3">
          {mealDays.length === 0 && <Card className="text-[14px] text-muted">No meals logged.</Card>}
          {mealDays.map((d) => {
            const items = data.meals.filter((m) => m.day === d);
            const tot = items.reduce((s, m) => ({ kcal: s.kcal + Number(m.kcal), p: s.p + Number(m.protein), c: s.c + Number(m.carbs), f: s.f + Number(m.fat) }), { kcal: 0, p: 0, c: 0, f: 0 });
            const water = data.water.find((w) => w.day === d);
            return (
              <Card key={d} className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <div className="font-bold">{new Date(`${d}T12:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
                  <div className="tabular text-[13px] text-muted">
                    <span className="font-bold text-ink">{Math.round(tot.kcal)} kcal</span> · P {Math.round(tot.p)} · C {Math.round(tot.c)} · F {Math.round(tot.f)}
                    {water ? ` · 💧 ${(water.ml / 1000).toFixed(2)} L` : ""}
                  </div>
                </div>
                <div className="divide-y divide-line">
                  {items.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                      <Pill>{m.meal}</Pill>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{m.name}</div>
                        <div className="truncate text-[12px] text-muted">
                          {Number(m.servings) !== 1 ? `${Number(m.servings)} × ` : ""}
                          {m.serving} · P {Math.round(Number(m.protein))} C {Math.round(Number(m.carbs))} F {Math.round(Number(m.fat))} · {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                      <div className="tabular font-bold">{Math.round(Number(m.kcal))}</div>
                      <button className="press grid h-8 w-8 place-items-center rounded-full text-dim" onClick={() => confirm("Delete this meal?") && run("delete_meal", { targetId: m.id }, "Meal deleted")}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {section === "body" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="p-0">
            <div className="px-4 pt-4 pb-2 font-bold">Body scans</div>
            <div className="divide-y divide-line">
              {data.scans.length === 0 && <div className="px-4 pb-4 text-[14px] text-muted">No scans. (Photos never leave the user&apos;s phone — only measurements are stored.)</div>}
              {data.scans.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 text-[13px]">
                  <span className="h-5 w-5 shrink-0 rounded-full border border-line-2" style={{ background: s.skin }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {fmtW(Number(s.weight_kg), me.unit)} · {(Number(s.body_fat) * 100).toFixed(1)}% BF · {Math.round(Number(s.height_cm))} cm
                    </div>
                    <div className="truncate text-[12px] text-muted">
                      {new Date(s.created_at).toLocaleString()} · {s.source}
                      {s.metrics ? ` · shoulders ${s.metrics.shoulder?.toFixed(3)} · waist ${s.metrics.waist?.toFixed(3)} · hips ${s.metrics.hip?.toFixed(3)}` : ""}
                    </div>
                  </div>
                  <button className="press grid h-8 w-8 place-items-center rounded-full text-dim" onClick={() => confirm("Delete this scan?") && run("delete_scan", { targetId: s.id }, "Scan deleted")}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-0">
            <div className="px-4 pt-4 pb-2 font-bold">Bodyweight log</div>
            <div className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {data.weights.length === 0 && <div className="px-4 pb-4 text-[14px] text-muted">No weigh-ins.</div>}
              {data.weights.map((w) => (
                <div key={w.day} className="flex justify-between px-4 py-2 text-[13px]">
                  <span>{w.day}</span>
                  <span className="tabular font-semibold">{fmtW(Number(w.weight_kg), me.unit)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {section === "social" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="space-y-2 text-[14px]">
            <div className="font-bold">Follows</div>
            <div>
              <span className="text-muted">Followers ({data.followers.length}):</span> {data.followers.map((f) => `@${f}`).join(", ") || "—"}
            </div>
            <div>
              <span className="text-muted">Following ({data.following.length}):</span> {data.following.map((f) => `@${f}`).join(", ") || "—"}
            </div>
          </Card>
          <Card className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold">Support thread</div>
              <Link href="/admin?tab=support" className="text-[13px] text-lime">
                Reply in Support
              </Link>
            </div>
            {data.support.length === 0 && <div className="text-[13px] text-muted">No messages.</div>}
            <div className="max-h-60 space-y-1.5 overflow-y-auto">
              {data.support.map((m) => (
                <div key={m.id} className={clsx("rounded-xl px-3 py-2 text-[13px]", m.from_admin ? "bg-lime/10" : "bg-surface-3")}>
                  <span className="font-bold">{m.from_admin ? "You" : u.name}:</span> {m.body} <span className="text-dim">· {ago(m.created_at)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <div className="font-bold">Chat messages</div>
              {data.chat.length > 0 && (
                <Button size="sm" variant="danger" onClick={() => confirm("Hide all of this user's chat messages?") && run("clear_chat", {}, "Messages hidden")}>
                  Hide all
                </Button>
              )}
            </div>
            {data.chat.length === 0 && <div className="text-[13px] text-muted">No chat messages.</div>}
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {data.chat.map((m) => (
                <div key={m.id} className={clsx("rounded-xl bg-surface-3 px-3 py-2 text-[13px]", m.deleted && "line-through opacity-50")}>
                  {m.body} <span className="text-dim">· {ago(m.created_at)}</span>
                </div>
              ))}
            </div>
          </Card>
          <div className="space-y-2 md:col-span-2">
            <SectionTitle className="mt-2">Challenges</SectionTitle>
            {data.challenges.length === 0 ? <Card className="text-[13px] text-muted">None.</Card> : data.challenges.map((c) => <ChallengeCard key={c.id} c={c} />)}
          </div>
        </div>
      )}

      <WorkoutSheet id={workout} onClose={() => setWorkout(null)} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line pb-1.5 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right font-semibold capitalize">{v}</span>
    </div>
  );
}

function StatEditor({ u, onSave }: { u: Detail["user"]; onSave: (x: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(u.heightCm ? String(Math.round(u.heightCm)) : "");
  const [w, setW] = useState(u.weightKg ? String(Math.round(u.weightKg * 10) / 10) : "");
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Edit height / weight
      </Button>
    );
  return (
    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 pt-1">
      <Field label="Height (cm)">
        <Input inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} />
      </Field>
      <Field label="Weight (kg)">
        <Input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />
      </Field>
      <Button
        onClick={() => {
          onSave({ heightCm: Number(h) || undefined, weightKg: Number(w) || undefined });
          setOpen(false);
        }}
      >
        Save
      </Button>
    </div>
  );
}

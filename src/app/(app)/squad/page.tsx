"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Crown, MessageCircle, Send, Swords, Users } from "lucide-react";
import { api } from "@/client/api";
import { useMe } from "@/client/me";
import { fail, useData } from "@/client/store";
import type { Challenge, Player, Workout } from "@/client/types";
import { Avatar, Button, Chips, Empty, PageHeader, Segmented, Select, Skeleton } from "@/components/ui";
import { RankChip } from "@/components/rank";
import { FollowButton, NewChallenge } from "@/components/social";
import { WorkoutCard } from "@/components/workout";
import { ChallengeCard } from "@/components/challenge";
import { EXERCISES, FEATURED, getExercise } from "@/shared/exercises";
import { rankInfo } from "@/shared/ranks";
import { ago, fmtBig, fmtW } from "@/shared/units";

type Tab = "feed" | "players" | "board" | "challenges" | "chat";

export default function SquadPage() {
  return (
    <Suspense fallback={<Skeleton className="mt-20 h-64" />}>
      <Squad />
    </Suspense>
  );
}

function Squad() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "feed";
  const setTab = (t: Tab) => router.replace(`/squad?tab=${t}`, { scroll: false });
  return (
    <div className="rise">
      <PageHeader title="Squad" subtitle="Track, compete, talk trash." />
      <div className="no-scrollbar -mx-4 mb-4 overflow-x-auto px-4">
        <Segmented
          value={tab}
          onChange={setTab}
          className="min-w-[440px]"
          options={[
            { id: "feed", label: "Feed" },
            { id: "players", label: "Players" },
            { id: "board", label: "Leaderboard" },
            { id: "challenges", label: "Challenges" },
            { id: "chat", label: "Chat" },
          ]}
        />
      </div>
      {tab === "feed" && <Feed />}
      {tab === "players" && <Players />}
      {tab === "board" && <Board />}
      {tab === "challenges" && <Challenges />}
      {tab === "chat" && <Chat />}
    </div>
  );
}

/* ---------------------------------- feed ----------------------------------- */

function Feed() {
  const [scope, setScope] = useState<"all" | "following">("all");
  const { data } = useData<{ workouts: Workout[] }>(`/api/feed?scope=${scope}&limit=30`);
  return (
    <>
      <Chips value={scope} onChange={setScope} options={[{ id: "all", label: "Everyone" }, { id: "following", label: "Following" }]} />
      <div className="mt-3 space-y-2.5">
        {!data ? (
          <Skeleton className="h-48" />
        ) : data.workouts.length === 0 ? (
          <Empty icon={<Users />} title="Quiet in here">
            {scope === "following" ? "Follow players to see their workouts." : "No workouts logged yet."}
          </Empty>
        ) : (
          data.workouts.map((w) => <WorkoutCard key={w.id} w={w} />)
        )}
      </div>
    </>
  );
}

/* -------------------------------- players ---------------------------------- */

function Players() {
  const { data } = useData<{ players: Player[] }>("/api/players");
  if (!data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-2">
      {data.players.map((p, i) => (
        <Link key={p.id} href={`/u/${p.username}`} className="card press flex items-center gap-3 p-3.5">
          <div className="font-display w-6 text-center text-[18px] font-black text-dim italic">{i + 1}</div>
          <Avatar name={p.name} color={p.color} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-bold">{p.name}</span>
              {p.isMe && <span className="rounded bg-lime/20 px-1.5 text-[10px] font-bold text-lime">YOU</span>}
              {p.followsMe && !p.isMe && <span className="rounded bg-white/10 px-1.5 text-[10px] font-bold text-muted">FOLLOWS YOU</span>}
            </div>
            <div className="truncate text-[12px] text-muted">
              @{p.username} · {p.workoutsThisWeek} this week{p.lastSeen ? ` · active ${ago(p.lastSeen)}` : ""}
            </div>
            <div className="mt-1">
              <RankChip score={p.score} showSr />
            </div>
          </div>
          {!p.isMe && <FollowButton username={p.username} following={p.following} />}
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------- leaderboard ------------------------------- */

type Row = { id: string; username: string; name: string; color: string; isMe: boolean; score: number; value: number; metric?: number; weightKg?: number; reps?: number };

function Board() {
  const { me } = useMe();
  const [kind, setKind] = useState<"overall" | "lift" | "volume" | "workouts">("overall");
  const [exercise, setExercise] = useState("bench");
  const { data } = useData<{ rows: Row[] }>(`/api/leaderboard?kind=${kind}${kind === "lift" ? `&exercise=${exercise}` : ""}`);
  const ex = getExercise(exercise);
  const value = (r: Row) => {
    if (kind === "overall") return `${rankInfo(r.score).sr.toLocaleString()} SR`;
    if (kind === "lift") return ex?.kind === "bodyweight" ? `${Math.round(r.metric ?? 0)} reps` : `${fmtW(r.value, me.unit)} · ${(r.metric ?? 0).toFixed(2)}×`;
    if (kind === "volume") return fmtBig(r.value, me.unit);
    return `${r.value} workouts`;
  };
  return (
    <>
      <Chips
        value={kind}
        onChange={setKind}
        options={[
          { id: "overall", label: "Overall" },
          { id: "lift", label: "By lift" },
          { id: "volume", label: "Volume · 7d" },
          { id: "workouts", label: "Workouts · 30d" },
        ]}
      />
      {kind === "lift" && (
        <Select className="mt-3" value={exercise} onChange={(e) => setExercise(e.target.value)}>
          {[...FEATURED.map((id) => getExercise(id)!), ...EXERCISES.filter((e) => !FEATURED.includes(e.id))].map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      )}
      <div className="mt-3">
        {!data ? (
          <Skeleton className="h-64" />
        ) : data.rows.length === 0 ? (
          <Empty title="No one yet">Be the first on the board.</Empty>
        ) : (
          <>
            <Podium rows={data.rows.slice(0, 3)} value={value} />
            <div className="card mt-3 divide-y divide-line">
              {data.rows.map((r, i) => (
                <Link key={r.id} href={`/u/${r.username}`} className={clsx("flex items-center gap-3 px-4 py-3", r.isMe && "bg-lime/[0.06]")}>
                  <span className={clsx("font-display w-6 text-center text-[18px] font-black italic", i === 0 ? "text-warn" : "text-dim")}>{i + 1}</span>
                  <Avatar name={r.name} color={r.color} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold">{r.name}</div>
                    <div className="text-[11px]" style={{ color: rankInfo(r.score).tier.ink }}>
                      {rankInfo(r.score).name}
                    </div>
                  </div>
                  <div className="tabular text-right text-[13px] font-bold">{value(r)}</div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Podium({ rows, value }: { rows: Row[]; value: (r: Row) => string }) {
  const order = [rows[1], rows[0], rows[2]];
  return (
    <div className="card flex items-end justify-center gap-3 px-3 pt-5 pb-0">
      {order.map((r, i) =>
        r ? (
          <Link key={r.id} href={`/u/${r.username}`} className="flex flex-1 flex-col items-center">
            {i === 1 && <Crown className="mb-1 h-5 w-5 text-warn" />}
            <Avatar name={r.name} color={r.color} size={i === 1 ? 56 : 44} />
            <div className="mt-1.5 max-w-full truncate text-[13px] font-bold">{r.name.split(" ")[0]}</div>
            <div className="tabular max-w-full truncate text-[11px] text-muted">{value(r)}</div>
            <div
              className="font-display mt-2 flex w-full items-start justify-center rounded-t-2xl pt-2 text-[26px] font-black italic"
              style={{ height: i === 1 ? 84 : i === 0 ? 62 : 46, background: `linear-gradient(180deg, ${rankInfo(r.score).tier.c2}66, transparent)` }}
            >
              {i === 1 ? 1 : i === 0 ? 2 : 3}
            </div>
          </Link>
        ) : (
          <div key={i} className="flex-1" />
        ),
      )}
    </div>
  );
}

/* ------------------------------- challenges -------------------------------- */

function Challenges() {
  const { data } = useData<{ challenges: Challenge[] }>("/api/challenges");
  const [creating, setCreating] = useState(false);
  const active = data?.challenges.filter((c) => c.status === "active") ?? [];
  const past = data?.challenges.filter((c) => c.status !== "active") ?? [];
  return (
    <>
      <Button size="lg" block onClick={() => setCreating(true)}>
        <Swords className="h-5 w-5" /> New challenge
      </Button>
      {!data ? (
        <Skeleton className="mt-3 h-40" />
      ) : data.challenges.length === 0 ? (
        <div className="mt-3">
          <Empty icon={<Swords />} title="No challenges yet">
            Call someone out: most volume this week, heaviest bench, most workouts…
          </Empty>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2.5">
            {active.map((c) => (
              <ChallengeCard key={c.id} c={c} />
            ))}
          </div>
          {past.length > 0 && (
            <>
              <div className="mt-6 mb-2 px-1 text-[12px] font-bold tracking-widest text-muted uppercase">Finished</div>
              <div className="space-y-2.5">
                {past.map((c) => (
                  <ChallengeCard key={c.id} c={c} />
                ))}
              </div>
            </>
          )}
        </>
      )}
      <NewChallenge open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

/* ---------------------------------- chat ----------------------------------- */

type Msg = { id: number; body: string; createdAt: string; user: { id: string; username: string; name: string; color: string } };

function Chat() {
  const { me } = useMe();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [muted, setMuted] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const last = useRef(0);

  useEffect(() => {
    let stop = false;
    const poll = async (first: boolean) => {
      try {
        const r = await api<{ messages: Msg[]; muted: boolean }>(first ? "/api/chat" : `/api/chat?after=${last.current}`);
        if (stop) return;
        setMuted(r.muted);
        if (r.messages.length) last.current = r.messages[r.messages.length - 1].id;
        setMsgs((old) => (first ? r.messages : [...(old ?? []), ...r.messages.filter((m) => !(old ?? []).some((o) => o.id === m.id))]));
      } catch {}
    };
    void poll(true);
    const t = setInterval(() => document.visibilityState === "visible" && poll(false), 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs?.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const r = await api<{ message: Msg }>("/api/chat", { body: { body } });
      setText("");
      last.current = Math.max(last.current, r.message.id);
      setMsgs((old) => [...(old ?? []), r.message]);
    } catch (e) {
      fail(e);
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col">
      <div className="card flex items-center gap-2 px-4 py-2.5 text-[13px] text-muted">
        <MessageCircle className="h-4 w-4 text-lime" /> Locker Room · everyone in the squad
      </div>
      <div className="mt-3 min-h-[40dvh] space-y-2 pb-24">
        {!msgs ? (
          <Skeleton className="h-40" />
        ) : msgs.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-muted">No messages yet. Start the trash talk 😤</p>
        ) : (
          msgs.map((m, i) => {
            const mine = m.user.id === me.id;
            const showName = !mine && (i === 0 || msgs[i - 1].user.id !== m.user.id);
            return (
              <div key={m.id} className={clsx("flex items-end gap-2", mine && "justify-end")}>
                {!mine && (showName ? <Avatar name={m.user.name} color={m.user.color} size={28} /> : <span className="w-7" />)}
                <div className="max-w-[78%]">
                  {showName && <div className="mb-0.5 ml-1 text-[11px] font-semibold text-muted">{m.user.name}</div>}
                  <div className={clsx("rounded-2xl px-3.5 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap", mine ? "rounded-br-md bg-lime text-black" : "rounded-bl-md bg-surface-3")}>
                    {m.body}
                  </div>
                  <div className={clsx("mt-0.5 text-[10px] text-dim", mine ? "mr-1 text-right" : "ml-1")}>{ago(m.createdAt)}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>
      <div className="fixed inset-x-0 bottom-[calc(max(var(--sab),10px)+78px)] z-30 px-4">
        <div className="glass mx-auto flex max-w-[488px] items-end gap-2 rounded-3xl border border-line-2 p-2">
          {muted ? (
            <div className="flex-1 px-3 py-2 text-[14px] text-bad">You&apos;ve been muted by the admin.</div>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder="Say something…"
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-[16px] outline-none placeholder:text-dim"
              />
              <button onClick={send} disabled={sending || !text.trim()} className="press grid h-10 w-10 place-items-center rounded-full bg-lime text-black disabled:opacity-40" aria-label="Send">
                <Send className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


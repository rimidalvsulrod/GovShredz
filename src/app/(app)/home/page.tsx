"use client";
import Link from "next/link";
import { ChevronRight, Dumbbell, Flame, Megaphone, MessageCircle, ScanLine, Settings, Shield, Trophy, UtensilsCrossed, X } from "lucide-react";
import { useMe } from "@/client/me";
import { useData, useLocal } from "@/client/store";
import type { Challenge, Pr, Targets, Workout } from "@/client/types";
import { Avatar, Card, Progress, SectionTitle, Skeleton } from "@/components/ui";
import { RankBadge, RankChip, RankProgress } from "@/components/rank";
import { Ring } from "@/components/charts";
import { WorkoutCard } from "@/components/workout";
import { ChallengeCard } from "@/components/challenge";
import { exerciseName, GROUPS, OVERALL_GROUPS } from "@/shared/exercises";
import { profileRanks, rankInfo } from "@/shared/ranks";
import { ago, dayKey, fmtBig, fmtW, shiftDay } from "@/shared/units";

type Home = {
  bests: Record<string, number>;
  streak: number;
  activeDays: string[];
  week: { workouts: number; volumeKg: number; sets: number };
  prs: Pr[];
  nutrition: { eaten: { kcal: number; protein: number; carbs: number; fat: number }; targets: Targets; waterMl: number };
  challenges: Challenge[];
  feed: Workout[];
  announcements: { id: number; body: string; tone: string; createdAt: string }[];
  unreadSupport: number;
};

export default function HomePage() {
  const { me } = useMe();
  const today = dayKey();
  const { data } = useData<Home>(`/api/home?today=${today}`);
  const [dismissed, setDismissed] = useLocal<number[]>("gs:dismissed", []);
  const ranks = data ? profileRanks(data.bests, me.sex) : null;
  const r = rankInfo(ranks?.overall ?? 0);
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));
  const hour = new Date().getHours();
  const hello = hour < 5 ? "Late night grind" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  return (
    <div className="rise">
      <header className="pt-safe mb-5 flex items-center gap-3">
        <Link href={`/u/${me.username}`}>
          <Avatar name={me.name} color={me.color} size={44} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-muted">{hello},</div>
          <div className="font-display truncate text-[26px] leading-none font-black uppercase italic">{me.name.split(" ")[0]}</div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-hot/30 bg-hot/10 px-3 py-1.5 text-[14px] font-bold text-hot" title="Active-day streak">
          <Flame className="h-4 w-4" /> {data?.streak ?? 0}
        </div>
        {me.isAdmin && (
          <Link href="/admin" className="press grid h-10 w-10 place-items-center rounded-full bg-lime/15 text-lime" aria-label="Admin">
            <Shield className="h-5 w-5" />
          </Link>
        )}
        <Link href="/settings" className="press relative grid h-10 w-10 place-items-center rounded-full bg-white/[0.06]" aria-label="Settings">
          <Settings className="h-5 w-5" />
          {!!data?.unreadSupport && <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-hot" />}
        </Link>
      </header>

      {data?.announcements
        .filter((a) => !dismissed.includes(a.id))
        .map((a) => (
          <div
            key={a.id}
            className={`mb-3 flex items-start gap-3 rounded-2xl border p-3.5 text-[14px] ${
              a.tone === "warn" ? "border-warn/30 bg-warn/10 text-warn" : a.tone === "hype" ? "border-lime/30 bg-lime/10 text-lime" : "border-cyan/30 bg-cyan/10 text-cyan"
            }`}
          >
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1 whitespace-pre-wrap text-ink">{a.body}</div>
            <button onClick={() => setDismissed([...dismissed, a.id])} aria-label="Dismiss">
              <X className="h-4 w-4 opacity-60" />
            </button>
          </div>
        ))}

      {!!data?.unreadSupport && (
        <Link href="/settings#support" className="card press mb-3 flex items-center gap-3 p-3.5">
          <MessageCircle className="h-5 w-5 text-lime" />
          <span className="flex-1 text-[14px] font-semibold">The admin replied to your message</span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
      )}

      {/* Rank hero */}
      <Link href="/ranks" className="card press relative block overflow-hidden p-5">
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-30 blur-3xl" style={{ background: r.tier.c2 }} />
        <div className="relative flex items-center gap-4">
          {data ? <RankBadge score={r.score} size={92} className="float" /> : <Skeleton className="h-[101px] w-[92px]" />}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-widest text-muted uppercase">Overall rank</div>
            <div className="font-display text-[42px] leading-[0.95] font-black uppercase italic" style={{ color: r.tier.ink }}>
              {r.name}
            </div>
            <div className="mt-0.5 text-[13px] text-muted">
              <span className="tabular font-bold text-ink">{r.sr.toLocaleString()}</span> SR
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted" />
        </div>
        <RankProgress score={r.score} className="relative mt-4" />
        {ranks && ranks.missing.length > 0 && (
          <div className="relative mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-[12px] text-muted">
            Log {ranks.missing.map((g) => GROUPS.find((x) => x.id === g)!.name.toLowerCase()).join(", ")} to boost your overall rank.
          </div>
        )}
      </Link>

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-[1.4fr_1fr_1fr] gap-2.5">
        <Link href="/train" className="press lime-glow flex h-[88px] flex-col justify-between rounded-[22px] bg-lime p-3.5 text-black">
          <Dumbbell className="h-6 w-6" strokeWidth={2.4} />
          <span className="font-display text-[20px] leading-none font-black uppercase italic">Start workout</span>
        </Link>
        <Link href="/fuel" className="card press flex h-[88px] flex-col justify-between p-3.5">
          <UtensilsCrossed className="h-5 w-5 text-cyan" />
          <span className="text-[14px] leading-tight font-bold">Log meal</span>
        </Link>
        <Link href="/body" className="card press flex h-[88px] flex-col justify-between p-3.5">
          <ScanLine className="h-5 w-5 text-pink" />
          <span className="text-[14px] leading-tight font-bold">Body scan</span>
        </Link>
      </div>

      {/* Today + week */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Link href="/fuel" className="card press flex items-center gap-3 p-3.5">
          {data ? (
            <Ring value={data.nutrition.eaten.kcal / data.nutrition.targets.kcal} size={64} stroke={7} color="#2ee6ff">
              <Flame className="h-4 w-4 text-cyan" />
            </Ring>
          ) : (
            <Skeleton className="h-16 w-16 rounded-full" />
          )}
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-wider text-muted uppercase">Today</div>
            <div className="font-display tabular text-[22px] leading-none font-extrabold">{Math.round(data?.nutrition.eaten.kcal ?? 0)}</div>
            <div className="text-[11px] text-muted">/ {data?.nutrition.targets.kcal ?? "—"} kcal</div>
          </div>
        </Link>
        <div className="card p-3.5">
          <div className="text-[11px] font-bold tracking-wider text-muted uppercase">This week</div>
          <div className="mt-1.5 flex justify-between">
            {week.map((d) => {
              const on = data?.activeDays.includes(d);
              return (
                <div key={d} className="flex flex-col items-center gap-1">
                  <span className={`h-5 w-5 rounded-md ${on ? "bg-lime shadow-[0_0_10px_rgba(200,255,46,0.5)]" : "bg-white/[0.07]"} ${d === today ? "ring-1 ring-white/40" : ""}`} />
                  <span className="text-[9px] text-dim">{"SMTWTFS"[new Date(`${d}T12:00`).getDay()]}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 text-[11px] text-muted">
            <span className="font-bold text-ink">{data?.week.workouts ?? 0}</span> workouts · {fmtBig(data?.week.volumeKg ?? 0, me.unit)}
          </div>
        </div>
      </div>
      {data && (
        <div className="card mt-2.5 p-3.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-semibold">Protein</span>
            <span className="tabular text-muted">
              {Math.round(data.nutrition.eaten.protein)} / {data.nutrition.targets.protein} g
            </span>
          </div>
          <Progress value={data.nutrition.eaten.protein / data.nutrition.targets.protein} color="#ff3d8b" className="mt-2" />
        </div>
      )}

      {/* Muscle ranks */}
      <SectionTitle action={<Link href="/ranks" className="text-[13px] font-semibold text-lime">All ranks</Link>}>Muscle ranks</SectionTitle>
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4">
        {OVERALL_GROUPS.concat("core").map((g) => {
          const s = ranks?.groups[g]?.score ?? 0;
          return (
            <Link href="/ranks" key={g} className="card press flex w-[92px] shrink-0 flex-col items-center gap-1.5 px-2 py-3">
              <RankBadge score={s} size={44} dim={!ranks?.groups[g]?.best} />
              <div className="text-[12px] font-bold">{GROUPS.find((x) => x.id === g)!.name}</div>
              <div className="text-[10px] font-semibold" style={{ color: rankInfo(s).tier.ink }}>
                {ranks?.groups[g]?.best ? rankInfo(s).name : "Unranked"}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Challenges */}
      {data && data.challenges.length > 0 && (
        <>
          <SectionTitle action={<Link href="/squad?tab=challenges" className="text-[13px] font-semibold text-lime">All</Link>}>Challenges</SectionTitle>
          <div className="space-y-2.5">
            {data.challenges.slice(0, 3).map((c) => (
              <ChallengeCard key={c.id} c={c} />
            ))}
          </div>
        </>
      )}

      {/* PRs */}
      <SectionTitle>Recent PRs</SectionTitle>
      {!data ? (
        <Skeleton className="h-24" />
      ) : data.prs.length === 0 ? (
        <Card className="text-[14px] text-muted">No PRs yet. Log your first workout and every lift is a PR.</Card>
      ) : (
        <div className="card divide-y divide-line">
          {data.prs.map((p, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Trophy className="h-5 w-5 shrink-0 text-warn" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold">{exerciseName(p.exercise)}</div>
                <div className="text-[12px] text-muted">
                  {p.weightKg ? `${fmtW(p.weightKg, me.unit)} × ${p.reps}` : `${p.reps} reps`} · {ago(p.date)}
                </div>
              </div>
              {p.metric > 0 && ranks && <RankChip score={ranks.exercises.find((e) => e.id === p.exercise)?.score ?? 0} />}
            </div>
          ))}
        </div>
      )}

      {/* Feed */}
      <SectionTitle action={<Link href="/squad" className="text-[13px] font-semibold text-lime">Squad</Link>}>Squad activity</SectionTitle>
      {!data ? (
        <Skeleton className="h-40" />
      ) : data.feed.length === 0 ? (
        <Card className="text-[14px] text-muted">Nothing yet. Workouts from you and your squad show up here.</Card>
      ) : (
        <div className="space-y-2.5">
          {data.feed.map((w) => (
            <WorkoutCard key={w.id} w={w} />
          ))}
        </div>
      )}
    </div>
  );
}

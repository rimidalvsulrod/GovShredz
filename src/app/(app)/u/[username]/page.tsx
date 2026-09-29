"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Lock, Pencil, Swords, Trophy } from "lucide-react";
import { useMe } from "@/client/me";
import { useData } from "@/client/store";
import type { Workout } from "@/client/types";
import { Avatar, Button, Card, Empty, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { RankBadge, RankProgress } from "@/components/rank";
import { WorkoutCard } from "@/components/workout";
import { FollowButton, NewChallenge } from "@/components/social";
import { MiniBody } from "@/components/mini-body";
import { GROUPS, getExercise } from "@/shared/exercises";
import { fmtMetric, profileRanks, rankInfo, type Sex } from "@/shared/ranks";
import { bfLabel } from "@/shared/physique";
import { dayKey, fmtBig, fmtHeight, fmtW } from "@/shared/units";
import type { PhotoMetrics } from "@/shared/physique";

type Profile = {
  player: { id: string; username: string; name: string; bio: string; color: string; sex: Sex; joinedAt: string; isMe: boolean; following: boolean };
  stats: { workouts: number; volumeKg: number; prs: number; followers: number; following: number; streak: number };
  bests: Record<string, number>;
  workouts: Workout[];
  workoutsPrivate: boolean;
  physique: { heightCm: number; weightKg: number; bodyFat: number; metrics: PhotoMetrics | null; skin: string; age: number; scannedAt: string } | null;
};

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { me } = useMe();
  const { data, error } = useData<Profile>(`/api/players/${encodeURIComponent(username)}?today=${dayKey()}`);
  const [challenge, setChallenge] = useState(false);
  if (error) return <Empty title="Player not found">{error.message}</Empty>;
  if (!data) return <Skeleton className="mt-20 h-80" />;
  const p = data.player;
  const ranks = profileRanks(data.bests, p.sex);
  const r = rankInfo(ranks.overall);
  return (
    <div className="rise">
      <PageHeader title="" back />
      <div className="-mt-4 flex flex-col items-center text-center">
        <Avatar name={p.name} color={p.color} size={88} />
        <h1 className="font-display mt-3 text-[34px] leading-none font-black uppercase italic">{p.name}</h1>
        <div className="mt-1 text-[14px] text-muted">@{p.username}</div>
        {p.bio && <p className="mt-2 max-w-[320px] text-[14px] text-ink/80">{p.bio}</p>}
        <div className="mt-4 flex gap-2">
          {p.isMe ? (
            <Link href="/settings" className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[14px] font-bold">
              <Pencil className="h-4 w-4" /> Edit profile
            </Link>
          ) : (
            <>
              <FollowButton username={p.username} following={p.following} />
              <Link href={`/versus/${p.username}`} className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-hot/15 px-3.5 text-[13px] font-bold text-hot">
                <Swords className="h-4 w-4" /> Versus
              </Link>
              <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setChallenge(true)}>
                Challenge
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="relative mt-5 overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full opacity-25 blur-3xl" style={{ background: r.tier.c2 }} />
        <div className="relative flex items-center gap-4">
          <RankBadge score={r.score} size={72} />
          <div className="flex-1">
            <div className="text-[11px] font-bold tracking-widest text-muted uppercase">Overall</div>
            <div className="font-display text-[32px] leading-none font-black uppercase italic" style={{ color: r.tier.ink }}>
              {r.name}
            </div>
            <div className="tabular text-[13px] text-muted">{r.sr.toLocaleString()} SR</div>
          </div>
        </div>
        <RankProgress score={r.score} className="relative mt-3" />
        <div className="relative mt-4 grid grid-cols-6 gap-1">
          {GROUPS.map((g) => (
            <div key={g.id} className="flex flex-col items-center">
              <RankBadge score={ranks.groups[g.id].score} size={34} dim={!ranks.groups[g.id].best} />
              <div className="mt-1 text-[9px] font-semibold text-muted">{g.name}</div>
            </div>
          ))}
        </div>
        {!p.isMe && (
          <Link href={`/ranks?user=${p.username}`} className="relative mt-3 block text-center text-[13px] font-semibold text-lime">
            See all ranks
          </Link>
        )}
      </Card>

      <div className="mt-2.5 grid grid-cols-3 gap-2.5">
        {(
          [
            ["Workouts", data.stats.workouts],
            ["Volume", fmtBig(data.stats.volumeKg, me.unit)],
            ["PRs", data.stats.prs],
            ["Streak", `🔥 ${data.stats.streak}`],
            ["Followers", data.stats.followers],
            ["Following", data.stats.following],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="card p-3 text-center">
            <div className="font-display tabular text-[22px] leading-none font-extrabold">{v}</div>
            <div className="mt-1 text-[11px] text-muted">{k}</div>
          </div>
        ))}
      </div>

      {ranks.exercises.length > 0 && (
        <>
          <SectionTitle>Top lifts</SectionTitle>
          <div className="card divide-y divide-line">
            {ranks.exercises.slice(0, 6).map((e) => {
              const ex = getExercise(e.id)!;
              const info = rankInfo(e.score);
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <RankBadge score={e.score} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold">{ex.name}</div>
                    <div className="text-[12px] text-muted">{fmtMetric(ex, e.metric)}</div>
                  </div>
                  <div className="text-[13px] font-bold" style={{ color: info.tier.ink }}>
                    {info.name}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {data.physique && (
        <>
          <SectionTitle>Physique</SectionTitle>
          <Card className="p-0">
            <MiniBody
              className="h-[340px]"
              sex={p.sex}
              heightCm={data.physique.heightCm}
              weightKg={data.physique.weightKg}
              bodyFat={data.physique.bodyFat}
              age={data.physique.age}
              metrics={data.physique.metrics}
              skin={data.physique.skin}
              strength={ranks.overall}
            />
            <div className="grid grid-cols-3 border-t border-line text-center">
              <div className="p-3">
                <div className="font-bold">{fmtHeight(data.physique.heightCm, me.unit)}</div>
                <div className="text-[11px] text-muted">Height</div>
              </div>
              <div className="border-x border-line p-3">
                <div className="font-bold">{fmtW(data.physique.weightKg, me.unit)}</div>
                <div className="text-[11px] text-muted">Weight</div>
              </div>
              <div className="p-3">
                <div className="font-bold">{(data.physique.bodyFat * 100).toFixed(1)}%</div>
                <div className="text-[11px] text-muted">{bfLabel(data.physique.bodyFat, p.sex)}</div>
              </div>
            </div>
          </Card>
        </>
      )}

      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <Trophy className="h-5 w-5" /> Recent workouts
        </span>
      </SectionTitle>
      {data.workoutsPrivate ? (
        <Empty icon={<Lock />} title="Workouts are private" />
      ) : data.workouts.length === 0 ? (
        <Empty title="No workouts yet" />
      ) : (
        <div className="space-y-2.5">
          {data.workouts.map((w) => (
            <WorkoutCard key={w.id} w={w} showUser={false} />
          ))}
        </div>
      )}
      {!p.isMe && <NewChallenge open={challenge} onClose={() => setChallenge(false)} preset={p.username} />}
    </div>
  );
}

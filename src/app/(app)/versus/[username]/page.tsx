"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { Swords } from "lucide-react";
import { useMe } from "@/client/me";
import { useData } from "@/client/store";
import { Avatar, Button, Card, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { RankBadge } from "@/components/rank";
import { NewChallenge } from "@/components/social";
import { GROUPS, getExercise } from "@/shared/exercises";
import { profileRanks, rankInfo, type Sex } from "@/shared/ranks";
import { fmtW } from "@/shared/units";

type Stats = {
  user: { id: string; username: string; name: string; sex: Sex; color: string };
  bests: Record<string, number>;
  records: { exercise: string; e1rmKg: number; weightKg: number; reps: number; metric: number }[];
};

export default function VersusPage() {
  const { username } = useParams<{ username: string }>();
  const { me } = useMe();
  const { data: mine } = useData<Stats>("/api/stats");
  const { data: theirs } = useData<Stats>(`/api/stats?user=${encodeURIComponent(username)}`);
  const [challenge, setChallenge] = useState(false);
  if (!mine || !theirs) return <Skeleton className="mt-20 h-96" />;
  const a = profileRanks(mine.bests, mine.user.sex);
  const b = profileRanks(theirs.bests, theirs.user.sex);
  const ra = rankInfo(a.overall);
  const rb = rankInfo(b.overall);
  const common = a.exercises.filter((e) => b.exercises.some((x) => x.id === e.id)).map((e) => ({ id: e.id, a: e.score, b: b.exercises.find((x) => x.id === e.id)!.score }));
  const winsA = common.filter((c) => c.a > c.b).length;
  const winsB = common.filter((c) => c.b > c.a).length;
  const rec = (s: Stats, id: string) => s.records.find((r) => r.exercise === id);

  return (
    <div className="rise">
      <PageHeader title="Versus" back />
      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-20" style={{ background: `linear-gradient(90deg, ${ra.tier.c2}, transparent)` }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-20" style={{ background: `linear-gradient(270deg, ${rb.tier.c2}, transparent)` }} />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {[
            { s: mine, r: ra },
            null,
            { s: theirs, r: rb },
          ].map((x, i) =>
            x ? (
              <div key={i} className="flex flex-col items-center text-center">
                <Avatar name={x.s.user.name} color={x.s.user.color} size={52} />
                <div className="mt-1.5 max-w-full truncate text-[14px] font-bold">{x.s.user.id === me.id ? "You" : x.s.user.name.split(" ")[0]}</div>
                <RankBadge score={x.r.score} size={58} className="mt-2" />
                <div className="mt-1 text-[13px] font-bold" style={{ color: x.r.tier.ink }}>
                  {x.r.name}
                </div>
                <div className="tabular text-[12px] text-muted">{x.r.sr} SR</div>
              </div>
            ) : (
              <div key={i} className="font-display text-[44px] font-black text-hot italic">VS</div>
            ),
          )}
        </div>
        <div className="relative mt-4 text-center text-[14px]">
          {common.length === 0 ? (
            <span className="text-muted">No lifts in common yet.</span>
          ) : (
            <>
              Lifts won: <span className="font-bold text-lime">{winsA}</span> – <span className="font-bold text-hot">{winsB}</span>
              <span className="text-muted"> of {common.length}</span>
            </>
          )}
        </div>
      </Card>

      <SectionTitle>Muscle groups</SectionTitle>
      <Card className="space-y-3">
        {GROUPS.map((g) => {
          const sa = a.groups[g.id].score;
          const sb = b.groups[g.id].score;
          const max = Math.max(sa, sb, 1);
          return (
            <div key={g.id}>
              <div className="mb-1 flex justify-between text-[12px]">
                <span className={clsx("font-bold", sa > sb ? "text-lime" : "text-muted")}>{a.groups[g.id].best ? rankInfo(sa).name : "—"}</span>
                <span className="font-semibold">{g.name}</span>
                <span className={clsx("font-bold", sb > sa ? "text-hot" : "text-muted")}>{b.groups[g.id].best ? rankInfo(sb).name : "—"}</span>
              </div>
              <div className="flex gap-1">
                <div className="flex flex-1 justify-end overflow-hidden rounded-l-full bg-white/[0.06]">
                  <div className="h-2.5 rounded-l-full bg-lime transition-[width] duration-700" style={{ width: `${(sa / max) * 100}%` }} />
                </div>
                <div className="flex-1 overflow-hidden rounded-r-full bg-white/[0.06]">
                  <div className="h-2.5 rounded-r-full bg-hot transition-[width] duration-700" style={{ width: `${(sb / max) * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      {common.length > 0 && (
        <>
          <SectionTitle>Head to head</SectionTitle>
          <div className="card divide-y divide-line">
            {common
              .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b))
              .map((c) => {
                const ex = getExercise(c.id)!;
                const ma = rec(mine, c.id);
                const mb = rec(theirs, c.id);
                const show = (r?: Stats["records"][number]) => (!r ? "—" : ex.kind === "bodyweight" ? `${Math.round(r.metric)} reps` : fmtW(r.e1rmKg, me.unit));
                return (
                  <div key={c.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3">
                    <div className={clsx("tabular text-[14px] font-bold", c.a >= c.b ? "text-lime" : "text-muted")}>
                      {show(ma)}
                      <div className="text-[11px] font-semibold" style={{ color: rankInfo(c.a).tier.ink }}>
                        {rankInfo(c.a).name}
                      </div>
                    </div>
                    <div className="max-w-[120px] truncate text-center text-[12px] font-semibold text-muted">{ex.name}</div>
                    <div className={clsx("tabular text-right text-[14px] font-bold", c.b >= c.a ? "text-hot" : "text-muted")}>
                      {show(mb)}
                      <div className="text-[11px] font-semibold" style={{ color: rankInfo(c.b).tier.ink }}>
                        {rankInfo(c.b).name}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="mt-2 px-1 text-[12px] text-dim">Winner per lift is decided by rank (strength relative to bodyweight), shown with each person&apos;s best estimated 1RM.</p>
        </>
      )}

      {theirs.user.id !== me.id && (
        <Button size="lg" block className="mt-6" onClick={() => setChallenge(true)}>
          <Swords className="h-5 w-5" /> Challenge {theirs.user.name.split(" ")[0]}
        </Button>
      )}
      <NewChallenge open={challenge} onClose={() => setChallenge(false)} preset={theirs.user.username} />
    </div>
  );
}

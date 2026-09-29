"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Calculator, ChevronRight, Info } from "lucide-react";
import { useMe } from "@/client/me";
import { useData } from "@/client/store";
import { Card, Field, Input, PageHeader, SectionTitle, Select, Sheet, Skeleton } from "@/components/ui";
import { RankBadge, RankProgress } from "@/components/rank";
import { LineChart } from "@/components/charts";
import { EXERCISES, GROUPS, getExercise, type Exercise } from "@/shared/exercises";
import {
  ALL_LEVELS,
  fmtMetric,
  levelName,
  profileRanks,
  rankInfo,
  requirement,
  scoreFromMetric,
  setMetric,
  standards,
  TIERS,
  weightForReps,
  type Sex,
} from "@/shared/ranks";
import { fmtW, toKg, type Unit } from "@/shared/units";

type Stats = {
  user: { id: string; username: string; name: string; sex: Sex; color: string };
  bests: Record<string, number>;
  records: { exercise: string; e1rmKg: number; weightKg: number; reps: number; metric: number; date: string }[];
};

export default function RanksPage() {
  return (
    <Suspense fallback={<Skeleton className="mt-20 h-64" />}>
      <Ranks />
    </Suspense>
  );
}

function Ranks() {
  const { me } = useMe();
  const username = useSearchParams().get("user");
  const self = !username || username === me.username;
  const { data } = useData<Stats>(self ? "/api/stats" : `/api/stats?user=${encodeURIComponent(username!)}`);
  const [detail, setDetail] = useState<string | null>(null);
  const sex = data?.user.sex ?? me.sex;
  const ranks = useMemo(() => (data ? profileRanks(data.bests, sex) : null), [data, sex]);
  const r = rankInfo(ranks?.overall ?? 0);

  return (
    <div className="rise">
      <PageHeader title={self ? "Ranks" : `${data?.user.name ?? "…"}`} subtitle={self ? "Scored against your bodyweight & sex" : `@${username}'s ranks`} back />

      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full opacity-30 blur-3xl" style={{ background: r.tier.c2 }} />
        <div className="relative flex flex-col items-center text-center">
          {ranks ? <RankBadge score={r.score} size={120} className="float" /> : <Skeleton className="h-[132px] w-[120px]" />}
          <div className="mt-3 text-[11px] font-bold tracking-widest text-muted uppercase">Overall</div>
          <div className="font-display text-[48px] leading-none font-black uppercase italic" style={{ color: r.tier.ink }}>
            {r.name}
          </div>
          <div className="mt-1 text-[14px] text-muted">
            <span className="tabular font-bold text-ink">{r.sr.toLocaleString()}</span> SR
          </div>
        </div>
        <RankProgress score={r.score} className="relative mt-5" />
      </Card>

      <SectionTitle>Muscle groups</SectionTitle>
      <div className="grid grid-cols-3 gap-2.5">
        {GROUPS.map((g) => {
          const gr = ranks?.groups[g.id];
          const info = rankInfo(gr?.score ?? 0);
          return (
            <div key={g.id} className="card flex flex-col items-center px-2 py-3.5 text-center">
              <RankBadge score={gr?.score ?? 0} size={50} dim={!gr?.best} />
              <div className="mt-1.5 text-[13px] font-bold">{g.name}</div>
              <div className="text-[11px] font-semibold" style={{ color: gr?.best ? info.tier.ink : "var(--color-dim)" }}>
                {gr?.best ? info.name : "Unranked"}
              </div>
              {gr?.best && <div className="mt-0.5 line-clamp-1 text-[10px] text-dim">{getExercise(gr.best)?.name}</div>}
            </div>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-[12px] text-dim">A group&apos;s rank is its best lift. Overall averages chest, back, shoulders, arms & legs.</p>

      <SectionTitle>Lifts</SectionTitle>
      {!data ? (
        <Skeleton className="h-48" />
      ) : ranks!.exercises.length === 0 ? (
        <Card className="text-[14px] text-muted">No ranked lifts yet. Log a workout to get ranked.</Card>
      ) : (
        <div className="space-y-2">
          {ranks!.exercises.map((e) => {
            const ex = getExercise(e.id)!;
            const rec = data.records.find((x) => x.exercise === e.id);
            const info = rankInfo(e.score);
            const nextReq = self && info.nextName && me.weightKg ? requirement(ex, sex, info.level + 1, me.weightKg) : null;
            return (
              <button key={e.id} onClick={() => setDetail(e.id)} className="card press w-full p-4 text-left">
                <div className="flex items-center gap-3">
                  <RankBadge score={e.score} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{ex.name}</div>
                    <div className="text-[12px] text-muted">
                      {rec && (ex.kind === "bodyweight" ? `${rec.weightKg ? `+${fmtW(rec.weightKg, me.unit)} × ` : ""}${rec.reps} reps` : `${fmtW(rec.weightKg, me.unit)} × ${rec.reps}`)}
                      {" · "}
                      {fmtMetric(ex, e.metric)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-bold" style={{ color: info.tier.ink }}>
                      {info.name}
                    </div>
                    <div className="tabular text-[11px] text-dim">{info.sr} SR</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-dim" />
                </div>
                <RankProgress score={e.score} label={false} className="mt-3" />
                {nextReq && (
                  <div className="mt-2 text-[12px] text-muted">
                    Next: <span style={{ color: rankInfo(info.level + 1).tier.ink }} className="font-bold">{info.nextName}</span> at{" "}
                    {ex.kind === "bodyweight" ? (
                      <span className="font-semibold text-ink">{nextReq.reps} reps</span>
                    ) : (
                      <>
                        <span className="font-semibold text-ink">{fmtW(nextReq.kg, me.unit)}</span> e1RM (≈ {fmtW(weightForReps(nextReq.kg, 5), me.unit)} × 5)
                      </>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {self && <RankCalculator unit={me.unit} sex={me.sex} bw={me.weightKg ?? 80} />}

      <SectionTitle>The ladder</SectionTitle>
      <Card className="p-0">
        {TIERS.map((t, i) => (
          <div key={t.id} className={clsx("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-line")}>
            <RankBadge score={i * 3 + 2} size={36} />
            <div className="flex-1">
              <div className="font-bold" style={{ color: t.ink }}>
                {t.name}
              </div>
              <div className="text-[12px] text-muted">{t.id === "legend" ? "World-class. The top." : `${t.name}, ${t.name} 2, ${t.name} 3`}</div>
            </div>
            <div className="tabular text-[12px] text-dim">{i * 300} SR+</div>
          </div>
        ))}
      </Card>
      <p className="mt-2 flex gap-1.5 px-1 text-[12px] text-dim">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Rookie ≈ beginner, Amateur ≈ novice, Pro ≈ intermediate, Elite ≈ advanced, Olympian ≈ elite strength standards.
      </p>

      <ExerciseDetail id={detail} onClose={() => setDetail(null)} username={self ? null : username} sex={sex} canPlan={self} />
    </div>
  );
}

function RankCalculator({ unit, sex, bw }: { unit: Unit; sex: Sex; bw: number }) {
  const [id, setId] = useState("bench");
  const [w, setW] = useState("");
  const [reps, setReps] = useState("5");
  const ex = getExercise(id)!;
  const kg = toKg(Number(w) || 0, unit);
  const score = scoreFromMetric(setMetric(ex, kg, Number(reps) || 0, bw), standards(ex, sex));
  const info = rankInfo(score);
  return (
    <>
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <Calculator className="h-5 w-5" /> Rank calculator
        </span>
      </SectionTitle>
      <Card>
        <div className="grid grid-cols-[1fr_88px_72px] gap-2">
          <Field label="Exercise">
            <Select value={id} onChange={(e) => setId(e.target.value)}>
              {EXERCISES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={ex.kind === "bodyweight" ? `+${unit}` : unit}>
            <Input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder={ex.kind === "bodyweight" ? "0" : "225"} />
          </Field>
          <Field label="Reps">
            <Input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <RankBadge score={score} size={56} dim={score === 0} />
          <div>
            <div className="font-display text-[28px] leading-none font-black uppercase italic" style={{ color: score ? info.tier.ink : undefined }}>
              {score ? info.name : "—"}
            </div>
            <div className="text-[12px] text-muted">{score ? `${info.sr} SR at your bodyweight` : "Enter a set to see its rank"}</div>
          </div>
        </div>
      </Card>
    </>
  );
}

function ExerciseDetail({ id, onClose, username, sex, canPlan }: { id: string | null; onClose: () => void; username: string | null; sex: Sex; canPlan: boolean }) {
  const { me } = useMe();
  const ex = id ? getExercise(id) : undefined;
  const { data } = useData<{ points: { t: string; e1rmKg: number; metric: number }[] }>(
    id ? `/api/lifts?exercise=${id}&mode=history${username ? `&user=${encodeURIComponent(username)}` : ""}` : null,
  );
  return (
    <Sheet open={!!id} onClose={onClose} title={ex?.name ?? ""} tall>
      {ex && (
        <div className="space-y-4 pt-1">
          <Card>
            <div className="mb-2 text-[12px] font-bold tracking-wider text-muted uppercase">{ex.kind === "bodyweight" ? "Reps (equivalent)" : "Estimated 1RM"}</div>
            {!data ? (
              <Skeleton className="h-40" />
            ) : (
              <LineChart
                points={data.points.map((p) => ({ x: new Date(p.t).getTime(), y: ex.kind === "bodyweight" ? p.metric : p.e1rmKg }))}
                format={(v) => (ex.kind === "bodyweight" ? `${Math.round(v)} reps` : fmtW(v, me.unit))}
                xLabel={(x) => new Date(x).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
            )}
          </Card>
          {canPlan && me.weightKg && <Ladder ex={ex} sex={sex} bw={me.weightKg} unit={me.unit} current={data?.points.length ? Math.max(...data.points.map((p) => p.metric)) : 0} />}
        </div>
      )}
    </Sheet>
  );
}

function Ladder({ ex, sex, bw, unit, current }: { ex: Exercise; sex: Sex; bw: number; unit: Unit; current: number }) {
  const cur = scoreFromMetric(current, standards(ex, sex));
  return (
    <Card className="p-0">
      <div className="px-4 pt-4 pb-2 text-[12px] font-bold tracking-wider text-muted uppercase">What it takes at {fmtW(bw, unit)}</div>
      {ALL_LEVELS.map((lvl) => {
        const req = requirement(ex, sex, lvl, bw);
        const info = rankInfo(lvl);
        const reached = cur >= lvl && current > 0;
        return (
          <div key={lvl} className={clsx("flex items-center gap-3 border-t border-line px-4 py-2", Math.floor(cur) === lvl && current > 0 && "bg-white/[0.04]")}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: reached ? info.tier.c1 : "rgba(255,255,255,0.12)" }} />
            <span className="flex-1 text-[14px] font-semibold" style={{ color: reached ? info.tier.ink : undefined }}>
              {levelName(lvl)}
            </span>
            <span className="tabular text-[13px] text-muted">
              {lvl === 0 ? "—" : ex.kind === "bodyweight" ? `${req.reps} reps` : `${fmtW(req.kg, unit)}${ex.perHand ? " / hand" : ""}`}
            </span>
          </div>
        );
      })}
    </Card>
  );
}


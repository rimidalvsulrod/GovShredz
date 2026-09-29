"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Dumbbell, History, MoreHorizontal, Plus, Repeat, Timer, Trash2, Trophy, X, Zap } from "lucide-react";
import { api } from "@/client/api";
import { useMe } from "@/client/me";
import { fail, haptic, invalidate, toast, useData, useLocal } from "@/client/store";
import type { Workout, WorkoutDetail } from "@/client/types";
import { Button, Card, Empty, PageHeader, SectionTitle, Sheet, Skeleton, Textarea } from "@/components/ui";
import { RankBadge, RankChip } from "@/components/rank";
import { ExercisePicker } from "@/components/exercise-picker";
import { WorkoutCard } from "@/components/workout";
import { Confetti } from "@/components/confetti";
import { exerciseName, getExercise, GROUPS } from "@/shared/exercises";
import { rankInfo, scoreFromMetric, setMetric, standards } from "@/shared/ranks";
import { dayKey, fmtDuration, fmtW, fromKg, roundW, toKg } from "@/shared/units";

type DraftSet = { w: string; r: string; done: boolean };
type DraftEx = { id: string; sets: DraftSet[]; prev: { weightKg: number; reps: number }[] };
type Draft = { title: string; startedAt: number; notes: string; exercises: DraftEx[] };
type Result = {
  id: string;
  volumeKg: number;
  sets: number;
  prs: { exercise: string; e1rmKg: number; weightKg: number; reps: number; metric: number; first: boolean }[];
  rankUps: { kind: "exercise" | "group" | "overall"; id: string; from: number; to: number }[];
  overall: { before: number; after: number };
};

const TEMPLATES: { name: string; ids: string[] }[] = [
  { name: "Push", ids: ["bench", "incline_db", "ohp", "lateral_raise", "pushdown"] },
  { name: "Pull", ids: ["deadlift", "pullups", "row", "face_pull", "curl"] },
  { name: "Legs", ids: ["squat", "rdl", "leg_press", "leg_curl", "calf_raise"] },
  { name: "Upper", ids: ["bench", "row", "ohp", "lat_pulldown", "db_curl", "pushdown"] },
  { name: "Full body", ids: ["squat", "bench", "row", "ohp", "rdl"] },
];

function defaultTitle() {
  const h = new Date().getHours();
  return h < 11 ? "Morning session" : h < 17 ? "Afternoon session" : "Evening session";
}

async function withPrev(ids: string[]): Promise<DraftEx[]> {
  return Promise.all(
    ids.map(async (id) => {
      const r = await api<{ sets: { weightKg: number; reps: number }[] }>(`/api/lifts?exercise=${encodeURIComponent(id)}&mode=last`).catch(() => ({ sets: [] }));
      const n = Math.max(3, Math.min(r.sets.length, 6));
      return { id, prev: r.sets, sets: Array.from({ length: n }, () => ({ w: "", r: "", done: false })) };
    }),
  );
}

export default function TrainPage() {
  const [draft, setDraft, ready] = useLocal<Draft | null>("gs:draft", null);
  const [result, setResult] = useState<Result | null>(null);
  if (!ready) return <Skeleton className="mt-20 h-40" />;
  return (
    <>
      {draft ? <Logger draft={draft} setDraft={setDraft} onDone={setResult} /> : <Start onStart={setDraft} />}
      <ResultSheet result={result} onClose={() => setResult(null)} />
    </>
  );
}

/* --------------------------------- start ---------------------------------- */

function Start({ onStart }: { onStart: (d: Draft) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);
  const { data } = useData<{ workouts: Workout[] }>(`/api/workouts?limit=${limit}`);
  const start = async (key: string, ids: string[], title = defaultTitle()) => {
    setBusy(key);
    try {
      onStart({ title, startedAt: Date.now(), notes: "", exercises: await withPrev(ids) });
      haptic(20);
    } finally {
      setBusy(null);
    }
  };
  const last = data?.workouts[0];
  return (
    <div className="rise">
      <PageHeader title="Train" subtitle="Every set counts toward your rank." />
      <button
        onClick={() => start("empty", [])}
        className="press lime-glow relative flex h-32 w-full flex-col justify-between overflow-hidden rounded-[26px] bg-lime p-5 text-left text-black"
      >
        <Dumbbell className="absolute -right-4 -bottom-6 h-36 w-36 rotate-[-20deg] opacity-15" />
        <Zap className="h-7 w-7" strokeWidth={2.5} />
        <div>
          <div className="font-display text-[34px] leading-none font-black uppercase italic">Start workout</div>
          <div className="text-[13px] font-semibold opacity-70">Empty session · add exercises as you go</div>
        </div>
      </button>
      {last && (
        <button
          onClick={async () => {
            setBusy("repeat");
            try {
              const d = await api<WorkoutDetail>(`/api/workouts/${last.id}`);
              await start("repeat", d.exercises.map((e) => e.exercise), last.title);
            } catch (e) {
              fail(e);
              setBusy(null);
            }
          }}
          className="card press mt-3 flex w-full items-center gap-3 p-4 text-left"
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan/15 text-cyan">
            <Repeat className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold">Repeat last workout</div>
            <div className="truncate text-[12px] text-muted">
              {last.title} · {last.exercises.map((e) => exerciseName(e.id)).join(", ")}
            </div>
          </div>
          {busy === "repeat" && <span className="text-[12px] text-muted">Loading…</span>}
        </button>
      )}

      <SectionTitle>Quick start</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {TEMPLATES.map((t) => (
          <button key={t.name} onClick={() => start(t.name, t.ids, t.name)} className="card press p-4 text-left" disabled={!!busy}>
            <div className="font-display text-[22px] font-extrabold uppercase italic">{t.name}</div>
            <div className="mt-1 line-clamp-2 text-[12px] text-muted">{t.ids.map(exerciseName).join(" · ")}</div>
            {busy === t.name && <div className="mt-1 text-[12px] text-lime">Loading…</div>}
          </button>
        ))}
      </div>

      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <History className="h-5 w-5" /> History
        </span>
      </SectionTitle>
      {!data ? (
        <Skeleton className="h-40" />
      ) : data.workouts.length === 0 ? (
        <Empty icon={<Dumbbell />} title="No workouts yet">
          Start one above. Your first sets set your first ranks.
        </Empty>
      ) : (
        <div className="space-y-2.5">
          {data.workouts.map((w) => (
            <WorkoutCard key={w.id} w={w} showUser={false} />
          ))}
          {data.workouts.length >= limit && (
            <Button variant="secondary" block onClick={() => setLimit(limit + 20)}>
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- logger --------------------------------- */

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function Logger({ draft, setDraft, onDone }: { draft: Draft; setDraft: (d: Draft | null) => void; onDone: (r: Result) => void }) {
  const { me } = useMe();
  const now = useNow(500);
  const [picker, setPicker] = useState(false);
  const [restEnd, setRestEnd] = useLocal<number | null>("gs:rest", null);
  const [restLen, setRestLen] = useLocal<number>("gs:restLen", 90);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const { data: stats } = useData<{ bests: Record<string, number> }>("/api/stats");
  const bw = me.weightKg ?? 80;
  const unit = me.unit;

  const update = (fn: (d: Draft) => void) => {
    const d = structuredClone(draft);
    fn(d);
    setDraft(d);
  };

  const restLeft = restEnd ? Math.max(0, Math.round((restEnd - now) / 1000)) : 0;
  useEffect(() => {
    if (restEnd && restLeft === 0) {
      haptic(400);
      setRestEnd(null);
    }
  }, [restEnd, restLeft, setRestEnd]);

  const parse = (s: DraftSet, ex: DraftEx, i: number) => {
    const def = getExercise(ex.id);
    const prev = ex.prev[i] ?? ex.prev[ex.prev.length - 1];
    const w = s.w === "" ? (prev ? roundW(fromKg(prev.weightKg, unit)) : def?.kind === "bodyweight" ? 0 : NaN) : Number(s.w);
    const r = s.r === "" ? (prev ? prev.reps : NaN) : Number(s.r);
    return { weightKg: toKg(w, unit), reps: Math.round(r), valid: isFinite(w) && isFinite(r) && r > 0 && (def?.kind === "bodyweight" || w > 0) };
  };

  const setScore = (ex: DraftEx, weightKg: number, reps: number) => {
    const def = getExercise(ex.id);
    if (!def) return null;
    return scoreFromMetric(setMetric(def, weightKg, reps, bw), standards(def, me.sex));
  };

  const finish = async () => {
    const exercises = draft.exercises
      .map((ex) => {
        const done = ex.sets.map((s, i) => ({ s, p: parse(s, ex, i) })).filter((x) => x.s.done && x.p.valid);
        return { exercise: ex.id, sets: done.map((x) => ({ weightKg: x.p.weightKg, reps: x.p.reps })) };
      })
      .filter((e) => e.sets.length);
    if (!exercises.length) return toast("Tick ✓ on the sets you finished first.", "error");
    setSaving(true);
    try {
      const r = await api<Result>("/api/workouts", {
        body: {
          title: draft.title.trim() || defaultTitle(),
          notes: draft.notes,
          startedAt: new Date(draft.startedAt).toISOString(),
          durationSec: Math.round((Date.now() - draft.startedAt) / 1000),
          day: dayKey(new Date(draft.startedAt)),
          exercises,
        },
      });
      setDraft(null);
      setRestEnd(null);
      invalidate("/api/");
      onDone(r);
      haptic(60);
    } catch (e) {
      fail(e);
    }
    setSaving(false);
  };

  const doneCount = draft.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  return (
    <div>
      <div className="pt-safe glass sticky top-0 z-30 -mx-4 mb-3 border-b border-line px-4 pb-3">
        <div className="flex items-center gap-3 pt-2">
          <div className="min-w-0 flex-1">
            <input
              value={draft.title}
              onChange={(e) => update((d) => void (d.title = e.target.value))}
              className="font-display w-full bg-transparent text-[26px] leading-tight font-black uppercase italic outline-none"
              maxLength={60}
            />
            <div className="tabular flex items-center gap-3 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1 text-lime">
                <span className="h-2 w-2 animate-pulse rounded-full bg-lime" /> {fmtDuration((now - draft.startedAt) / 1000)}
              </span>
              <span>{doneCount} sets done</span>
            </div>
          </div>
          <Button onClick={finish} loading={saving} className="px-5">
            Finish
          </Button>
        </div>
      </div>

      {draft.exercises.length === 0 && (
        <Empty icon={<Dumbbell />} title="Empty workout">
          Add your first exercise to start logging.
        </Empty>
      )}

      <div className="space-y-3">
        {draft.exercises.map((ex, ei) => {
          const def = getExercise(ex.id);
          const parsed = ex.sets.map((s, i) => parse(s, ex, i));
          const bestLive = parsed.reduce<number | null>((best, p, i) => {
            if (!p.valid || !ex.sets[i].done) return best;
            const sc = setScore(ex, p.weightKg, p.reps);
            return sc != null && (best == null || sc > best) ? sc : best;
          }, null);
          const current = stats?.bests[ex.id];
          const currentScore = def && current ? scoreFromMetric(current, standards(def, me.sex)) : null;
          return (
            <div key={`${ex.id}-${ei}`} className="card p-4">
              <div className="mb-3 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[17px] font-bold">{exerciseName(ex.id)}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                    {def ? GROUPS.find((g) => g.id === def.group)!.name : "Custom"}
                    {def?.perHand && " · per dumbbell"}
                    {def?.kind === "bodyweight" && " · + added weight"}
                    {currentScore != null && (
                      <>
                        <span>· best</span> <RankChip score={currentScore} />
                      </>
                    )}
                  </div>
                </div>
                {bestLive != null && (currentScore == null || bestLive > currentScore) && (
                  <span className="pop inline-flex items-center gap-1 rounded-full bg-warn/20 px-2 py-1 text-[11px] font-black text-warn">
                    <Trophy className="h-3 w-3" /> PR
                  </span>
                )}
                <button onClick={() => setMenu(menu === ei ? null : ei)} className="press grid h-8 w-8 place-items-center rounded-full bg-white/[0.06]" aria-label="Exercise options">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
              {menu === ei && (
                <div className="mb-3 flex gap-2">
                  <Button size="sm" variant="secondary" disabled={ei === 0} onClick={() => { update((d) => { const [x] = d.exercises.splice(ei, 1); d.exercises.splice(ei - 1, 0, x); }); setMenu(null); }}>
                    Move up
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => { update((d) => void d.exercises.splice(ei, 1)); setMenu(null); }}>
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              )}
              <div className="mb-1 grid grid-cols-[28px_1fr_1fr_88px_44px] items-center gap-2 px-1 text-[11px] font-bold tracking-wider text-dim uppercase">
                <span>Set</span>
                <span className="text-center">{def?.kind === "bodyweight" ? `+${unit}` : unit}</span>
                <span className="text-center">Reps</span>
                <span className="text-center">Rank</span>
                <span />
              </div>
              <div className="space-y-1.5">
                {ex.sets.map((s, si) => {
                  const p = parsed[si];
                  const prev = ex.prev[si];
                  const sc = p.valid ? setScore(ex, p.weightKg, p.reps) : null;
                  const tier = sc != null ? rankInfo(sc).tier : null;
                  return (
                    <div
                      key={si}
                      className={clsx("grid grid-cols-[28px_1fr_1fr_88px_44px] items-center gap-2 rounded-xl px-1 py-1 transition-colors", s.done && "bg-lime/[0.07]")}
                    >
                      <span className={clsx("font-display text-center text-[17px] font-extrabold", s.done ? "text-lime" : "text-muted")}>{si + 1}</span>
                      <input
                        inputMode="decimal"
                        value={s.w}
                        placeholder={prev ? String(roundW(fromKg(prev.weightKg, unit))) : def?.kind === "bodyweight" ? "0" : "—"}
                        onChange={(e) => update((d) => void (d.exercises[ei].sets[si].w = e.target.value.replace(/[^\d.-]/g, "")))}
                        className="tabular h-11 w-full min-w-0 rounded-xl bg-surface-3 text-center text-[17px] font-bold outline-none placeholder:font-medium placeholder:text-dim focus:ring-2 focus:ring-lime/60"
                      />
                      <input
                        inputMode="numeric"
                        value={s.r}
                        placeholder={prev ? String(prev.reps) : "—"}
                        onChange={(e) => update((d) => void (d.exercises[ei].sets[si].r = e.target.value.replace(/\D/g, "")))}
                        className="tabular h-11 w-full min-w-0 rounded-xl bg-surface-3 text-center text-[17px] font-bold outline-none placeholder:font-medium placeholder:text-dim focus:ring-2 focus:ring-lime/60"
                      />
                      <span className="truncate text-center text-[11px] font-bold" style={{ color: tier?.ink ?? "var(--color-dim)" }}>
                        {sc != null ? rankInfo(sc).name : def ? "—" : "Custom"}
                      </span>
                      <button
                        onClick={() => {
                          if (!s.done && !p.valid) return toast("Enter weight and reps", "error");
                          update((d) => {
                            const set = d.exercises[ei].sets[si];
                            set.done = !set.done;
                            // Lock in the placeholder values so what you saw is what gets saved.
                            if (set.done) {
                              if (set.w === "") set.w = String(roundW(fromKg(p.weightKg, unit)));
                              if (set.r === "") set.r = String(p.reps);
                            }
                          });
                          if (!s.done) {
                            haptic(15);
                            setRestEnd(Date.now() + restLen * 1000);
                          }
                        }}
                        className={clsx("press grid h-11 w-11 place-items-center rounded-xl", s.done ? "bg-lime text-black" : "bg-surface-3 text-muted")}
                        aria-label="Complete set"
                      >
                        <Check className="h-5 w-5" strokeWidth={3} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2.5 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => update((d) => {
                    const sets = d.exercises[ei].sets;
                    const last = sets[sets.length - 1];
                    sets.push({ w: last?.w ?? "", r: last?.r ?? "", done: false });
                  })}
                >
                  <Plus className="h-4 w-4" /> Add set
                </Button>
                {ex.sets.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => update((d) => void d.exercises[ei].sets.pop())}>
                    <X className="h-4 w-4" /> Last
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button variant="outline" size="lg" block className="mt-3" onClick={() => setPicker(true)}>
        <Plus className="h-5 w-5" /> Add exercise
      </Button>

      <Textarea
        className="mt-3"
        placeholder="Notes (optional)"
        value={draft.notes}
        onChange={(e) => update((d) => void (d.notes = e.target.value.slice(0, 500)))}
      />

      <Button
        variant="danger"
        block
        className="mt-6"
        onClick={() => {
          if (confirm("Discard this workout? Nothing will be saved.")) {
            setDraft(null);
            setRestEnd(null);
          }
        }}
      >
        Discard workout
      </Button>

      {restEnd && restLeft > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(max(var(--sab),10px)+86px)] z-40 flex justify-center px-4">
          <div className="glass rise flex w-full max-w-[488px] items-center gap-3 rounded-2xl border border-lime/30 p-2.5 pl-4 shadow-2xl">
            <Timer className="h-5 w-5 text-lime" />
            <div className="flex-1">
              <div className="text-[11px] font-bold tracking-wider text-muted uppercase">Rest</div>
              <div className="font-display tabular text-[26px] leading-none font-black text-lime">{fmtDuration(restLeft)}</div>
            </div>
            <button className="press rounded-xl bg-white/[0.08] px-3 py-2 text-[13px] font-bold" onClick={() => setRestEnd(restEnd + 15000)}>
              +15s
            </button>
            <button
              className="press rounded-xl bg-white/[0.08] px-3 py-2 text-[13px] font-bold"
              onClick={() => {
                const opts = [60, 90, 120, 180, 240];
                const next = opts[(opts.indexOf(restLen) + 1) % opts.length];
                setRestLen(next);
                setRestEnd(Date.now() + next * 1000);
              }}
            >
              {restLen}s <ChevronDown className="inline h-3 w-3" />
            </button>
            <button className="press rounded-xl bg-lime px-3 py-2 text-[13px] font-bold text-black" onClick={() => setRestEnd(null)}>
              Skip
            </button>
          </div>
        </div>
      )}

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        exclude={draft.exercises.map((e) => e.id)}
        onPick={async (id) => {
          const [ex] = await withPrev([id]);
          setDraft({ ...draft, exercises: [...draft.exercises, ex] });
        }}
      />
    </div>
  );
}

/* --------------------------------- results -------------------------------- */

function ResultSheet({ result, onClose }: { result: Result | null; onClose: () => void }) {
  const { me } = useMe();
  if (!result) return null;
  const before = rankInfo(result.overall.before);
  const after = rankInfo(result.overall.after);
  const gain = after.sr - before.sr;
  return (
    <Sheet open onClose={onClose} title="Workout complete">
      <Confetti />
      <div className="flex flex-col items-center pt-2 text-center">
        <RankBadge score={after.score} size={104} className="pop" />
        <div className="font-display mt-3 text-[34px] leading-none font-black uppercase italic" style={{ color: after.tier.ink }}>
          {after.name}
        </div>
        <div className="mt-1 text-[14px] text-muted">
          <span className="tabular font-bold text-ink">{after.sr.toLocaleString()} SR</span>
          {gain > 0 && <span className="ml-2 font-bold text-lime">+{gain}</span>}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Card className="p-3">
          <div className="font-display text-[24px] font-extrabold">{result.sets}</div>
          <div className="text-[11px] text-muted">Sets</div>
        </Card>
        <Card className="p-3">
          <div className="font-display text-[24px] font-extrabold">{fmtW(result.volumeKg, me.unit).replace(/ .*/, "")}</div>
          <div className="text-[11px] text-muted">{me.unit} moved</div>
        </Card>
        <Card className="p-3">
          <div className="font-display text-[24px] font-extrabold text-warn">{result.prs.length}</div>
          <div className="text-[11px] text-muted">PRs</div>
        </Card>
      </div>
      {result.rankUps.length > 0 && (
        <>
          <div className="mt-5 mb-2 text-[12px] font-bold tracking-widest text-lime uppercase">Rank ups</div>
          <div className="space-y-2">
            {result.rankUps.map((u, i) => (
              <div key={i} className="card rise flex items-center gap-3 p-3" style={{ animationDelay: `${i * 80}ms` }}>
                <RankBadge score={u.to} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">
                    {u.kind === "overall" ? "Overall" : u.kind === "group" ? GROUPS.find((g) => g.id === u.id)?.name : exerciseName(u.id)}
                  </div>
                  <div className="text-[12px] text-muted">
                    {u.from > 0 ? `${rankInfo(u.from).name} → ` : "Unlocked · "}
                    <span style={{ color: rankInfo(u.to).tier.ink }} className="font-bold">
                      {rankInfo(u.to).name}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {result.prs.length > 0 && (
        <>
          <div className="mt-5 mb-2 text-[12px] font-bold tracking-widest text-warn uppercase">Personal records</div>
          <div className="card divide-y divide-line">
            {result.prs.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Trophy className="h-5 w-5 text-warn" />
                <div className="flex-1 truncate font-semibold">{exerciseName(p.exercise)}</div>
                <div className="tabular text-[13px] text-muted">
                  {getExercise(p.exercise)?.kind === "bodyweight" ? `${p.reps} reps` : `${fmtW(p.weightKg, me.unit)} × ${p.reps}`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <Button size="lg" block className="mt-6" onClick={onClose}>
        Let&apos;s go
      </Button>
    </Sheet>
  );
}

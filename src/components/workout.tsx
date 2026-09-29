"use client";
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Clock, Flame, Trash2, Trophy } from "lucide-react";
import { api } from "@/client/api";
import { fail, invalidate, toast, useData } from "@/client/store";
import { useMe } from "@/client/me";
import type { Workout, WorkoutDetail } from "@/client/types";
import { exerciseName, getExercise } from "@/shared/exercises";
import { scoreFromMetric, standards } from "@/shared/ranks";
import { ago, fmtBig, fmtDuration, fmtW } from "@/shared/units";
import { Avatar, Button, Sheet, Skeleton } from "./ui";
import { RankChip } from "./rank";

export function WorkoutCard({ w, showUser = true }: { w: Workout; showUser?: boolean }) {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const [props, setProps] = useState({ n: w.props, on: w.propped });
  return (
    <>
      <div className="card press cursor-pointer p-4" onClick={() => setOpen(true)}>
        <div className="flex items-center gap-3">
          {showUser && (
            <Link href={`/u/${w.user.username}`} onClick={(e) => e.stopPropagation()}>
              <Avatar name={w.user.name} color={w.user.color} size={38} />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold">{showUser ? w.user.name : w.title}</div>
            <div className="truncate text-[12px] text-muted">
              {showUser ? `${w.title} · ` : ""}
              {ago(w.startedAt)}
            </div>
          </div>
          {w.prCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-bold text-warn">
              <Trophy className="h-3 w-3" /> {w.prCount} PR{w.prCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="mt-3 space-y-1">
          {w.exercises.slice(0, 4).map((e) => (
            <div key={e.id} className="flex items-center justify-between text-[13px]">
              <span className="truncate text-ink/90">
                {e.sets}× {exerciseName(e.id)}
                {e.pr && <Trophy className="ml-1 inline h-3 w-3 text-warn" />}
              </span>
              {e.bestE1rmKg > 0 && <span className="tabular shrink-0 text-muted">{fmtW(e.bestE1rmKg, me.unit)} e1RM</span>}
            </div>
          ))}
          {w.exercises.length > 4 && <div className="text-[12px] text-dim">+{w.exercises.length - 4} more</div>}
        </div>
        <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {fmtDuration(w.durationSec)}
          </span>
          <span className="tabular">{fmtBig(w.volumeKg, me.unit)}</span>
          <span>{w.setCount} sets</span>
          <button
            className={clsx("press ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold", props.on ? "bg-hot/20 text-hot" : "bg-white/[0.06] text-muted")}
            onClick={async (e) => {
              e.stopPropagation();
              const on = !props.on;
              setProps({ n: props.n + (on ? 1 : -1), on });
              try {
                await api("/api/feed", { body: { workoutId: w.id, on } });
              } catch (err) {
                fail(err);
              }
            }}
          >
            <Flame className="h-3.5 w-3.5" /> {props.n}
          </button>
        </div>
      </div>
      <WorkoutSheet id={open ? w.id : null} onClose={() => setOpen(false)} />
    </>
  );
}

export function WorkoutSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { me } = useMe();
  const { data } = useData<WorkoutDetail>(id ? `/api/workouts/${id}` : null);
  const [busy, setBusy] = useState(false);
  const w = data?.workout;
  return (
    <Sheet open={!!id} onClose={onClose} title={w?.title ?? "Workout"} tall>
      {!data || !w ? (
        <div className="space-y-3 pt-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-3">
            <Avatar name={w.user.name} color={w.user.color} size={36} />
            <div className="text-[13px] text-muted">
              <div className="font-semibold text-ink">{w.user.name}</div>
              {new Date(w.startedAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="card p-2.5">
              <div className="font-display text-[20px] font-extrabold">{fmtDuration(w.durationSec)}</div>
              <div className="text-[11px] text-muted">Time</div>
            </div>
            <div className="card p-2.5">
              <div className="font-display text-[20px] font-extrabold">{fmtBig(w.volumeKg, me.unit)}</div>
              <div className="text-[11px] text-muted">Volume</div>
            </div>
            <div className="card p-2.5">
              <div className="font-display text-[20px] font-extrabold">{w.prCount}</div>
              <div className="text-[11px] text-muted">PRs</div>
            </div>
          </div>
          {w.notes && <p className="rounded-2xl bg-surface-2 p-3 text-[14px] text-muted">{w.notes}</p>}
          {data.exercises.map((ex, i) => {
            const def = getExercise(ex.exercise);
            const best = Math.max(...ex.sets.map((s) => s.metric));
            return (
              <div key={i} className="card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-bold">{exerciseName(ex.exercise)}</div>
                  {def && best > 0 && <RankChip score={scoreFromMetric(best, standards(def, w.user.sex))} />}
                </div>
                <div className="space-y-1">
                  {ex.sets.map((s, j) => (
                    <div key={j} className="tabular flex items-center justify-between text-[14px]">
                      <span className="text-muted">Set {j + 1}</span>
                      <span className="font-semibold">
                        {def?.kind === "bodyweight"
                          ? `${s.weightKg ? `BW ${s.weightKg > 0 ? "+" : ""}${fmtW(s.weightKg, me.unit)}` : "BW"} × ${s.reps}`
                          : `${fmtW(s.weightKg, me.unit)} × ${s.reps}`}
                        {s.pr && <Trophy className="ml-1.5 inline h-3.5 w-3.5 text-warn" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {w.user.id === me.id && (
            <Button
              variant="danger"
              block
              loading={busy}
              onClick={async () => {
                if (!confirm("Delete this workout? Its sets and PRs will be removed.")) return;
                setBusy(true);
                try {
                  await api(`/api/workouts/${w.id}`, { method: "DELETE" });
                  toast("Workout deleted");
                  invalidate("/api/workouts", "/api/home", "/api/feed", "/api/stats", "/api/players");
                  onClose();
                } catch (e) {
                  fail(e);
                }
                setBusy(false);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete workout
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

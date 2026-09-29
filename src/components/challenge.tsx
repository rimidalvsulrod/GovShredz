"use client";
import Link from "next/link";
import clsx from "clsx";
import { Crown, Swords } from "lucide-react";
import type { Challenge } from "@/client/types";
import { useMe } from "@/client/me";
import { exerciseName } from "@/shared/exercises";
import { fmtBig, fmtW, type Unit } from "@/shared/units";
import { Avatar } from "./ui";

export const KIND_LABEL: Record<string, string> = {
  volume: "Most volume",
  workouts: "Most workouts",
  e1rm: "Heaviest lift",
  relative: "Pound-for-pound",
};

export function fmtChallengeValue(c: Pick<Challenge, "kind">, v: number, unit: Unit) {
  if (c.kind === "volume") return fmtBig(v, unit);
  if (c.kind === "workouts") return `${Math.round(v)} workout${Math.round(v) === 1 ? "" : "s"}`;
  if (c.kind === "e1rm") return v ? fmtW(v, unit) : "—";
  return v ? `${v.toFixed(2)}×` : "—";
}

export function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

export function ChallengeCard({ c }: { c: Challenge }) {
  const { me } = useMe();
  const accepted = c.players.filter((p) => p.status === "accepted");
  const max = Math.max(1e-9, ...accepted.map((p) => p.value));
  const mine = c.players.find((p) => p.id === me.id);
  return (
    <Link href={`/challenge/${c.id}`} className="card press block p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-hot/15 text-hot">
          <Swords className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{c.title}</div>
          <div className="truncate text-[12px] text-muted">
            {KIND_LABEL[c.kind]}
            {c.exercise ? ` · ${exerciseName(c.exercise)}` : ""} · {c.status === "active" ? timeLeft(c.endsAt) : c.status === "done" ? "Final" : "Cancelled"}
          </div>
        </div>
        {mine?.status === "invited" && <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-bold text-black">Invite</span>}
      </div>
      <div className="mt-3 space-y-2">
        {accepted.slice(0, 4).map((p, i) => (
          <div key={p.id} className="flex items-center gap-2.5">
            <Avatar name={p.name} color={p.color} size={24} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-[12px]">
                <span className={clsx("truncate font-semibold", p.id === me.id && "text-lime")}>
                  {p.name}
                  {c.winner === p.id && <Crown className="ml-1 inline h-3.5 w-3.5 text-warn" />}
                </span>
                <span className="tabular text-muted">{fmtChallengeValue(c, p.value, me.unit)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(p.value / max) * 100}%`, background: i === 0 ? "var(--color-lime)" : "rgba(255,255,255,0.35)" }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      {c.stakes && <div className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-[12px] text-muted">🎲 {c.stakes}</div>}
    </Link>
  );
}

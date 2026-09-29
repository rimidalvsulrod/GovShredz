"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { Crown, Swords } from "lucide-react";
import { api } from "@/client/api";
import { useMe } from "@/client/me";
import { fail, invalidate, toast, useData } from "@/client/store";
import type { Challenge } from "@/client/types";
import { Avatar, Button, Card, Empty, PageHeader, Skeleton } from "@/components/ui";
import { fmtChallengeValue, KIND_LABEL, timeLeft } from "@/components/challenge";
import { exerciseName } from "@/shared/exercises";

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useMe();
  const { data, error, reload } = useData<{ challenge: Challenge }>(`/api/challenges/${id}`);
  const [busy, setBusy] = useState(false);
  if (error) return <Empty title="Challenge not found">{error.message}</Empty>;
  if (!data) return <Skeleton className="mt-20 h-80" />;
  const c = data.challenge;
  const mine = c.players.find((p) => p.id === me.id);
  const accepted = c.players.filter((p) => p.status === "accepted");
  const max = Math.max(1e-9, ...accepted.map((p) => p.value));
  const act = async (action: "accept" | "decline" | "cancel") => {
    setBusy(true);
    try {
      await api(`/api/challenges/${c.id}`, { body: { action } });
      toast(action === "accept" ? "Challenge accepted. Let's work 💪" : action === "decline" ? "Declined" : "Challenge cancelled");
      invalidate("/api/challenges", "/api/home");
      await reload();
    } catch (e) {
      fail(e);
    }
    setBusy(false);
  };
  return (
    <div className="rise">
      <PageHeader title="Challenge" back="/squad?tab=challenges" />
      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-hot opacity-20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-hot/15 text-hot">
            <Swords className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display truncate text-[28px] leading-none font-black uppercase italic">{c.title}</div>
            <div className="mt-1 text-[13px] text-muted">
              {KIND_LABEL[c.kind]}
              {c.exercise ? ` · ${exerciseName(c.exercise)}` : ""}
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex items-center justify-between text-[13px]">
          <span className={clsx("rounded-full px-3 py-1 font-bold", c.status === "active" ? "bg-lime/15 text-lime" : c.status === "done" ? "bg-warn/15 text-warn" : "bg-white/10 text-muted")}>
            {c.status === "active" ? timeLeft(c.endsAt) : c.status === "done" ? "Final results" : "Cancelled"}
          </span>
          <span className="text-muted">Ends {new Date(c.endsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
        </div>
        {c.stakes && <div className="relative mt-3 rounded-xl bg-white/[0.05] px-3 py-2 text-[13px]">🎲 Stakes: {c.stakes}</div>}
      </Card>

      {mine?.status === "invited" && c.status === "active" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="lg" loading={busy} onClick={() => act("accept")}>
            Accept
          </Button>
          <Button size="lg" variant="secondary" loading={busy} onClick={() => act("decline")}>
            Decline
          </Button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {c.players.map((p, i) => (
          <Link key={p.id} href={`/u/${p.username}`} className={clsx("card flex items-center gap-3 p-4", p.id === me.id && "border-lime/30")}>
            <span className={clsx("font-display w-6 text-center text-[22px] font-black italic", i === 0 && p.status === "accepted" ? "text-warn" : "text-dim")}>
              {p.status === "accepted" ? i + 1 : "–"}
            </span>
            <Avatar name={p.name} color={p.color} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="truncate">{p.name}</span>
                {c.winner === p.id && <Crown className="h-4 w-4 text-warn" />}
              </div>
              {p.status === "accepted" ? (
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(p.value / max) * 100}%`, background: i === 0 ? "var(--color-lime)" : "rgba(255,255,255,0.4)" }} />
                </div>
              ) : (
                <div className="text-[12px] text-muted capitalize">{p.status}</div>
              )}
            </div>
            <div className="tabular text-right text-[14px] font-bold">{p.status === "accepted" ? fmtChallengeValue(c, p.value, me.unit) : ""}</div>
          </Link>
        ))}
      </div>

      {c.creator === me.id && c.status === "active" && (
        <Button variant="danger" block className="mt-6" loading={busy} onClick={() => confirm("Cancel this challenge for everyone?") && act("cancel")}>
          Cancel challenge
        </Button>
      )}
      <p className="mt-4 px-1 text-[12px] text-dim">Only workouts logged after the challenge started count.</p>
    </div>
  );
}

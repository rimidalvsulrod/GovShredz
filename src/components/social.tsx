"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Swords, UserCheck, UserPlus } from "lucide-react";
import { api } from "@/client/api";
import { fail, haptic, invalidate, toast, useData } from "@/client/store";
import type { Player } from "@/client/types";
import { EXERCISES, getExercise } from "@/shared/exercises";
import { Avatar, Button, Chips, Field, Input, Select, Sheet } from "./ui";

export function FollowButton({ username, following, onChange }: { username: string; following: boolean; onChange?: (v: boolean) => void }) {
  const [on, setOn] = useState(following);
  useEffect(() => setOn(following), [following]);
  return (
    <button
      className={clsx("press inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold", on ? "bg-white/[0.08] text-ink" : "bg-lime text-black")}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const v = !on;
        setOn(v);
        haptic(10);
        try {
          await api("/api/follow", { body: { username, follow: v } });
          onChange?.(v);
          invalidate("/api/players", "/api/feed");
        } catch (err) {
          setOn(!v);
          fail(err);
        }
      }}
    >
      {on ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {on ? "Following" : "Follow"}
    </button>
  );
}

export function NewChallenge({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: string }) {
  const router = useRouter();
  const { data } = useData<{ players: Player[] }>(open ? "/api/players" : null);
  const [kind, setKind] = useState<"volume" | "workouts" | "e1rm" | "relative">("volume");
  const [exercise, setExercise] = useState("bench");
  const [days, setDays] = useState(7);
  const [title, setTitle] = useState("");
  const [stakes, setStakes] = useState("");
  const [picked, setPicked] = useState<string[]>(preset ? [preset] : []);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (preset) setPicked([preset]);
  }, [preset]);
  const needsEx = kind === "e1rm" || kind === "relative";
  const autoTitle =
    kind === "volume" ? "Volume war" : kind === "workouts" ? "Most sessions" : `${getExercise(exercise)?.name ?? ""} ${kind === "e1rm" ? "showdown" : "pound-for-pound"}`;
  return (
    <Sheet open={open} onClose={onClose} title="New challenge" tall>
      <div className="space-y-4 pt-1">
        <Field label="Type">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["volume", "Most volume", "Total weight lifted"],
                ["workouts", "Most workouts", "Sessions logged"],
                ["e1rm", "Heaviest lift", "Best est. 1RM"],
                ["relative", "Pound-for-pound", "Best lift ÷ bodyweight"],
              ] as const
            ).map(([id, name, sub]) => (
              <button
                key={id}
                onClick={() => setKind(id)}
                className={clsx("press rounded-2xl border p-3 text-left", kind === id ? "border-lime bg-lime/10" : "border-line bg-surface-2")}
              >
                <div className={clsx("text-[14px] font-bold", kind === id && "text-lime")}>{name}</div>
                <div className="text-[11px] text-muted">{sub}</div>
              </button>
            ))}
          </div>
        </Field>
        {needsEx && (
          <Field label="Exercise">
            <Select value={exercise} onChange={(e) => setExercise(e.target.value)}>
              {EXERCISES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Length">
          <Chips
            value={String(days)}
            onChange={(v) => setDays(Number(v))}
            options={[1, 3, 7, 14, 30].map((d) => ({ id: String(d), label: d === 1 ? "24 hours" : `${d} days` }))}
          />
        </Field>
        <Field label="Opponents">
          <div className="flex flex-wrap gap-2">
            {data?.players
              .filter((p) => !p.isMe)
              .map((p) => {
                const on = picked.includes(p.username);
                return (
                  <button
                    key={p.id}
                    onClick={() => setPicked(on ? picked.filter((x) => x !== p.username) : [...picked, p.username])}
                    className={clsx("press flex items-center gap-2 rounded-full border py-1 pr-3 pl-1", on ? "border-lime bg-lime/10" : "border-line bg-surface-2")}
                  >
                    <Avatar name={p.name} color={p.color} size={28} />
                    <span className="text-[13px] font-semibold">{p.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            {data && data.players.filter((p) => !p.isMe).length === 0 && <div className="text-[13px] text-muted">No other players yet. Invite your friends!</div>}
          </div>
        </Field>
        <Field label="Name">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle} maxLength={60} />
        </Field>
        <Field label="Stakes (optional)">
          <Input value={stakes} onChange={(e) => setStakes(e.target.value)} placeholder="Loser buys the protein 🥤" maxLength={120} />
        </Field>
        <Button
          size="lg"
          block
          loading={busy}
          disabled={!picked.length}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{ id: string }>("/api/challenges", {
                body: { title: title.trim() || autoTitle, kind, exercise: needsEx ? exercise : null, stakes, days, opponents: picked },
              });
              toast("Challenge sent ⚔️");
              invalidate("/api/challenges", "/api/home");
              onClose();
              router.push(`/challenge/${r.id}`);
            } catch (e) {
              fail(e);
            }
            setBusy(false);
          }}
        >
          <Swords className="h-5 w-5" /> Send challenge
        </Button>
      </div>
    </Sheet>
  );
}


"use client";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useMe } from "@/client/me";
import { useData } from "@/client/store";
import { CUSTOM_PREFIX, FEATURED, GROUPS, searchExercises, type Group } from "@/shared/exercises";
import { profileRanks } from "@/shared/ranks";
import { Chips, Sheet } from "./ui";
import { RankChip } from "./rank";

type Stats = { bests: Record<string, number> };

export function ExercisePicker({ open, onClose, onPick, exclude = [] }: { open: boolean; onClose: () => void; onPick: (id: string) => void; exclude?: string[] }) {
  const { me } = useMe();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Group | "all">("all");
  const { data } = useData<Stats>(open ? "/api/stats" : null);
  const scores = useMemo(() => {
    const m = new Map<string, number>();
    if (data) for (const e of profileRanks(data.bests, me.sex).exercises) m.set(e.id, e.score);
    return m;
  }, [data, me.sex]);
  const list = searchExercises(q, group).sort((a, b) => {
    if (q) return 0;
    const fa = FEATURED.indexOf(a.id);
    const fb = FEATURED.indexOf(b.id);
    return (fa === -1 ? 99 : fa) - (fb === -1 ? 99 : fb);
  });
  const pick = (id: string) => {
    onPick(id);
    setQ("");
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Add exercise" tall>
      <div className="sticky top-0 z-10 -mx-5 space-y-3 bg-surface px-5 pt-1 pb-3">
        <label className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4">
          <Search className="h-4 w-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-dim" />
        </label>
        <Chips value={group} onChange={setGroup} options={[{ id: "all", label: "All" }, ...GROUPS.map((g) => ({ id: g.id, label: g.name }))]} />
      </div>
      <div className="divide-y divide-line">
        {list.map((e) => {
          const used = exclude.includes(e.id);
          const s = scores.get(e.id);
          return (
            <button key={e.id} disabled={used} onClick={() => pick(e.id)} className="press flex w-full items-center gap-3 py-3 text-left disabled:opacity-40">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{e.name}</div>
                <div className="text-[12px] text-muted capitalize">
                  {GROUPS.find((g) => g.id === e.group)!.name} · {e.kind}
                  {e.perHand ? " · per dumbbell" : ""}
                </div>
              </div>
              {s != null ? <RankChip score={s} /> : <span className="text-[11px] text-dim">Unranked</span>}
            </button>
          );
        })}
        {q.trim().length > 1 && (
          <button onClick={() => pick(`${CUSTOM_PREFIX}${q.trim().slice(0, 40)}`)} className="press flex w-full items-center gap-3 py-4 text-left">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime/15 text-lime">
              <Plus className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold">Add “{q.trim()}”</div>
              <div className="text-[12px] text-muted">Custom exercise (tracked, not ranked)</div>
            </div>
          </button>
        )}
      </div>
    </Sheet>
  );
}

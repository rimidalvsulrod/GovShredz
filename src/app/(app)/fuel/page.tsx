"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Droplets, Globe, History, Minus, PencilLine, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/client/api";
import { fail, haptic, invalidate, toast, useData } from "@/client/store";
import type { Targets } from "@/client/types";
import { Button, Card, Field, Input, PageHeader, SectionTitle, Segmented, Sheet, Skeleton, Spinner } from "@/components/ui";
import { Bars, Ring } from "@/components/charts";
import { MEALS, sumMacros, type MealType } from "@/shared/nutrition";
import type { Food } from "@/shared/foods";
import { dayKey, shiftDay } from "@/shared/units";

type Meal = { id: string; meal: MealType; name: string; serving: string; servings: number; kcal: number; protein: number; carbs: number; fat: number };
type DayData = { meals: Meal[]; waterMl: number; targets: Targets; goal: string };
type History = {
  days: { day: string; kcal: number; protein: number; carbs: number; fat: number; items: number }[];
  recent: (Food & { uses: number })[];
};

const GLASS = 250;
const MACRO_COLORS = { protein: "#ff3d8b", carbs: "#2ee6ff", fat: "#ffd23f" };

function dayLabel(d: string, today: string) {
  if (d === today) return "Today";
  if (d === shiftDay(today, -1)) return "Yesterday";
  return new Date(`${d}T12:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function FuelPage() {
  const today = dayKey();
  const [day, setDay] = useState(today);
  const { data, mutate } = useData<DayData>(`/api/meals?day=${day}`);
  const { data: hist } = useData<History>(`/api/meals/history?today=${today}&days=7`);
  const [adding, setAdding] = useState<MealType | null>(null);
  const eaten = sumMacros(data?.meals ?? []);
  const t = data?.targets;
  const left = t ? t.kcal - eaten.kcal : 0;

  const setWater = async (ml: number) => {
    if (!data) return;
    haptic(10);
    mutate({ ...data, waterMl: ml });
    try {
      await api("/api/water", { body: { day, ml } });
    } catch (e) {
      fail(e);
    }
  };

  const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));
  const logged = hist?.days.filter((d) => d.day !== today && d.kcal > 0) ?? [];
  const avg = logged.length ? logged.reduce((s, d) => s + d.kcal, 0) / logged.length : 0;

  return (
    <div className="rise">
      <PageHeader title="Fuel" subtitle="Calories & macros" />

      <div className="mb-3 flex items-center justify-between">
        <button className="press grid h-10 w-10 place-items-center rounded-full bg-white/[0.06]" onClick={() => setDay(shiftDay(day, -1))} aria-label="Previous day">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="font-display text-[22px] font-extrabold uppercase italic">{dayLabel(day, today)}</div>
        <button
          className="press grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] disabled:opacity-30"
          disabled={day >= today}
          onClick={() => setDay(shiftDay(day, 1))}
          aria-label="Next day"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <Card className="p-5">
        {!t ? (
          <Skeleton className="h-36" />
        ) : (
          <div className="flex items-center gap-5">
            <Ring value={eaten.kcal / t.kcal} size={132} stroke={13} color={left < 0 ? "#ff4d2e" : "#c8ff2e"}>
              <div>
                <div className="font-display tabular text-[34px] leading-none font-black">{Math.abs(Math.round(left))}</div>
                <div className="text-[11px] font-semibold text-muted">{left < 0 ? "kcal over" : "kcal left"}</div>
              </div>
            </Ring>
            <div className="min-w-0 flex-1 space-y-2.5">
              {(["protein", "carbs", "fat"] as const).map((k) => (
                <div key={k}>
                  <div className="flex justify-between text-[12px]">
                    <span className="font-semibold capitalize">{k}</span>
                    <span className="tabular text-muted">
                      {Math.round(eaten[k])}/{t[k]}g
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, (eaten[k] / t[k]) * 100)}%`, background: MACRO_COLORS[k] }} />
                  </div>
                </div>
              ))}
              <div className="text-[12px] text-muted">
                <span className="tabular font-semibold text-ink">{Math.round(eaten.kcal)}</span> / {t.kcal} kcal ·{" "}
                <Link href="/settings#targets" className="text-lime">
                  {data?.goal}
                </Link>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="mt-2.5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Droplets className="h-5 w-5 text-cyan" /> Water
          </div>
          <div className="tabular text-[13px] text-muted">{((data?.waterMl ?? 0) / 1000).toFixed(2)} L</div>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <button className="press grid h-9 w-9 place-items-center rounded-full bg-white/[0.06]" onClick={() => setWater(Math.max(0, (data?.waterMl ?? 0) - GLASS))} aria-label="Less water">
            <Minus className="h-4 w-4" />
          </button>
          <div className="flex flex-1 justify-between">
            {Array.from({ length: 8 }, (_, i) => {
              const full = (data?.waterMl ?? 0) >= (i + 1) * GLASS;
              return (
                <button
                  key={i}
                  onClick={() => setWater((i + 1) * GLASS === data?.waterMl ? i * GLASS : (i + 1) * GLASS)}
                  className={clsx("h-9 w-[9%] rounded-b-lg rounded-t-sm border transition-all", full ? "border-cyan bg-cyan/70 shadow-[0_0_10px_rgba(46,230,255,0.5)]" : "border-line-2 bg-transparent")}
                  aria-label={`${i + 1} glasses`}
                />
              );
            })}
          </div>
          <button className="press grid h-9 w-9 place-items-center rounded-full bg-cyan/20 text-cyan" onClick={() => setWater((data?.waterMl ?? 0) + GLASS)} aria-label="More water">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Card>

      {MEALS.map((m) => {
        const items = data?.meals.filter((x) => x.meal === m.id) ?? [];
        const kcal = items.reduce((s, x) => s + x.kcal, 0);
        return (
          <div key={m.id}>
            <SectionTitle
              action={
                <button onClick={() => setAdding(m.id)} className="press inline-flex items-center gap-1 rounded-full bg-lime px-3 py-1.5 text-[13px] font-bold text-black">
                  <Plus className="h-4 w-4" /> Add
                </button>
              }
            >
              {m.name} <span className="ml-1 text-[14px] font-semibold text-muted not-italic">{Math.round(kcal)} kcal</span>
            </SectionTitle>
            {!data ? (
              <Skeleton className="h-14" />
            ) : items.length === 0 ? (
              <button onClick={() => setAdding(m.id)} className="card press w-full p-4 text-left text-[14px] text-dim">
                Nothing logged
              </button>
            ) : (
              <div className="card divide-y divide-line">
                {items.map((x) => (
                  <div key={x.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold">{x.name}</div>
                      <div className="truncate text-[12px] text-muted">
                        {x.servings !== 1 ? `${+x.servings.toFixed(2)} × ` : ""}
                        {x.serving || "serving"} · P {Math.round(x.protein)} · C {Math.round(x.carbs)} · F {Math.round(x.fat)}
                      </div>
                    </div>
                    <div className="tabular text-[15px] font-bold">{Math.round(x.kcal)}</div>
                    <button
                      className="press grid h-8 w-8 place-items-center rounded-full text-dim hover:text-bad"
                      aria-label="Delete"
                      onClick={async () => {
                        mutate({ ...data, meals: data.meals.filter((y) => y.id !== x.id) });
                        try {
                          await api(`/api/meals?id=${x.id}`, { method: "DELETE" });
                          invalidate("/api/meals/history", "/api/home");
                        } catch (e) {
                          fail(e);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <SectionTitle>Last 7 days</SectionTitle>
      <Card>
        {!hist || !t ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            <Bars
              data={week.map((d) => ({
                label: "SMTWTFS"[new Date(`${d}T12:00`).getDay()],
                value: hist.days.find((x) => x.day === d)?.kcal ?? 0,
                highlight: d === day,
              }))}
              target={t.kcal}
            />
            <p className="mt-3 text-[13px] text-muted">
              {logged.length >= 3 ? (
                <>
                  You average <span className="font-bold text-ink">{Math.round(avg)} kcal</span> vs ~{t.maintenance} maintenance —{" "}
                  {avg < t.maintenance - 100 ? (
                    <span className="text-lime">about {(((t.maintenance - avg) * 7) / 7700).toFixed(2)} kg/week fat loss pace.</span>
                  ) : avg > t.maintenance + 100 ? (
                    <span className="text-cyan">a surplus of ~{Math.round(avg - t.maintenance)} kcal/day.</span>
                  ) : (
                    <span>right around maintenance.</span>
                  )}{" "}
                  The Body tab uses this for your future physique.
                </>
              ) : (
                <>Log at least 3 days and we&apos;ll compare your intake to your ~{t.maintenance} kcal maintenance.</>
              )}
            </p>
          </>
        )}
      </Card>

      <AddFood
        meal={adding}
        day={day}
        recent={hist?.recent ?? []}
        onClose={() => setAdding(null)}
        onAdded={(m) => {
          if (data) mutate({ ...data, meals: [...data.meals, m] });
          invalidate("/api/meals/history", "/api/home");
        }}
      />
    </div>
  );
}

function AddFood({ meal, day, recent, onClose, onAdded }: { meal: MealType | null; day: string; recent: Food[]; onClose: () => void; onAdded: (m: Meal) => void }) {
  const [tab, setTab] = useState<"search" | "recent" | "custom">("search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ foods: Food[]; online: Food[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await api(`/api/foods?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal }));
      } catch {}
      setSearching(false);
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const close = () => {
    setPicked(null);
    setQ("");
    onClose();
  };

  const row = (f: Food, i: number) => (
    <button key={`${f.name}-${i}`} onClick={() => setPicked(f)} className="press flex w-full items-center gap-3 py-3 text-left">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{f.name}</div>
        <div className="truncate text-[12px] text-muted">
          {f.brand ? `${f.brand} · ` : ""}
          {f.serving} · P {Math.round(f.protein)} C {Math.round(f.carbs)} F {Math.round(f.fat)}
        </div>
      </div>
      <div className="tabular text-[15px] font-bold">{Math.round(f.kcal)}</div>
    </button>
  );

  return (
    <Sheet open={!!meal} onClose={close} title={`Add to ${MEALS.find((m) => m.id === meal)?.name ?? ""}`} tall>
      {picked ? (
        <ServingEditor food={picked} onBack={() => setPicked(null)} meal={meal!} day={day} onAdded={(m) => { onAdded(m); close(); }} />
      ) : (
        <div className="pt-1">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { id: "search", label: <span className="inline-flex items-center gap-1"><Search className="h-3.5 w-3.5" /> Search</span> },
              { id: "recent", label: <span className="inline-flex items-center gap-1"><History className="h-3.5 w-3.5" /> Recent</span> },
              { id: "custom", label: <span className="inline-flex items-center gap-1"><PencilLine className="h-3.5 w-3.5" /> Custom</span> },
            ]}
          />
          {tab === "search" && (
            <div className="mt-3">
              <label className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4">
                <Search className="h-4 w-4 text-muted" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chicken, oats, Big Mac…" className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-dim" />
                {searching && <Spinner className="h-4 w-4" />}
              </label>
              {results && (
                <div className="mt-2">
                  {results.foods.length > 0 && <div className="divide-y divide-line">{results.foods.map(row)}</div>}
                  {results.online.length > 0 && (
                    <>
                      <div className="mt-4 mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">
                        <Globe className="h-3.5 w-3.5" /> Packaged foods
                      </div>
                      <div className="divide-y divide-line">{results.online.map(row)}</div>
                    </>
                  )}
                  {!results.foods.length && !results.online.length && !searching && (
                    <div className="py-6 text-center text-[14px] text-muted">
                      No matches.{" "}
                      <button className="font-semibold text-lime" onClick={() => setTab("custom")}>
                        Add it manually
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!results && <p className="mt-6 text-center text-[13px] text-dim">Search everyday foods and packaged products.</p>}
            </div>
          )}
          {tab === "recent" && (
            <div className="mt-2 divide-y divide-line">
              {recent.length ? recent.map(row) : <p className="py-8 text-center text-[14px] text-muted">Foods you log show up here for one-tap adding.</p>}
            </div>
          )}
          {tab === "custom" && <CustomFood meal={meal!} day={day} onAdded={(m) => { onAdded(m); close(); }} />}
        </div>
      )}
    </Sheet>
  );
}

function ServingEditor({ food, meal, day, onBack, onAdded }: { food: Food; meal: MealType; day: string; onBack: () => void; onAdded: (m: Meal) => void }) {
  const [servings, setServings] = useState("1");
  const [busy, setBusy] = useState(false);
  const n = Math.max(0, Number(servings) || 0);
  const m = { kcal: food.kcal * n, protein: food.protein * n, carbs: food.carbs * n, fat: food.fat * n };
  return (
    <div className="space-y-4 pt-1">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-[14px] text-muted">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <div>
        <div className="text-[20px] font-bold">{food.name}</div>
        <div className="text-[13px] text-muted">
          {food.brand ? `${food.brand} · ` : ""}1 serving = {food.serving}
        </div>
      </div>
      <Field label="Servings">
        <div className="flex items-center gap-2">
          <button className="press grid h-12 w-12 place-items-center rounded-2xl bg-surface-3" onClick={() => setServings(String(Math.max(0.25, +(n - 0.5).toFixed(2))))}>
            <Minus className="h-5 w-5" />
          </button>
          <Input inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} className="text-center text-[20px] font-bold" />
          <button className="press grid h-12 w-12 place-items-center rounded-2xl bg-surface-3" onClick={() => setServings(String(+(n + 0.5).toFixed(2)))}>
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </Field>
      <div className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            ["kcal", m.kcal, "#c8ff2e"],
            ["protein", m.protein, MACRO_COLORS.protein],
            ["carbs", m.carbs, MACRO_COLORS.carbs],
            ["fat", m.fat, MACRO_COLORS.fat],
          ] as const
        ).map(([k, v, c]) => (
          <div key={k} className="card p-2.5">
            <div className="font-display tabular text-[22px] font-extrabold" style={{ color: c }}>
              {Math.round(v)}
            </div>
            <div className="text-[11px] text-muted capitalize">{k === "kcal" ? "kcal" : `${k} g`}</div>
          </div>
        ))}
      </div>
      <Button
        size="lg"
        block
        loading={busy}
        disabled={n <= 0}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api<{ meal: Meal }>("/api/meals", { body: { day, meal, name: food.brand ? `${food.name} (${food.brand})`.slice(0, 120) : food.name, serving: food.serving, servings: n, ...m } });
            toast(`Added ${Math.round(m.kcal)} kcal`);
            onAdded(r.meal);
          } catch (e) {
            fail(e);
            setBusy(false);
          }
        }}
      >
        Add {Math.round(m.kcal)} kcal
      </Button>
    </div>
  );
}

function CustomFood({ meal, day, onAdded }: { meal: MealType; day: string; onAdded: (m: Meal) => void }) {
  const [f, setF] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
  const [busy, setBusy] = useState(false);
  const num = (v: string) => Math.max(0, Number(v) || 0);
  // Fill in calories from macros if left blank.
  const kcal = f.kcal ? num(f.kcal) : num(f.protein) * 4 + num(f.carbs) * 4 + num(f.fat) * 9;
  return (
    <div className="mt-4 space-y-3">
      <Field label="Food">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Mom's lasagna" maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
          <Field key={k} label={k === "kcal" ? "Calories" : `${k} (g)`}>
            <Input inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={k === "kcal" ? String(Math.round(kcal) || "") : "0"} />
          </Field>
        ))}
      </div>
      <Button
        size="lg"
        block
        loading={busy}
        disabled={!f.name.trim() || kcal <= 0}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api<{ meal: Meal }>("/api/meals", {
              body: { day, meal, name: f.name.trim(), serving: "1 serving", servings: 1, kcal, protein: num(f.protein), carbs: num(f.carbs), fat: num(f.fat) },
            });
            toast(`Added ${Math.round(kcal)} kcal`);
            onAdded(r.meal);
          } catch (e) {
            fail(e);
            setBusy(false);
          }
        }}
      >
        Add {Math.round(kcal)} kcal
      </Button>
    </div>
  );
}

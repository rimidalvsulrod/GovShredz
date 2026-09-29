"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { AlertTriangle, Camera, ChevronRight, Clock, Eye, ScanLine, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/client/api";
import { useMe } from "@/client/me";
import { fail, invalidate, toast, useData } from "@/client/store";
import type { Scan } from "@/client/types";
import { Button, Card, Chips, Field, Input, PageHeader, SectionTitle, Segmented, Sheet, Skeleton, Toggle } from "@/components/ui";
import { HeightInput, WeightInput } from "@/components/body-inputs";
import { LineChart } from "@/components/charts";
import { RankChip } from "@/components/rank";
import { buildBodyMesh, targetVolume, type BodyMesh } from "@/body/mesh";
import { applyCorrection, photoCorrection, shapeFromStats, type Shape } from "@/body/shape";
import type { ViewMode } from "@/body/viewer";
import type { Analysis } from "@/body/analyze";
import {
  bfLabel,
  composition,
  EXPERIENCES,
  experienceFromStrength,
  ffmiLabel,
  GOALS,
  project,
  type BodyStats,
  type Experience,
  type Goal,
  type PhotoMetrics,
} from "@/shared/physique";
import { profileRanks, rankInfo, type Sex } from "@/shared/ranks";
import { dayKey, fmtW, fromKg } from "@/shared/units";
import type { Group } from "@/shared/exercises";

const BodyViewer = dynamic(() => import("@/body/viewer").then((m) => m.BodyViewer), {
  ssr: false,
  loading: () => <div className="h-full w-full" />,
});

type BodyData = { scans: Scan[]; weights: { day: string; weightKg: number }[] };
type Hist = { days: { day: string; kcal: number }[] };

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Build a mesh off the critical path so the UI can paint the "scanning" state first. */
function useMeshes(shapes: { shape: Shape; stats: BodyStats & { bodyFat: number } }[] | null) {
  const [meshes, setMeshes] = useState<BodyMesh[]>([]);
  const [busy, setBusy] = useState(false);
  const key = shapes ? JSON.stringify(shapes) : "";
  useEffect(() => {
    if (!shapes) return;
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(() => {
      const mobile = window.innerWidth < 700;
      const out = shapes.map(({ shape, stats }) =>
        buildBodyMesh(shape, { voxel: mobile ? 0.0074 : 0.0062, targetVolume: targetVolume(stats.weightKg, stats.bodyFat) }),
      );
      if (!cancelled) {
        setMeshes(out);
        setBusy(false);
      }
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { meshes, busy };
}

export default function BodyPage() {
  const { me } = useMe();
  const today = dayKey();
  const { data } = useData<BodyData>("/api/body");
  const { data: stats } = useData<{ bests: Record<string, number> }>("/api/stats");
  const { data: hist } = useData<Hist>(`/api/meals/history?today=${today}&days=14`);
  const [mode, setMode] = useState<ViewMode>("skin");
  const [view, setView] = useState<"now" | "future" | "compare">("now");
  const [goal, setGoal] = useState<Goal>(me.goal);
  const [weeks, setWeeks] = useState(12);
  const [days, setDays] = useState(4);
  const [exp, setExp] = useState<Experience | null>(null);
  const [useMeals, setUseMeals] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const scan = data?.scans[0] ?? null;
  const ranks = stats ? profileRanks(stats.bests, me.sex) : null;
  const strength = ranks?.overall ?? 0;
  const experience = exp ?? experienceFromStrength(strength);

  const current: (BodyStats & { bodyFat: number }) | null = useMemo(() => {
    if (!data || !stats) return null;
    const base: BodyStats = {
      sex: me.sex,
      heightCm: scan?.heightCm ?? me.heightCm ?? 175,
      weightKg: me.weightKg ?? scan?.weightKg ?? 75,
      age: me.age,
      metrics: scan?.metrics ?? null,
      strength,
    };
    const bodyFat = scan && Math.abs((scan.weightKg ?? 0) - base.weightKg) < 0.5 ? scan.bodyFat : composition(base).bodyFat;
    return { ...base, bodyFat };
  }, [data, stats, scan, me.sex, me.heightCm, me.weightKg, me.age, strength]);

  // Energy balance from the meal log (needs 3+ logged days).
  const logged = hist?.days.filter((d) => d.day !== today && d.kcal > 300) ?? [];
  const avgKcal = logged.length >= 3 ? logged.reduce((s, d) => s + d.kcal, 0) / logged.length : null;
  const { data: dayData } = useData<{ targets: { maintenance: number } }>(avgKcal != null ? `/api/meals?day=${today}` : null);
  const kcalDelta = useMeals && avgKcal != null && dayData ? avgKcal - dayData.targets.maintenance : null;

  const timeline = useMemo(
    () => (current ? project(current, { goal, weeks, days, experience, kcalDelta }) : null),
    [current, goal, weeks, days, experience, kcalDelta],
  );
  const future = timeline?.[timeline.length - 1];

  const groupColors = useMemo(() => {
    const out: Partial<Record<Group | "none", string>> = { none: "#2d2d38" };
    if (ranks) for (const [g, v] of Object.entries(ranks.groups)) out[g as Group] = v.best ? rankInfo(v.score).tier.c1 : "#4a4a55";
    return out;
  }, [ranks]);

  const shapes = useMemo(() => {
    if (!current || !future) return null;
    const skin = scan?.skin ?? "#c68863";
    const nowModel = shapeFromStats(current, skin);
    const corr = photoCorrection(nowModel, current.metrics as PhotoMetrics | null);
    const now = { ...applyCorrection(nowModel, corr), groupColors };
    const futStats = { ...current, weightKg: future.weightKg, bodyFat: future.bodyFat, strength: future.strength, metrics: null };
    const fut = { ...applyCorrection(shapeFromStats(futStats, skin), corr), groupColors };
    const list = view === "now" ? [{ shape: now, stats: current }] : view === "future" ? [{ shape: fut, stats: futStats }] : [{ shape: now, stats: current }, { shape: fut, stats: futStats }];
    return list;
  }, [current, future, scan, view, groupColors]);

  // Debounce slider-driven rebuilds.
  const [debounced, setDebounced] = useState(shapes);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(shapes), 180);
    return () => clearTimeout(t);
  }, [shapes]);
  const { meshes, busy } = useMeshes(debounced);

  const comp = current ? composition(current) : null;
  const futComp = future && current ? composition({ ...current, weightKg: future.weightKg, bodyFat: future.bodyFat }) : null;

  return (
    <div className="rise">
      <PageHeader
        title="Body"
        subtitle="3D physique simulator"
        right={
          <Button size="sm" onClick={() => setScanOpen(true)}>
            <Camera className="h-4 w-4" /> Scan
          </Button>
        }
      />

      <div className="card relative overflow-hidden p-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(46,230,255,0.12),transparent_60%)]" />
        <div className="relative h-[58dvh] max-h-[560px] min-h-[380px]">
          {meshes.length > 0 && <BodyViewer models={meshes} mode={mode} scanning={busy} className="absolute inset-0" />}
          {(!meshes.length || busy) && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-2 text-[13px] text-muted">
                <ScanLine className="h-8 w-8 animate-pulse text-lime" />
                Building your model…
              </div>
            </div>
          )}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {view !== "future" && comp && (
              <div className="glass rounded-xl border border-line px-2.5 py-1.5 text-[11px]">
                <div className="font-bold text-lime">{view === "compare" ? "NOW" : "YOU NOW"}</div>
                <div className="tabular text-muted">
                  {fmtW(current!.weightKg, me.unit)} · {pct(comp.bodyFat)} BF
                </div>
              </div>
            )}
          </div>
          {view !== "now" && future && futComp && (
            <div className="absolute top-3 right-3 text-right">
              <div className="glass rounded-xl border border-cyan/30 px-2.5 py-1.5 text-[11px]">
                <div className="font-bold text-cyan">IN {weeks} WEEKS</div>
                <div className="tabular text-muted">
                  {fmtW(future.weightKg, me.unit)} · {pct(future.bodyFat)} BF
                </div>
              </div>
            </div>
          )}
          <div className="absolute inset-x-3 bottom-3 space-y-2">
            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              className="glass"
              options={[
                { id: "now", label: "Now" },
                { id: "future", label: "Future" },
                { id: "compare", label: "Side by side" },
              ]}
            />
            <Segmented
              size="sm"
              value={mode}
              onChange={setMode}
              className="glass"
              options={[
                { id: "skin", label: "Skin" },
                { id: "rank", label: "Rank map" },
                { id: "holo", label: "Hologram" },
              ]}
            />
          </div>
        </div>
      </div>
      {mode === "rank" && ranks && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(["chest", "back", "shoulders", "arms", "legs", "core"] as const).map((g) => (
            <span key={g} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold capitalize">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: groupColors[g] }} /> {g}
              {ranks.groups[g].best ? <span style={{ color: rankInfo(ranks.groups[g].score).tier.ink }}>{rankInfo(ranks.groups[g].score).name}</span> : <span className="text-dim">—</span>}
            </span>
          ))}
        </div>
      )}

      {!scan && data && (
        <button onClick={() => setScanOpen(true)} className="card press mt-3 flex w-full items-center gap-3 p-4 text-left">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-lime/15 text-lime">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <div className="font-bold">Scan your body</div>
            <div className="text-[12px] text-muted">Upload a full-body photo and the model reshapes to match you.</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted" />
        </button>
      )}

      <SectionTitle>Your stats</SectionTitle>
      {!comp || !current ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <StatBox label="Body fat" value={pct(comp.bodyFat)} sub={bfLabel(comp.bodyFat, me.sex)} />
          <StatBox label="Lean mass" value={fmtW(comp.leanKg, me.unit)} sub={`Fat ${fmtW(comp.fatKg, me.unit)}`} />
          <StatBox label="FFMI" value={comp.ffmi.toFixed(1)} sub={ffmiLabel(comp.ffmi, me.sex)} />
          <StatBox
            label={comp.shoulderToWaist ? "V-taper" : "BMI"}
            value={comp.shoulderToWaist ? comp.shoulderToWaist.toFixed(2) : comp.bmi.toFixed(1)}
            sub={comp.shoulderToWaist ? "shoulder ÷ waist" : scan ? "" : "scan a photo for V-taper"}
          />
        </div>
      )}
      <p className="mt-2 px-1 text-[12px] text-dim">
        {scan ? `Last scan ${new Date(scan.createdAt).toLocaleDateString()} · ${scan.source === "photo" ? "photo + stats" : "stats only"}.` : "Estimated from your height, weight, age and strength."}{" "}
        <button className="text-lime" onClick={() => setHistoryOpen(true)}>
          History
        </button>
      </p>

      <SectionTitle>Future you</SectionTitle>
      <Card className="space-y-4">
        <Field label="Goal">
          <Chips value={goal} onChange={setGoal} options={GOALS.map((g) => ({ id: g.id, label: g.name }))} />
        </Field>
        <div>
          <div className="flex justify-between text-[12px] font-semibold tracking-wide text-muted uppercase">
            <span>Timeframe</span>
            <span className="text-ink normal-case">
              {weeks} weeks {weeks >= 8 && <span className="text-muted">(~{(weeks / 4.345).toFixed(1)} months)</span>}
            </span>
          </div>
          <input type="range" min={2} max={104} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="mt-2 w-full accent-[#c8ff2e]" />
        </div>
        <div>
          <div className="flex justify-between text-[12px] font-semibold tracking-wide text-muted uppercase">
            <span>Training days / week</span>
            <span className="text-ink">{days}</span>
          </div>
          <input type="range" min={1} max={7} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-2 w-full accent-[#c8ff2e]" />
        </div>
        <Field label="Training experience">
          <Chips value={experience} onChange={(v) => setExp(v)} options={EXPERIENCES.map((e) => ({ id: e.id, label: e.name }))} />
        </Field>
        {avgKcal != null && (
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
            <div className="flex-1 text-[13px]">
              <div className="font-semibold">Use my meal log</div>
              <div className="text-muted">
                You average {Math.round(avgKcal)} kcal/day
                {dayData ? ` (${avgKcal - dayData.targets.maintenance >= 0 ? "+" : ""}${Math.round(avgKcal - dayData.targets.maintenance)} vs maintenance)` : ""}.
              </div>
            </div>
            <Toggle on={useMeals} onChange={setUseMeals} />
          </div>
        )}
        {future && current && futComp && comp && (
          <div className="grid grid-cols-2 gap-2">
            <Delta label="Weight" a={fromKg(current.weightKg, me.unit)} b={fromKg(future.weightKg, me.unit)} unit={me.unit} />
            <Delta label="Body fat" a={comp.bodyFat * 100} b={future.bodyFat * 100} unit="%" lowerIsBetter />
            <Delta label="Lean mass" a={fromKg(comp.leanKg, me.unit)} b={fromKg(future.leanKg, me.unit)} unit={me.unit} />
            <div className="rounded-2xl bg-white/[0.04] p-3">
              <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">Rank</div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <RankChip score={strength} /> <span className="text-dim">→</span> <RankChip score={future.strength} />
              </div>
            </div>
          </div>
        )}
        {timeline && (
          <div>
            <div className="mb-1 text-[12px] font-semibold tracking-wider text-muted uppercase">Projected body fat</div>
            <LineChart points={timeline.map((p) => ({ x: p.week, y: p.bodyFat * 100 }))} height={110} color="#2ee6ff" format={(v) => `${v.toFixed(1)}%`} xLabel={(x) => `wk ${x}`} />
          </div>
        )}
        <Button variant="secondary" block onClick={() => setView("compare")}>
          <Eye className="h-4 w-4" /> Compare side by side
        </Button>
        <p className="text-[11px] leading-relaxed text-dim">
          Projection uses natural muscle-gain rates by experience (Aragon), energy balance (~7,700 kcal per kg) and your training frequency. It&apos;s a motivational estimate, not a promise.
        </p>
      </Card>

      {data && data.weights.length > 1 && (
        <>
          <SectionTitle>Bodyweight</SectionTitle>
          <Card>
            <LineChart
              points={data.weights.map((w) => ({ x: new Date(`${w.day}T12:00`).getTime(), y: fromKg(w.weightKg, me.unit) }))}
              format={(v) => `${v.toFixed(1)} ${me.unit}`}
              xLabel={(x) => new Date(x).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            />
          </Card>
        </>
      )}

      <ScanSheet open={scanOpen} onClose={() => setScanOpen(false)} strength={strength} />
      <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} scans={data?.scans ?? []} />
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3.5">
      <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</div>
      <div className="font-display tabular mt-1 text-[28px] leading-none font-extrabold">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-lime">{sub}</div>}
    </div>
  );
}

function Delta({ label, a, b, unit, lowerIsBetter }: { label: string; a: number; b: number; unit: string; lowerIsBetter?: boolean }) {
  const d = b - a;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return (
    <div className="rounded-2xl bg-white/[0.04] p-3">
      <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</div>
      <div className="font-display tabular mt-1 text-[22px] leading-none font-extrabold">
        {b.toFixed(1)}
        <span className="text-[13px] text-muted"> {unit}</span>
      </div>
      <div className={clsx("tabular mt-0.5 text-[12px] font-bold", Math.abs(d) < 0.05 ? "text-muted" : good ? "text-lime" : "text-hot")}>
        {d >= 0 ? "+" : ""}
        {d.toFixed(1)} {unit}
      </div>
    </div>
  );
}

/* --------------------------------- scanning -------------------------------- */

function ScanSheet({ open, onClose, strength }: { open: boolean; onClose: () => void; strength: number }) {
  const { me, refresh } = useMe();
  const [step, setStep] = useState<"stats" | "photo" | "result">("stats");
  const [unit] = useState(me.unit);
  const [sex, setSex] = useState<Sex>(me.sex);
  const [heightCm, setHeight] = useState<number | null>(me.heightCm);
  const [weightKg, setWeight] = useState<number | null>(me.weightKg);
  const [knownBf, setKnownBf] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const photo = useRef<HTMLCanvasElement | null>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) import("@/body/analyze").then((m) => m.preloadAnalyzer());
  }, [open]);

  useEffect(() => {
    if (analysis && photo.current && overlay.current) import("@/body/analyze").then((m) => m.drawOverlay(overlay.current!, photo.current!, analysis));
  }, [analysis, step]);

  const reset = () => {
    setStep("stats");
    setAnalysis(null);
    setError(null);
    setWorking(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const stats: BodyStats | null =
    heightCm && weightKg ? { sex, heightCm, weightKg, age: me.age, strength, metrics: analysis?.metrics ?? null, bodyFat: Number(knownBf) > 2 ? Number(knownBf) / 100 : null } : null;
  const comp = stats ? composition(stats) : null;

  const save = async (source: "photo" | "stats") => {
    if (!stats || !comp) return;
    setSaving(true);
    try {
      if (sex !== me.sex) await api("/api/me", { method: "PATCH", body: { sex } });
      await api("/api/body", {
        body: { heightCm: stats.heightCm, weightKg: stats.weightKg, bodyFat: comp.bodyFat, metrics: source === "photo" ? analysis?.metrics ?? null : null, skin: analysis?.skin ?? "#c68863", source, day: dayKey() },
      });
      await refresh();
      invalidate("/api/body", "/api/home", "/api/meals");
      toast("Scan saved 🔥");
      close();
    } catch (e) {
      fail(e);
    }
    setSaving(false);
  };

  return (
    <Sheet open={open} onClose={close} title="Body scan" tall>
      {step === "stats" && (
        <div className="space-y-4 pt-1">
          <p className="text-[14px] text-muted">Confirm your stats. They set the model&apos;s height, and its girth is matched to your weight.</p>
          <Field label="Sex">
            <Segmented value={sex} onChange={setSex} options={[{ id: "male", label: "Male" }, { id: "female", label: "Female" }]} />
          </Field>
          <Field label="Height">
            <HeightInput cm={heightCm} unit={unit} onChange={setHeight} />
          </Field>
          <Field label="Bodyweight">
            <WeightInput kg={weightKg} unit={unit} onChange={setWeight} />
          </Field>
          <Field label="Known body fat % (optional)" hint="From a DEXA / InBody scan. Leave empty to estimate.">
            <Input inputMode="decimal" value={knownBf} onChange={(e) => setKnownBf(e.target.value)} placeholder="e.g. 15" />
          </Field>
          <Button size="lg" block disabled={!stats} onClick={() => setStep("photo")}>
            Next: photo
          </Button>
          <Button variant="ghost" block disabled={!stats} loading={saving} onClick={() => save("stats")}>
            Skip photo, save stats only
          </Button>
        </div>
      )}

      {step === "photo" && (
        <div className="space-y-4 pt-1">
          <div className="rounded-2xl border border-line bg-surface-2 p-4 text-[13px] leading-relaxed text-muted">
            <div className="mb-1.5 font-bold text-ink">For the best scan</div>
            • Full body, head to feet, facing the camera
            <br />• Arms held out ~30–45° from your sides
            <br />• Fitted clothes or shirtless, plain background, good light
            <br />• Phone at chest height, 2–3 m away (use a timer)
            <div className="mt-2 font-semibold text-lime">🔒 Your photo is analysed on your phone and never uploaded.</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setWorking(true);
              setError(null);
              try {
                const m = await import("@/body/analyze");
                photo.current = await m.loadImage(file);
                const a = await m.analyzePhoto(photo.current);
                setAnalysis(a);
                setStep("result");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't analyse that photo.");
              }
              setWorking(false);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={working}
            className="press relative flex h-56 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border-2 border-dashed border-lime/40 bg-lime/[0.04]"
          >
            {working ? (
              <>
                <div className="scan-line" />
                <ScanLine className="h-10 w-10 animate-pulse text-lime" />
                <div className="font-semibold">Analysing your physique…</div>
                <div className="text-[12px] text-muted">Finding joints & silhouette (first time downloads the AI model)</div>
              </>
            ) : (
              <>
                <Camera className="h-10 w-10 text-lime" />
                <div className="font-bold">Take or choose a photo</div>
                <div className="text-[12px] text-muted">JPG / PNG / HEIC</div>
              </>
            )}
          </button>
          {error && (
            <div className="flex gap-2 rounded-2xl border border-bad/30 bg-bad/10 p-3 text-[13px] text-bad">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <Button variant="ghost" block onClick={() => setStep("stats")}>
            Back
          </Button>
        </div>
      )}

      {step === "result" && analysis && comp && (
        <div className="space-y-4 pt-1">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-black">
            <canvas ref={overlay} className="mx-auto block max-h-[46dvh] w-auto max-w-full" />
          </div>
          {analysis.warnings.length > 0 && (
            <div className="space-y-1 rounded-2xl border border-warn/30 bg-warn/10 p-3 text-[12px] text-warn">
              {analysis.warnings.map((w) => (
                <div key={w} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Body fat (est.)" value={pct(comp.bodyFat)} sub={bfLabel(comp.bodyFat, sex)} />
            <StatBox label="V-taper" value={comp.shoulderToWaist?.toFixed(2) ?? "—"} sub="shoulder ÷ waist" />
            <StatBox label="Waist" value={comp.waistCm ? (unit === "lb" ? `${(comp.waistCm / 2.54).toFixed(1)}″` : `${comp.waistCm.toFixed(0)} cm`) : "—"} sub="circumference (est.)" />
            <StatBox label="Scan quality" value={`${Math.round(analysis.confidence * 100)}%`} sub={analysis.confidence > 0.7 ? "Good" : "Try a better photo"} />
          </div>
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <span className="h-5 w-5 rounded-full border border-line-2" style={{ background: analysis.skin }} /> Skin tone picked for your model
          </div>
          <Button size="lg" block loading={saving} onClick={() => save("photo")}>
            Save scan & build model
          </Button>
          <Button variant="ghost" block onClick={() => setStep("photo")}>
            Try another photo
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function HistorySheet({ open, onClose, scans }: { open: boolean; onClose: () => void; scans: Scan[] }) {
  const { me } = useMe();
  return (
    <Sheet open={open} onClose={onClose} title="Scan history">
      {scans.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-muted">No scans yet.</p>
      ) : (
        <div className="divide-y divide-line">
          {scans.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-3">
              <Clock className="h-4 w-4 text-dim" />
              <div className="flex-1">
                <div className="text-[14px] font-semibold">{new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                <div className="text-[12px] text-muted">
                  {fmtW(s.weightKg, me.unit)} · {pct(s.bodyFat)} BF · {s.source}
                </div>
              </div>
              <button
                className="press grid h-8 w-8 place-items-center rounded-full text-dim"
                aria-label="Delete scan"
                onClick={async () => {
                  if (!confirm("Delete this scan?")) return;
                  try {
                    await api(`/api/body?id=${s.id}`, { method: "DELETE" });
                    invalidate("/api/body");
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
    </Sheet>
  );
}

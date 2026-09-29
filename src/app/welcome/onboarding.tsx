"use client";
import { useState } from "react";
import clsx from "clsx";
import { api, hardNav } from "@/client/api";
import { fail } from "@/client/store";
import { Button, Field, Input, Segmented } from "@/components/ui";
import { HeightInput, WeightInput } from "@/components/body-inputs";
import { Logo } from "@/components/logo";
import { RankBadge } from "@/components/rank";
import { GOALS, type Goal } from "@/shared/physique";
import { dayKey, type Unit } from "@/shared/units";
import type { Sex } from "@/shared/ranks";
import type { Me } from "@/lib/auth";

export function Onboarding({ me }: { me: Me }) {
  const [unit, setUnit] = useState<Unit>(me.unit);
  const [sex, setSex] = useState<Sex>(me.sex);
  const [birthYear, setBirthYear] = useState(me.birthYear ? String(me.birthYear) : "");
  const [heightCm, setHeight] = useState<number | null>(me.heightCm);
  const [weightKg, setWeight] = useState<number | null>(me.weightKg);
  const [goal, setGoal] = useState<Goal>(me.goal);
  const [busy, setBusy] = useState(false);
  const year = Number(birthYear);
  const ok = !!heightCm && !!weightKg && year > 1920 && year < new Date().getFullYear() - 10;

  return (
    <main className="pt-safe mx-auto min-h-dvh w-full max-w-[460px] px-5 pb-10">
      <div className="mt-6 mb-8">
        <Logo size={30} />
      </div>
      <div className="rise">
        <div className="mb-6 flex items-center gap-4">
          <RankBadge score={0.5} size={64} />
          <div>
            <h1 className="font-display text-[38px] leading-[0.95] font-black uppercase italic">Let&apos;s set you up</h1>
            <p className="mt-1 text-[14px] text-muted">Your ranks are scored against your bodyweight and sex, so this matters.</p>
          </div>
        </div>
        <div className="space-y-5">
          <Field label="Units">
            <Segmented value={unit} onChange={setUnit} options={[{ id: "lb", label: "lb · ft" }, { id: "kg", label: "kg · cm" }]} />
          </Field>
          <Field label="Sex (for strength standards)">
            <Segmented value={sex} onChange={setSex} options={[{ id: "male", label: "Male" }, { id: "female", label: "Female" }]} />
          </Field>
          <Field label="Height">
            <HeightInput cm={heightCm} unit={unit} onChange={setHeight} />
          </Field>
          <Field label="Bodyweight">
            <WeightInput kg={weightKg} unit={unit} onChange={setWeight} />
          </Field>
          <Field label="Birth year">
            <Input inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2000" />
          </Field>
          <Field label="Goal">
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoal(g.id)}
                  className={clsx("press rounded-2xl border p-3 text-left", goal === g.id ? "border-lime bg-lime/10" : "border-line bg-surface-2")}
                >
                  <div className={clsx("font-semibold", goal === g.id && "text-lime")}>{g.name}</div>
                  <div className="text-[12px] text-muted">{g.blurb}</div>
                </button>
              ))}
            </div>
          </Field>
          <Button
            size="lg"
            block
            loading={busy}
            disabled={!ok}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/api/me", { method: "PATCH", body: { unit, sex, heightCm, weightKg, birthYear: year, goal, onboarded: true, day: dayKey() } });
                hardNav("/home");
              } catch (e) {
                fail(e);
                setBusy(false);
              }
            }}
          >
            Let&apos;s get it
          </Button>
        </div>
      </div>
    </main>
  );
}

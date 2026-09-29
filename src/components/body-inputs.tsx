"use client";
import { useEffect, useState } from "react";
import { cmToFtIn, ftInToCm, fromKg, roundW, toKg, type Unit } from "@/shared/units";
import { inputCls } from "./ui";

/** Height in ft + in (lb users) or cm (kg users). Always reports cm. */
export function HeightInput({ cm, unit, onChange }: { cm: number | null; unit: Unit; onChange: (cm: number | null) => void }) {
  const init = cm ? cmToFtIn(cm) : null;
  const [ft, setFt] = useState(init ? String(init.ft) : "");
  const [inch, setInch] = useState(init ? String(init.inch) : "");
  const [c, setC] = useState(cm ? String(Math.round(cm)) : "");
  useEffect(() => {
    if (!cm) return;
    const v = cmToFtIn(cm);
    setFt(String(v.ft));
    setInch(String(v.inch));
    setC(String(Math.round(cm)));
    // Only re-sync when the unit flips, not while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);
  if (unit === "kg")
    return (
      <div className="relative">
        <input
          className={inputCls}
          inputMode="numeric"
          value={c}
          placeholder="178"
          onChange={(e) => {
            setC(e.target.value);
            const v = Number(e.target.value);
            onChange(v >= 100 && v <= 250 ? v : null);
          }}
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] text-dim">cm</span>
      </div>
    );
  const update = (f: string, i: string) => {
    const F = Number(f);
    const I = Number(i || 0);
    const v = ftInToCm(F, I);
    onChange(F >= 3 && F <= 8 && I >= 0 && I < 12 ? v : null);
  };
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          className={inputCls}
          inputMode="numeric"
          value={ft}
          placeholder="5"
          onChange={(e) => {
            setFt(e.target.value);
            update(e.target.value, inch);
          }}
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] text-dim">ft</span>
      </div>
      <div className="relative flex-1">
        <input
          className={inputCls}
          inputMode="numeric"
          value={inch}
          placeholder="10"
          onChange={(e) => {
            setInch(e.target.value);
            update(ft, e.target.value);
          }}
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] text-dim">in</span>
      </div>
    </div>
  );
}

/** Bodyweight in the user's unit. Always reports kg. */
export function WeightInput({ kg, unit, onChange, placeholder }: { kg: number | null; unit: Unit; onChange: (kg: number | null) => void; placeholder?: string }) {
  const [v, setV] = useState(kg ? String(roundW(fromKg(kg, unit))) : "");
  useEffect(() => {
    if (kg) setV(String(roundW(fromKg(kg, unit))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);
  return (
    <div className="relative">
      <input
        className={inputCls}
        inputMode="decimal"
        value={v}
        placeholder={placeholder ?? (unit === "lb" ? "180" : "82")}
        onChange={(e) => {
          setV(e.target.value);
          const n = Number(e.target.value);
          const k = toKg(n, unit);
          onChange(n > 0 && k >= 30 && k <= 300 ? k : null);
        }}
      />
      <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] text-dim">{unit}</span>
    </div>
  );
}

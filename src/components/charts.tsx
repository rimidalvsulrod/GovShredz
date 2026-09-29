"use client";
import { useId, useState } from "react";

/** Smooth line chart with a gradient fill. Points must be in x order. */
export function LineChart({
  points,
  height = 160,
  color = "#c8ff2e",
  format = (v: number) => String(Math.round(v)),
  xLabel,
}: {
  points: { x: number; y: number }[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
  xLabel?: (x: number) => string;
}) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return <div className="grid place-items-center text-[13px] text-dim" style={{ height }}>No data yet</div>;
  const W = 340;
  const H = height;
  const pad = { l: 6, r: 6, t: 14, b: 20 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  if (y0 === y1) {
    y0 -= 1;
    y1 += 1;
  }
  const span = y1 - y0;
  y0 -= span * 0.12;
  y1 += span * 0.12;
  const X = (x: number) => pad.l + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const Y = (y: number) => pad.t + (1 - (y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const pts = points.map((p) => [X(p.x), Y(p.y)] as const);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const cx = (ax + bx) / 2;
    d += ` C${cx},${ay} ${cx},${by} ${bx},${by}`;
  }
  const area = `${d} L${pts[pts.length - 1][0]},${H - pad.b} L${pts[0][0]},${H - pad.b} Z`;
  const h = hover != null ? points[hover] : points[points.length - 1];
  const hp = hover != null ? pts[hover] : pts[pts.length - 1];
  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        style={{ height }}
        preserveAspectRatio="none"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          pts.forEach((p, i) => {
            if (Math.abs(p[0] - x) < Math.abs(pts[best][0] - x)) best = i;
          });
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + f * (H - pad.t - pad.b)} y2={pad.t + f * (H - pad.t - pad.b)} stroke="rgba(255,255,255,0.05)" />
        ))}
        <path d={area} fill={`url(#${id}f)`} />
        <path d={d} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <line x1={hp[0]} x2={hp[0]} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div
        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black"
        style={{ left: `${(hp[0] / W) * 100}%`, top: hp[1] * (height / H), background: color, boxShadow: `0 0 12px ${color}` }}
      />
      <div className="mt-1 flex justify-between text-[11px] text-dim">
        <span>{xLabel ? xLabel(points[0].x) : ""}</span>
        <span className="tabular font-semibold text-ink">
          {format(h.y)}
          {xLabel ? <span className="font-normal text-dim"> · {xLabel(h.x)}</span> : null}
        </span>
        <span>{xLabel ? xLabel(points[points.length - 1].x) : ""}</span>
      </div>
    </div>
  );
}

/** Vertical bars with an optional target line. */
export function Bars({
  data,
  height = 120,
  target,
  color = "#c8ff2e",
  format = (v: number) => String(Math.round(v)),
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  height?: number;
  target?: number;
  color?: string;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, target ?? 0, ...data.map((d) => d.value)) * 1.1;
  return (
    <div>
      <div className="relative flex items-end gap-1.5" style={{ height }}>
        {target ? (
          <div className="absolute inset-x-0 border-t border-dashed border-white/25" style={{ bottom: `${(target / max) * 100}%` }}>
            <span className="absolute -top-4 right-0 text-[10px] text-dim">{format(target)}</span>
          </div>
        ) : null}
        {data.map((d, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t-md transition-[height] duration-700"
              title={`${d.label}: ${format(d.value)}`}
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: d.value > 0 ? 3 : 0,
                background: d.highlight ? color : `${color}66`,
                boxShadow: d.highlight ? `0 0 14px ${color}66` : undefined,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <div key={i} className={`flex-1 text-center text-[10px] ${d.highlight ? "font-bold text-ink" : "text-dim"}`}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Circular progress ring. */
export function Ring({
  value,
  size = 120,
  stroke = 12,
  color = "#c8ff2e",
  track = "rgba(255,255,255,0.07)",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.2,0.9,0.1,1)", filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

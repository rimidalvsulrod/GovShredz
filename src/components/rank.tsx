"use client";
import { useId } from "react";
import clsx from "clsx";
import { rankInfo, type Tier } from "@/shared/ranks";

const OUTER = "M50 3 L93 21 L93 61 C93 84 73 100 50 108 C27 100 7 84 7 61 L7 21 Z";
const INNER = "M50 13 L84 27.5 L84 60.5 C84 78.5 68 91.5 50 98 C32 91.5 16 78.5 16 60.5 L16 27.5 Z";

function Glyph({ tier, color }: { tier: Tier; color: string }) {
  const stroke = { stroke: color, strokeWidth: 6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  switch (tier.id) {
    case "noob":
      return <circle cx="50" cy="55" r="11" {...stroke} />;
    case "rookie":
      return <path d="M33 63 L50 46 L67 63" {...stroke} />;
    case "amateur":
      return <path d="M33 56 L50 40 L67 56 M33 72 L50 56 L67 72" {...stroke} />;
    case "athlete":
      return <path d="M50 35 L55.9 47.9 L70 49.5 L59.5 59 L62.4 73 L50 66 L37.6 73 L40.5 59 L30 49.5 L44.1 47.9 Z" fill={color} />;
    case "pro":
      return <path d="M56 33 L37 60 H50 L45 78 L65 49 H52 Z" fill={color} />;
    case "elite":
      return (
        <g>
          <path d="M50 33 L68 53 L50 77 L32 53 Z" fill={color} />
          <path d="M32 53 H68 M50 33 L43 53 L50 77 L57 53 Z" stroke="rgba(0,0,0,0.35)" strokeWidth="2" fill="none" />
        </g>
      );
    case "olympian":
      return <path d="M31 70 L34 43 L44 55 L50 38 L56 55 L66 43 L69 70 Z" fill={color} stroke={color} strokeWidth="2" strokeLinejoin="round" />;
    default:
      return (
        <path
          d="M50 30 C58 42 68 47 66 62 C65 72 58 78 50 78 C42 78 34 72 34 62 C34 54 39 49 42 44 C43 51 46 54 49 55 C47 46 46 38 50 30 Z"
          fill={color}
        />
      );
  }
}

/** Game-style rank emblem. */
export function RankBadge({ score, size = 64, className, dim }: { score: number; size?: number; className?: string; dim?: boolean }) {
  const r = rankInfo(score);
  const t = r.tier;
  const uid = useId().replace(/:/g, "");
  const legend = t.id === "legend";
  return (
    <div
      className={clsx("relative shrink-0", className)}
      style={{ width: size, height: size * 1.1, filter: dim ? "grayscale(1) opacity(0.35)" : `drop-shadow(0 ${size / 12}px ${size / 5}px ${t.c2}70)` }}
      title={r.name}
    >
      <svg viewBox="0 0 100 110" width={size} height={size * 1.1}>
        <defs>
          <linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={t.c1} />
            <stop offset="1" stopColor={t.c2} />
            {legend && <animate attributeName="x1" values="0;1;0" dur="3s" repeatCount="indefinite" />}
          </linearGradient>
          <radialGradient id={`${uid}r`} cx="0.5" cy="0.35" r="0.75">
            <stop offset="0" stopColor={t.c2} stopOpacity="0.55" />
            <stop offset="1" stopColor="#07070a" stopOpacity="0.95" />
          </radialGradient>
          <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={OUTER} fill={`url(#${uid}g)`} />
        <path d={INNER} fill={`url(#${uid}r)`} />
        <path d={OUTER} fill={`url(#${uid}s)`} opacity="0.35" />
        <Glyph tier={t} color={`url(#${uid}g)`} />
        {r.division > 0 && (
          <g>
            {[0, 1, 2].map((i) => (
              <rect key={i} x={38 + i * 9} y="84" width="6" height="6" rx="1.5" transform={`rotate(45 ${41 + i * 9} 87)`} fill={i < r.division ? t.c1 : "rgba(255,255,255,0.18)"} />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

export function RankChip({ score, className, showSr }: { score: number; className?: string; showSr?: boolean }) {
  const r = rankInfo(score);
  return (
    <span
      className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-bold whitespace-nowrap", r.tier.id === "legend" && "legend-flow", className)}
      style={{
        background: r.tier.id === "legend" ? `linear-gradient(90deg, ${r.tier.c1}33, ${r.tier.c2}33, ${r.tier.c1}33)` : `${r.tier.c2}33`,
        color: r.tier.ink,
        boxShadow: `inset 0 0 0 1px ${r.tier.c2}66`,
      }}
    >
      {r.name}
      {showSr && <span className="tabular opacity-70">{r.sr}</span>}
    </span>
  );
}

export function RankProgress({ score, className, label = true }: { score: number; className?: string; label?: boolean }) {
  const r = rankInfo(score);
  const next = r.nextName ? rankInfo(r.level + 1) : null;
  return (
    <div className={className}>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${r.progress * 100}%`, background: `linear-gradient(90deg, ${r.tier.c2}, ${r.tier.c1})`, boxShadow: `0 0 12px ${r.tier.c1}88` }}
        />
      </div>
      {label && (
        <div className="mt-1.5 flex justify-between text-[12px] text-muted">
          <span style={{ color: r.tier.ink }}>{r.name}</span>
          {next ? (
            <span>
              <span className="tabular text-ink">{Math.max(1, Math.ceil((1 - r.progress) * 100))} SR</span> to <span style={{ color: next.tier.ink }}>{next.name}</span>
            </span>
          ) : (
            <span className="text-warn">Max rank</span>
          )}
        </div>
      )}
    </div>
  );
}

export const tierColor = (score: number) => rankInfo(score).tier.c1;

"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const COLORS = ["#c8ff2e", "#2ee6ff", "#ff4d2e", "#ff3d8b", "#ffd23f", "#ffffff"];

type Piece = { left: number; color: string; delay: number; dx: number; t: number; w: number };

/** A one-shot confetti burst. */
export function Confetti({ count = 70 }: { count?: number }) {
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  useEffect(() => {
    setPieces(
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.5,
        dx: (Math.random() - 0.5) * 200,
        t: 1.8 + Math.random() * 1.6,
        w: 6 + Math.random() * 6,
      })),
    );
    const t = setTimeout(() => setPieces([]), 4000);
    return () => clearTimeout(t);
  }, [count]);
  if (!pieces?.length) return null;
  return createPortal(
    <>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              width: p.w,
              animationDelay: `${p.delay}s`,
              "--dx": `${p.dx}px`,
              "--t": `${p.t}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </>,
    document.body,
  );
}

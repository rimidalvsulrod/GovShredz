"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, Loader2, X } from "lucide-react";
import { useToasts } from "@/client/store";

/* --------------------------------- buttons --------------------------------- */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  block?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, block, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "press inline-flex items-center justify-center gap-2 rounded-2xl font-semibold select-none disabled:opacity-50 disabled:active:scale-100",
        size === "sm" && "h-9 px-3.5 text-[13px]",
        size === "md" && "h-11 px-5 text-[15px]",
        size === "lg" && "h-14 px-6 text-[17px]",
        variant === "primary" && "bg-lime text-black lime-glow",
        variant === "secondary" && "bg-surface-3 text-ink",
        variant === "ghost" && "bg-transparent text-muted hover:text-ink",
        variant === "outline" && "border border-line-2 bg-white/[0.02] text-ink",
        variant === "danger" && "bg-bad/15 text-bad",
        block && "w-full",
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function IconButton({ className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={clsx("press grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-ink", className)} />;
}

/* --------------------------------- inputs ---------------------------------- */

export function Field({ label, hint, children, className }: { label?: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      {label && <span className="mb-1.5 block text-[12px] font-semibold tracking-wide text-muted uppercase">{label}</span>}
      {children}
      {hint && <span className="mt-1.5 block text-[12px] text-dim">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 text-[16px] text-ink outline-none transition placeholder:text-dim focus:border-lime/60 focus:bg-surface-3";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(inputCls, "h-auto min-h-24 py-3", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(inputCls, "appearance-none", props.className)} />;
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={clsx("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40", on ? "bg-lime" : "bg-surface-3")}
    >
      <span className={clsx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform", on ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: React.ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={clsx("flex rounded-2xl border border-line bg-surface p-1", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={clsx(
            "flex-1 rounded-xl font-semibold whitespace-nowrap transition-all",
            size === "md" ? "h-9 px-2 text-[13px]" : "h-8 px-2 text-[12px]",
            value === o.id ? "bg-surface-3 text-ink shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: React.ReactNode }[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={clsx(
            "press h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold",
            value === o.id ? "border-lime bg-lime text-black" : "border-line bg-surface text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- layout ---------------------------------- */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={clsx("card p-4", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("mb-2.5 mt-7 flex items-end justify-between px-1", className)}>
      <h2 className="font-display text-[20px] font-extrabold uppercase italic">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, back, right }: { title: React.ReactNode; subtitle?: React.ReactNode; back?: string | boolean; right?: React.ReactNode }) {
  return (
    <header className="pt-safe mb-4 flex items-center gap-3">
      {back && (
        <Link href={typeof back === "string" ? back : "/home"} onClick={(e) => { if (back === true) { e.preventDefault(); history.back(); } }} className="press -ml-1 grid h-10 w-10 place-items-center rounded-full bg-white/[0.06]">
          <ChevronLeft className="h-5 w-5" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="font-display truncate text-[32px] leading-none font-black uppercase italic">{title}</h1>
        {subtitle && <p className="mt-1 truncate text-[13px] text-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string }) {
  return (
    <div className="card p-3.5">
      <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</div>
      <div className="font-display tabular mt-1 text-[26px] leading-none font-extrabold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[12px] text-dim">{sub}</div>}
    </div>
  );
}

export function Progress({ value, color = "var(--color-lime)", className, height = 8 }: { value: number; color?: string; className?: string; height?: number }) {
  return (
    <div className={clsx("overflow-hidden rounded-full bg-white/[0.07]", className)} style={{ height }}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-dim [&_svg]:h-9 [&_svg]:w-9">{icon}</div>}
      <div className="text-[16px] font-semibold">{title}</div>
      {children && <div className="mt-1.5 text-[14px] text-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("h-5 w-5 animate-spin text-muted", className)} />;
}

export function Avatar({ name, color, size = 40, className }: { name: string; color: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={clsx("font-display grid shrink-0 place-items-center rounded-full font-black text-black italic", className)}
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, ${color}, ${color}99)` }}
    >
      {initials || "?"}
    </span>
  );
}

/* ---------------------------------- sheet ---------------------------------- */

export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; tall?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fade-in absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={clsx(
          "sheet-up relative flex w-full max-w-[520px] flex-col rounded-t-[28px] border-t border-line-2 bg-surface",
          tall ? "h-[92dvh]" : "max-h-[92dvh]",
        )}
      >
        <div className="flex items-center gap-3 px-5 pt-3 pb-2">
          <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20" />
          <div className="font-display mt-2 min-w-0 flex-1 truncate text-[22px] font-extrabold uppercase italic">{title}</div>
          <button onClick={onClose} className="press mt-2 grid h-9 w-9 place-items-center rounded-full bg-white/[0.07]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(max(var(--sab),12px)+16px)]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* --------------------------------- toaster --------------------------------- */

export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col items-center gap-2 px-4 pt-[calc(max(var(--sat),12px)+4px)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "rise glass pointer-events-auto max-w-[440px] rounded-2xl border px-4 py-3 text-[14px] font-semibold shadow-2xl",
            t.kind === "error" ? "border-bad/40 text-bad" : t.kind === "info" ? "border-line-2 text-ink" : "border-lime/40 text-lime",
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Badge({ children, color = "#c8ff2e", className }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", className)} style={{ background: `${color}22`, color }}>
      {children}
    </span>
  );
}

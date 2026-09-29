"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Dumbbell, Flame, House, ScanLine, Users } from "lucide-react";

const ITEMS = [
  { href: "/home", label: "Home", icon: House, match: ["/home", "/ranks", "/u/", "/settings", "/versus"] },
  { href: "/fuel", label: "Fuel", icon: Flame, match: ["/fuel"] },
  { href: "/train", label: "Train", icon: Dumbbell, match: ["/train"], center: true },
  { href: "/body", label: "Body", icon: ScanLine, match: ["/body"] },
  { href: "/squad", label: "Squad", icon: Users, match: ["/squad", "/challenge"] },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[max(var(--sab),10px)]">
      <div className="mx-auto flex max-w-[520px] items-end justify-around px-2 pt-2">
        {ITEMS.map((it) => {
          const active = it.match.some((m) => path === m || path.startsWith(m.endsWith("/") ? m : `${m}/`) || path === m);
          const Icon = it.icon;
          if (it.center)
            return (
              <Link key={it.href} href={it.href} className="press -mt-7 flex flex-col items-center gap-1" aria-label={it.label}>
                <span
                  className={clsx(
                    "grid h-[60px] w-[60px] place-items-center rounded-[22px] border-4 border-bg text-black",
                    active ? "bg-lime lime-glow" : "bg-lime/90",
                  )}
                >
                  <Icon className="h-7 w-7" strokeWidth={2.4} />
                </span>
                <span className={clsx("text-[11px] font-semibold", active ? "text-lime" : "text-muted")}>{it.label}</span>
              </Link>
            );
          return (
            <Link key={it.href} href={it.href} className="press flex w-16 flex-col items-center gap-1 py-1" aria-label={it.label}>
              <Icon className={clsx("h-6 w-6", active ? "text-lime" : "text-muted")} strokeWidth={active ? 2.4 : 2} />
              <span className={clsx("text-[11px] font-semibold", active ? "text-ink" : "text-muted")}>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

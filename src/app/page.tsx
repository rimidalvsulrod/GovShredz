import Link from "next/link";
import { redirect } from "next/navigation";
import { Dumbbell, Flame, ScanLine, Swords, Trophy, Users } from "lucide-react";
import { currentUserRow } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { RankBadge } from "@/components/rank";
import { TIERS } from "@/shared/ranks";

const FEATURES = [
  { icon: Trophy, title: "Ranks for every lift", body: "Noob → Rookie → Amateur → Athlete → Pro → Elite → Olympian → Legend. Scored against your bodyweight." },
  { icon: Dumbbell, title: "Fast workout logger", body: "Sets, reps, rest timer, PR detection and live rank previews on every set." },
  { icon: Flame, title: "Meal tracking", body: "Calories and macros with targets built from your body and goal." },
  { icon: ScanLine, title: "3D physique sim", body: "Scan a photo, get a spinning 3D model — and see what you'll look like in 12 weeks." },
  { icon: Swords, title: "Battle your squad", body: "Head-to-head comparisons, challenges with stakes, leaderboards." },
  { icon: Users, title: "Locker room", body: "Follow players, drop 🔥 props on workouts and talk trash in the group chat." },
];

export default async function Landing() {
  const u = await currentUserRow().catch(() => null);
  if (u) redirect(!u.email_verified_at ? "/verify" : "/home");
  return (
    <main className="pt-safe mx-auto w-full max-w-[520px] px-5 pb-16">
      <div className="mt-5 flex items-center justify-between">
        <Logo size={32} />
        <Link href="/login" className="press rounded-full border border-line-2 px-4 py-2 text-[14px] font-semibold">
          Sign in
        </Link>
      </div>

      <section className="rise mt-14">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-[12px] font-bold tracking-wider text-lime uppercase">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime" /> Season 1 is live
        </div>
        <h1 className="font-display text-[68px] leading-[0.86] font-black uppercase italic">
          Lift.
          <br />
          Rank up.
          <br />
          <span className="text-gradient">Get shredded.</span>
        </h1>
        <p className="mt-5 max-w-[400px] text-[17px] leading-relaxed text-muted">
          Every set you log earns you a rank. Compete with your squad, track your meals, and watch your future physique in 3D.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/signup" className="press lime-glow flex h-14 flex-1 items-center justify-center rounded-2xl bg-lime text-[17px] font-bold text-black">
            Join the squad
          </Link>
          <Link href="/login" className="press flex h-14 items-center justify-center rounded-2xl border border-line-2 px-6 text-[17px] font-semibold">
            Sign in
          </Link>
        </div>
      </section>

      <section className="mt-14">
        <div className="card overflow-hidden p-5">
          <div className="text-[12px] font-bold tracking-widest text-muted uppercase">The ladder</div>
          <div className="no-scrollbar -mx-5 mt-4 flex gap-4 overflow-x-auto px-5 pb-2">
            {TIERS.map((t, i) => (
              <div key={t.id} className="flex shrink-0 flex-col items-center gap-2">
                <RankBadge score={i * 3 + 2.5} size={58} />
                <span className="text-[12px] font-bold" style={{ color: t.ink }}>
                  {t.name}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-muted">3 divisions per tier (Noob, Noob 2, Noob 3…). Legend is the top.</p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-4">
            <f.icon className="h-6 w-6 text-lime" />
            <div className="mt-3 text-[15px] font-bold">{f.title}</div>
            <div className="mt-1 text-[13px] leading-snug text-muted">{f.body}</div>
          </div>
        ))}
      </section>

      <p className="mt-10 text-center text-[12px] text-dim">Add GovShredz to your Home Screen for the full-screen app experience.</p>
    </main>
  );
}

import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center px-6 text-center">
      <Logo size={30} />
      <h1 className="font-display mt-8 text-[64px] leading-none font-black italic">404</h1>
      <p className="mt-2 text-muted">This page skipped leg day. It doesn&apos;t exist.</p>
      <Link href="/home" className="press lime-glow mt-6 rounded-2xl bg-lime px-6 py-3 font-bold text-black">
        Back to the gym
      </Link>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { currentUserRow, isOwner, publicMe } from "@/lib/auth";
import { MeProvider } from "@/client/me";
import { LogoMark } from "@/components/logo";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

// Only the owner account (verified vladimirdorlus08@gmail.com) ever sees this; everyone else gets a 404.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const u = await currentUserRow();
  if (!u || !isOwner(u)) notFound();
  return (
    <MeProvider initial={publicMe(u)}>
      <div className="pt-safe mx-auto w-full max-w-[1100px] px-4 pb-16">
        <header className="mt-2 mb-5 flex items-center gap-3">
          <Link href="/home" className="press grid h-10 w-10 place-items-center rounded-full bg-white/[0.06]" aria-label="Back to app">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <LogoMark size={34} />
          <div className="flex-1">
            <div className="font-display text-[26px] leading-none font-black uppercase italic">Command center</div>
            <div className="text-[12px] text-muted">GovShredz admin · {u.email}</div>
          </div>
        </header>
        {children}
      </div>
    </MeProvider>
  );
}

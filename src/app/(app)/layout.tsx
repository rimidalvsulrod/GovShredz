import { redirect } from "next/navigation";
import { currentUserRow, publicMe } from "@/lib/auth";
import { MeProvider } from "@/client/me";
import { BottomNav } from "@/components/nav";
import { Logo } from "@/components/logo";
import { SignOutButton } from "./sign-out";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const u = await currentUserRow();
  if (!u) redirect("/login");
  if (!u.email_verified_at) redirect("/verify");
  if (u.banned)
    return (
      <main className="pt-safe mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center px-6 text-center">
        <Logo size={32} />
        <h1 className="font-display mt-8 text-[36px] font-black uppercase italic">Account suspended</h1>
        <p className="mt-2 text-muted">This account has been suspended by the admin.</p>
        <SignOutButton />
      </main>
    );
  if (!u.onboarded) redirect("/welcome");
  return (
    <MeProvider initial={publicMe(u)}>
      <div className="pb-nav mx-auto w-full max-w-[520px] px-4">{children}</div>
      <BottomNav />
    </MeProvider>
  );
}

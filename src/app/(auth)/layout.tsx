import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="pt-safe mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pb-10">
      <Link href="/" className="mt-6 mb-10 self-start">
        <Logo size={34} />
      </Link>
      <div className="rise">{children}</div>
    </main>
  );
}

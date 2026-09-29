import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUserRow } from "@/lib/auth";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const u = await currentUserRow().catch(() => null);
  if (u) redirect(!u.email_verified_at ? "/verify" : "/home");
  return <LoginForm />;
}

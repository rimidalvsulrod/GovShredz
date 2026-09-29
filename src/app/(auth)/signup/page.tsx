import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUserRow } from "@/lib/auth";
import { SignupForm } from "../auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  const u = await currentUserRow().catch(() => null);
  if (u) redirect(!u.email_verified_at ? "/verify" : "/home");
  return <SignupForm />;
}

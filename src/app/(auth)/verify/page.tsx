import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUserRow } from "@/lib/auth";
import { VerifyForm } from "../auth-forms";

export const metadata: Metadata = { title: "Confirm email" };

export default async function VerifyPage() {
  const u = await currentUserRow();
  if (!u) redirect("/login");
  if (u.email_verified_at) redirect(u.onboarded ? "/home" : "/welcome");
  return <VerifyForm email={u.email} />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUserRow, publicMe } from "@/lib/auth";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const u = await currentUserRow();
  if (!u) redirect("/login");
  if (!u.email_verified_at) redirect("/verify");
  return <Onboarding me={publicMe(u)} />;
}

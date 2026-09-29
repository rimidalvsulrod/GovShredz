"use client";
import { api, hardNav } from "@/client/api";
import { Button } from "@/components/ui";

export function SignOutButton() {
  return (
    <Button
      variant="secondary"
      className="mt-8"
      onClick={async () => {
        await api("/api/auth/logout", { body: {} }).catch(() => {});
        hardNav("/login");
      }}
    >
      Sign out
    </Button>
  );
}

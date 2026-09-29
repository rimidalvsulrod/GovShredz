"use client";
import { createContext, useCallback, useContext, useState } from "react";
import type { Me } from "@/lib/auth";
import { api } from "./api";

type Ctx = { me: Me; setMe: (m: Me) => void; refresh: () => Promise<void> };
const MeContext = createContext<Ctx | null>(null);

export function MeProvider({ initial, children }: { initial: Me; children: React.ReactNode }) {
  const [me, setMe] = useState(initial);
  const refresh = useCallback(async () => {
    const r = await api<{ user: Me }>("/api/me");
    setMe(r.user);
  }, []);
  return <MeContext.Provider value={{ me, setMe, refresh }}>{children}</MeContext.Provider>;
}

export function useMe() {
  const c = useContext(MeContext);
  if (!c) throw new Error("useMe outside MeProvider");
  return c;
}

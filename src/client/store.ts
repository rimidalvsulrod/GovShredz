"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api } from "./api";

/* ------------------------------- data cache -------------------------------- */
// Tiny stale-while-revalidate cache: pages render cached data instantly, then refresh.

type Entry = { data?: unknown; error?: Error; loading: boolean; at: number };
const cache = new Map<string, Entry>();
const subs = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<unknown>>();

function emit(key: string) {
  subs.get(key)?.forEach((f) => f());
}

function set(key: string, patch: Partial<Entry>) {
  cache.set(key, { ...(cache.get(key) ?? { loading: false, at: 0 }), ...patch });
  emit(key);
}

export function mutate<T>(key: string, data: T | ((old: T | undefined) => T)) {
  const old = cache.get(key)?.data as T | undefined;
  set(key, { data: typeof data === "function" ? (data as (o: T | undefined) => T)(old) : data, at: Date.now() });
}

/** Drop cached data for keys starting with any prefix, so the next view refetches. */
export function invalidate(...prefixes: string[]) {
  for (const k of [...cache.keys()]) if (prefixes.some((p) => k.startsWith(p))) cache.set(k, { ...cache.get(k)!, at: 0 });
  for (const k of [...subs.keys()]) if (prefixes.some((p) => k.startsWith(p))) void load(k, api, true);
}

async function load(key: string, fetcher: (key: string) => Promise<unknown>, force = false) {
  const e = cache.get(key);
  if (!force && e && Date.now() - e.at < 2000) return;
  if (inflight.has(key)) return inflight.get(key);
  set(key, { loading: true });
  const p = fetcher(key)
    .then((data) => set(key, { data, error: undefined, loading: false, at: Date.now() }))
    .catch((error: Error) => set(key, { error, loading: false }))
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

const EMPTY: Entry = { loading: true, at: 0 };

/** Fetch JSON from an API path (the key) with caching. Pass null to skip. */
export function useData<T>(key: string | null, fetcher?: () => Promise<T>) {
  const fetchRef = useRef(fetcher);
  useEffect(() => {
    fetchRef.current = fetcher;
  });
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!key) return () => {};
      let s = subs.get(key);
      if (!s) subs.set(key, (s = new Set()));
      s.add(cb);
      return () => {
        s!.delete(cb);
      };
    },
    [key],
  );
  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? (cache.get(key) ?? EMPTY) : EMPTY),
    () => EMPTY,
  );
  const run = useCallback(
    (force = false) => (key ? load(key, () => (fetchRef.current ? fetchRef.current() : api(key)), force) : Promise.resolve()),
    [key],
  );
  useEffect(() => {
    void run(true);
  }, [run]);
  return {
    data: entry.data as T | undefined,
    error: entry.error,
    loading: entry.loading && entry.data === undefined,
    reload: () => run(true),
    mutate: (d: T | ((old: T | undefined) => T)) => key && mutate(key, d),
  };
}

/* --------------------------------- toasts ---------------------------------- */

export type Toast = { id: number; text: string; kind: "ok" | "error" | "info" };
let toasts: Toast[] = [];
const toastSubs = new Set<() => void>();
let nextId = 1;

export function toast(text: string, kind: Toast["kind"] = "ok") {
  const t = { id: nextId++, text, kind };
  toasts = [...toasts, t];
  toastSubs.forEach((f) => f());
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastSubs.forEach((f) => f());
  }, 3200);
}

export const fail = (e: unknown) => toast(e instanceof Error ? e.message : "Something went wrong.", "error");

export function useToasts() {
  return useSyncExternalStore(
    (cb) => {
      toastSubs.add(cb);
      return () => toastSubs.delete(cb);
    },
    () => toasts,
    () => toasts,
  );
}

/* ------------------------------ local storage ------------------------------ */

export function useLocal<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setV(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v, ready]);
  return [v, setV, ready] as const;
}

export function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

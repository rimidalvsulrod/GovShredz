"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-[40px] leading-none font-black uppercase italic">Something broke</h1>
      <p className="mt-2 text-[14px] text-muted">{error.message || "Unexpected error."}</p>
      <button onClick={reset} className="press lime-glow mt-6 rounded-2xl bg-lime px-6 py-3 font-bold text-black">
        Try again
      </button>
    </main>
  );
}

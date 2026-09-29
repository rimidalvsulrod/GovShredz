"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, hardNav } from "@/client/api";
import { fail, toast } from "@/client/store";
import { Button, Field, Input } from "@/components/ui";
import type { Me } from "@/lib/auth";

const next = (u: Me) => (!u.verified ? "/verify" : !u.onboarded ? "/welcome" : "/home");

function Title({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="font-display text-[44px] leading-[0.95] font-black uppercase italic">{children}</h1>
      {sub && <p className="mt-2 text-[15px] text-muted">{sub}</p>}
    </div>
  );
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api<{ user: Me }>("/api/auth/login", { body: { email, password } });
          hardNav(next(r.user));
        } catch (err) {
          fail(err);
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      <Title sub="Welcome back. Time to put in work.">Sign in</Title>
      <Field label="Email or username">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" required />
      </Field>
      <Field label="Password">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" block loading={busy}>
        Sign in
      </Button>
      <div className="flex justify-between pt-2 text-[14px]">
        <Link href="/forgot" className="text-muted">
          Forgot password?
        </Link>
        <Link href="/signup" className="font-semibold text-lime">
          Create account
        </Link>
      </div>
    </form>
  );
}

export function SignupForm() {
  const [f, setF] = useState({ name: "", username: "", email: "", password: "", invite: "" });
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState<string>("open");
  useEffect(() => {
    api<{ registration: string }>("/api/auth/config").then((r) => setRegistration(r.registration), () => {});
  }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api<{ user: Me; emailSent: boolean }>("/api/auth/signup", { body: { ...f, invite: f.invite || undefined } });
          if (!r.emailSent) toast("Account created, but the email didn't send. Tap Resend on the next screen.", "error");
          hardNav(next(r.user));
        } catch (err) {
          fail(err);
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      <Title sub="Join the squad. Every rep counts toward your rank.">Create account</Title>
      {registration === "closed" && <div className="rounded-2xl border border-warn/30 bg-warn/10 p-3 text-[14px] text-warn">Sign-ups are closed right now.</div>}
      <Field label="Name">
        <Input value={f.name} onChange={set("name")} autoComplete="name" required maxLength={60} />
      </Field>
      <Field label="Username" hint="3–20 letters, numbers or _ · this is how the squad finds you">
        <Input
          value={f.username}
          onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
          autoCapitalize="none"
          required
          minLength={3}
          maxLength={20}
        />
      </Field>
      <Field label="Email">
        <Input type="email" value={f.email} onChange={set("email")} autoComplete="email" autoCapitalize="none" required />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <Input type="password" value={f.password} onChange={set("password")} autoComplete="new-password" required minLength={8} />
      </Field>
      {registration === "invite" && (
        <Field label="Invite code">
          <Input value={f.invite} onChange={set("invite")} autoCapitalize="none" required />
        </Field>
      )}
      <Button type="submit" size="lg" block loading={busy} disabled={registration === "closed"}>
        Create account
      </Button>
      <p className="text-[12px] leading-relaxed text-dim">
        We&apos;ll email you a 6-digit code to confirm it&apos;s you. The admin can see account activity (workouts, meals, sign-in IP addresses) to keep the app running
        smoothly. Body-scan photos never leave your phone.
      </p>
      <p className="pt-1 text-center text-[14px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-lime">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        className="absolute inset-0 opacity-0"
        aria-label="6-digit code"
      />
      <div className="flex justify-between gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className={`font-display grid h-16 flex-1 place-items-center rounded-2xl border text-[32px] font-black ${
              i === value.length ? "border-lime bg-surface-3" : "border-line bg-surface-2"
            } ${value[i] ? "text-lime" : ""}`}
          >
            {value[i] ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export function VerifyForm({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const submit = async (c: string) => {
    setBusy(true);
    try {
      const r = await api<{ user: Me }>("/api/auth/verify", { body: { code: c } });
      toast("Email confirmed 💪");
      hardNav(next(r.user));
    } catch (err) {
      fail(err);
      setCode("");
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <Title sub={<>We sent a 6-digit code to <span className="text-ink">{email}</span>.</>}>Check your email</Title>
      <CodeInput
        value={code}
        onChange={(v) => {
          setCode(v);
          if (v.length === 6) void submit(v);
        }}
      />
      <Button size="lg" block loading={busy} disabled={code.length !== 6} onClick={() => submit(code)}>
        Confirm
      </Button>
      <div className="flex justify-between text-[14px]">
        <button
          className="text-muted disabled:opacity-50"
          disabled={sending}
          onClick={async () => {
            setSending(true);
            try {
              await api("/api/auth/resend", { body: {} });
              toast("New code sent");
            } catch (err) {
              fail(err);
            }
            setSending(false);
          }}
        >
          Resend code
        </button>
        <button
          className="text-muted"
          onClick={async () => {
            await api("/api/auth/logout", { body: {} }).catch(() => {});
            hardNav("/login");
          }}
        >
          Use another account
        </button>
      </div>
    </div>
  );
}

export function ForgotForm() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  if (step === "email")
    return (
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/api/auth/forgot", { body: { email } });
            setStep("code");
          } catch (err) {
            fail(err);
          }
          setBusy(false);
        }}
      >
        <Title sub="We'll email you a code to set a new password.">Reset password</Title>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" required />
        </Field>
        <Button type="submit" size="lg" block loading={busy}>
          Send code
        </Button>
        <Link href="/login" className="block pt-2 text-center text-[14px] text-muted">
          Back to sign in
        </Link>
      </form>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api<{ user: Me }>("/api/auth/reset", { body: { email, code, password } });
          toast("Password updated");
          hardNav(next(r.user));
        } catch (err) {
          fail(err);
          setBusy(false);
        }
      }}
    >
      <Title sub={<>If <span className="text-ink">{email}</span> has an account, a code is on its way.</>}>Enter code</Title>
      <CodeInput value={code} onChange={setCode} />
      <Field label="New password" hint="At least 8 characters">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
      </Field>
      <Button type="submit" size="lg" block loading={busy} disabled={code.length !== 6}>
        Set new password
      </Button>
    </form>
  );
}

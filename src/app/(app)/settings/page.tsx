"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, MessageCircle, Send, Shield } from "lucide-react";
import { api, hardNav } from "@/client/api";
import { useMe } from "@/client/me";
import { fail, invalidate, toast, useData } from "@/client/store";
import { Avatar, Button, Card, Field, Input, PageHeader, SectionTitle, Segmented, Textarea, Toggle } from "@/components/ui";
import { HeightInput, WeightInput } from "@/components/body-inputs";
import { GOALS, type Goal } from "@/shared/physique";
import { ago, dayKey, type Unit } from "@/shared/units";
import type { Sex } from "@/shared/ranks";
import type { Me } from "@/lib/auth";

const COLORS = ["#c8ff2e", "#2ee6ff", "#ff4d2e", "#b36bff", "#ffd23f", "#ff5ea8", "#3dffa2", "#ffffff"];

export default function SettingsPage() {
  const { me, setMe } = useMe();
  const save = async (patch: Record<string, unknown>, msg = "Saved") => {
    try {
      const r = await api<{ user: Me }>("/api/me", { method: "PATCH", body: patch });
      setMe(r.user);
      invalidate("/api/");
      toast(msg);
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  return (
    <div className="rise">
      <PageHeader title="Settings" back="/home" right={me.isAdmin ? <Link href="/admin" className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-lime/15 px-3.5 text-[13px] font-bold text-lime"><Shield className="h-4 w-4" /> Admin</Link> : undefined} />
      <ProfileSection save={save} />
      <BodySection save={save} />
      <TargetsSection save={save} />

      <SectionTitle>Privacy</SectionTitle>
      <Card className="divide-y divide-line p-0">
        <div className="flex items-center gap-3 p-4">
          <div className="flex-1">
            <div className="font-semibold">Public workouts</div>
            <div className="text-[12px] text-muted">Squad can see your workouts in the feed and on your profile.</div>
          </div>
          <Toggle on={me.publicWorkouts} onChange={(v) => save({ publicWorkouts: v })} />
        </div>
        <div className="flex items-center gap-3 p-4">
          <div className="flex-1">
            <div className="font-semibold">Share physique</div>
            <div className="text-[12px] text-muted">Show your 3D model, weight & body fat on your profile.</div>
          </div>
          <Toggle on={me.sharePhysique} onChange={(v) => save({ sharePhysique: v })} />
        </div>
      </Card>
      <p className="mt-2 px-1 text-[12px] text-dim">Ranks are always public so leaderboards work. Meals are only visible to you (and the admin).</p>

      <SupportSection />
      <PasswordSection />

      <SectionTitle>Account</SectionTitle>
      <Card className="space-y-3">
        <div className="text-[13px] text-muted">
          Signed in as <span className="text-ink">{me.email}</span>
        </div>
        <Button
          variant="secondary"
          block
          onClick={async () => {
            await api("/api/auth/logout", { body: {} }).catch(() => {});
            hardNav("/login");
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
        <DeleteAccount />
      </Card>
      <p className="mt-6 text-center text-[12px] text-dim">GovShredz · add to your Home Screen for the app experience</p>
    </div>
  );
}

type Save = (patch: Record<string, unknown>, msg?: string) => Promise<boolean>;

function ProfileSection({ save }: { save: Save }) {
  const { me } = useMe();
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio);
  const [busy, setBusy] = useState(false);
  const dirty = name !== me.name || username !== me.username || bio !== me.bio;
  return (
    <>
      <SectionTitle>Profile</SectionTitle>
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={name || me.name} color={me.color} size={56} />
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => save({ color: c }, "Color updated")}
                className="press h-8 w-8 rounded-full"
                style={{ background: c, boxShadow: me.color === c ? `0 0 0 3px #060608, 0 0 0 5px ${c}` : undefined }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} maxLength={20} autoCapitalize="none" />
        </Field>
        <Field label="Bio">
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} placeholder="Bulking season. Don't talk to me before coffee." className="min-h-20" />
        </Field>
        <Button
          block
          disabled={!dirty}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await save({ name, username, bio });
            setBusy(false);
          }}
        >
          Save profile
        </Button>
      </Card>
    </>
  );
}

function BodySection({ save }: { save: Save }) {
  const { me } = useMe();
  const [unit, setUnit] = useState<Unit>(me.unit);
  const [sex, setSex] = useState<Sex>(me.sex);
  const [heightCm, setHeight] = useState<number | null>(me.heightCm);
  const [weightKg, setWeight] = useState<number | null>(me.weightKg);
  const [birthYear, setBirthYear] = useState(me.birthYear ? String(me.birthYear) : "");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <SectionTitle>Body</SectionTitle>
      <Card className="space-y-4">
        <Field label="Units">
          <Segmented
            value={unit}
            onChange={(u) => {
              setUnit(u);
              void save({ unit: u }, `Using ${u === "lb" ? "lb & ft" : "kg & cm"}`);
            }}
            options={[{ id: "lb", label: "lb · ft" }, { id: "kg", label: "kg · cm" }]}
          />
        </Field>
        <Field label="Sex (strength standards)">
          <Segmented value={sex} onChange={setSex} options={[{ id: "male", label: "Male" }, { id: "female", label: "Female" }]} />
        </Field>
        <Field label="Height">
          <HeightInput cm={heightCm} unit={unit} onChange={setHeight} />
        </Field>
        <Field label="Bodyweight" hint="Logged to today's weigh-in. New sets are ranked against this.">
          <WeightInput kg={weightKg} unit={unit} onChange={setWeight} />
        </Field>
        <Field label="Birth year">
          <Input inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </Field>
        <Button
          block
          loading={busy}
          disabled={!heightCm || !weightKg}
          onClick={async () => {
            setBusy(true);
            await save({ sex, heightCm, weightKg, birthYear: Number(birthYear) || null, day: dayKey() });
            setBusy(false);
          }}
        >
          Save body stats
        </Button>
      </Card>
    </>
  );
}

function TargetsSection({ save }: { save: Save }) {
  const { me } = useMe();
  const [goal, setGoal] = useState<Goal>(me.goal);
  const [kcal, setKcal] = useState(me.kcalTarget ? String(me.kcalTarget) : "");
  const [protein, setProtein] = useState(me.proteinTarget ? String(me.proteinTarget) : "");
  const [busy, setBusy] = useState(false);
  const { data } = useData<{ targets: { kcal: number; protein: number; maintenance: number } }>(`/api/meals?day=${dayKey()}`);
  return (
    <div id="targets">
      <SectionTitle>Nutrition targets</SectionTitle>
      <Card className="space-y-4">
        <Field label="Goal">
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`press rounded-2xl border p-3 text-left ${goal === g.id ? "border-lime bg-lime/10" : "border-line bg-surface-2"}`}
              >
                <div className={`text-[14px] font-bold ${goal === g.id ? "text-lime" : ""}`}>{g.name}</div>
                <div className="text-[11px] text-muted">{g.blurb}</div>
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Calories" hint={data ? `Auto: ${data.targets.kcal}` : undefined}>
            <Input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, ""))} placeholder="Auto" />
          </Field>
          <Field label="Protein (g)" hint={data ? `Auto: ${data.targets.protein}` : undefined}>
            <Input inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value.replace(/\D/g, ""))} placeholder="Auto" />
          </Field>
        </div>
        {data && <p className="text-[12px] text-muted">Estimated maintenance: ~{data.targets.maintenance} kcal/day (from your stats and training frequency).</p>}
        <Button
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await save({ goal, kcalTarget: kcal ? Number(kcal) : null, proteinTarget: protein ? Number(protein) : null });
            setBusy(false);
          }}
        >
          Save targets
        </Button>
      </Card>
    </div>
  );
}

type SupportMsg = { id: number; fromAdmin: boolean; body: string; createdAt: string };

function SupportSection() {
  const { data, mutate } = useData<{ messages: SupportMsg[] }>("/api/support");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (location.hash === "#support") end.current?.scrollIntoView({ block: "center" });
  }, [data]);
  return (
    <div id="support">
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <MessageCircle className="h-5 w-5" /> Message the admin
        </span>
      </SectionTitle>
      <Card>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {data?.messages.length ? (
            data.messages.map((m) => (
              <div key={m.id} className={`flex ${m.fromAdmin ? "" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] whitespace-pre-wrap ${m.fromAdmin ? "rounded-bl-md bg-surface-3" : "rounded-br-md bg-lime text-black"}`}>
                  {m.fromAdmin && <div className="mb-0.5 text-[10px] font-bold text-lime">ADMIN</div>}
                  {m.body}
                  <div className={`mt-0.5 text-[10px] ${m.fromAdmin ? "text-dim" : "text-black/50"}`}>{ago(m.createdAt)}</div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-muted">Bug, idea, or need your account fixed? Send a message — the admin gets an email.</p>
          )}
          <div ref={end} />
        </div>
        <div className="mt-3 flex items-end gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" className="min-h-12 flex-1" maxLength={2000} rows={2} />
          <Button
            className="h-12 w-12 px-0"
            loading={busy}
            disabled={!text.trim()}
            aria-label="Send"
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ message: SupportMsg }>("/api/support", { body: { body: text } });
                mutate((old) => ({ messages: [...(old?.messages ?? []), r.message] }));
                setText("");
                toast("Sent");
              } catch (e) {
                fail(e);
              }
              setBusy(false);
            }}
          >
            {!busy && <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <SectionTitle>Password</SectionTitle>
      <Card className="space-y-3">
        <Field label="Current password">
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="New password" hint="At least 8 characters. Signs out your other devices.">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <Button
          block
          variant="secondary"
          loading={busy}
          disabled={!current || next.length < 8}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/api/auth/password", { body: { current, password: next } });
              toast("Password changed");
              setCurrent("");
              setNext("");
            } catch (e) {
              fail(e);
            }
            setBusy(false);
          }}
        >
          Change password
        </Button>
      </Card>
    </>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <Button variant="danger" block onClick={() => setOpen(true)}>
        Delete account
      </Button>
    );
  return (
    <div className="space-y-2 rounded-2xl border border-bad/30 bg-bad/5 p-3">
      <div className="text-[13px] text-bad">This permanently deletes your account, workouts, meals and scans.</div>
      <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter your password to confirm" />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          loading={busy}
          disabled={!pw}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/api/auth/delete", { body: { password: pw } });
              hardNav("/");
            } catch (e) {
              fail(e);
              setBusy(false);
            }
          }}
        >
          Delete forever
        </Button>
      </div>
    </div>
  );
}

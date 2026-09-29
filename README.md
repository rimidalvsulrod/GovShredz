# GovShredz

Gamified workout tracker for a small squad: Liftoff-style ranks (Noob → Legend), workout + meal logging, multiplayer (follow, leaderboards, challenges, chat), a 3D physique simulator, and an owner-only admin panel.

**Stack:** Next.js 16 · Tailwind 4 · Neon Postgres · JWT sessions · Resend email · three.js + MediaPipe (on-device photo scan)

## Environment variables (Vercel)

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (Vercel Neon integration sets it). Tables are created automatically. |
| `RESEND_API_KEY` | Sends the 6-digit verification / reset emails (or paste it in Admin → Settings). |
| `AUTH_SECRET` | Optional. Session signing secret (defaults to one derived from `DATABASE_URL`). |
| `EMAIL_FROM` | Optional. Defaults to `GovShredz <govshredz@neqodigital.com>` — the domain must be verified in Resend. |

The admin panel (`/admin`) is only available to the verified account `vladimirdorlus08@gmail.com`; everyone else gets a 404.

## Local dev

```bash
npm install
npm run dev   # embedded Postgres in .data/, emails print to the console
```

# Mentorly — Next.js app

A Next.js (App Router) port of the Mentorly frontend. The original React +
Vite app lives in the parent folder (`../`, port **:8080**) and is untouched
by this port — both apps talk to the same backend and can run side by side.

## Ports

| App | Port | Folder |
|-----|------|--------|
| Backend (Express + Socket.IO) | `:3000` | `../backend` |
| React app (Vite, original) | `:8080` | `..` |
| Next.js app (this folder) | `:8081` | `.` |

Run the frontend and backend in **separate terminals** — never a combined
script (Somesh's rule). The backend must be running before either frontend
is useful (auth, `/me`, and all data go through it).

## Status (2026-11-17 — port complete)

All 73 routes ported and independently verified: 72 `page.tsx` files +
`not-found.tsx` + the `/app` layout, all components, lib, services, hooks,
types, and styles — every React `src/` file accounted for (122/122), all
imports resolving, React app untouched. First run still needs the env
setup below, a backend restart (CORS), and `npm install` in this folder.
No build has been run yet — the first `npm run dev` is the live check.

## Environment setup

```sh
cp .env.example .env.local
# then fill in the real values in .env.local — never commit it
```

Variable **names** (values are Somesh's own — see where each comes from):

| Variable | Where Somesh gets the value |
|----------|------------------------------|
| `NEXT_PUBLIC_API_URL` | Local default in `.env.example` (`http://localhost:3000/api/v1`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard (same publishable key the React app uses; the React app's `vite.config.js` fallbacks hold the current value) |
| `NEXT_PUBLIC_MSG91_WIDGET_ID` | MSG91 dashboard (currently unused by frontend code — OTP goes through the backend; listed for parity) |
| `NEXT_PUBLIC_MSG91_TOKEN_AUTH` | MSG91 dashboard (same note as above) |

If `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is unset, Clerk fails at startup
with a clear error. There is deliberately **no hardcoded key fallback**
in this app — the React app's fallback key was not carried over.

Backend CORS: the backend (`../backend`) allows the frontend origin(s)
from its `FRONTEND_URL` setting (default `http://localhost:8080`). The
default was extended to also allow `http://localhost:8081` on 2026-11-17
(`src/app.ts` + `src/main.ts`, backups kept with suffix
`.pre-nextjs-cors-2026-11-17.bak`). **If `FRONTEND_URL` is set in the
backend's `.env`, the defaults are ignored — add `http://localhost:8081`
to that comma-separated value instead, then restart the backend.**
Backend restart is required after either change.

## Run

Terminal 1 — backend (from `../backend`, MongoDB first per the RUNBOOK):

```sh
docker compose up -d mongodb
npm run server
```

Terminal 2 — Next.js app (from this folder, first time only: `npm install`):

```sh
npm install   # first time only
npm run dev   # http://localhost:8081
```

Build / production preview:

```sh
npm run build
npm run start   # http://localhost:8081
```

Requirements: Node.js 20.9+ (Next.js 16 minimum), npm.

## Conventions for port workers

The binding rules (import mapping, `'use client'` rule, route-file
naming, image rule, env rule, gotchas) plus the full route map and src
inventory live in the VM staging dir — ask the orchestrating agent for:

- `CONVENTIONS.md`, `ROUTE-MAP.md`, `INVENTORY.md` under
  `~/workspace/goals/alumninetwork-monochrome-editorial-redesign/hidden_files/nextjs-build/`

Short version: keep URLs identical, keep logic identical, swap only
import sources (`@clerk/clerk-react` → `@clerk/nextjs`, `react-router-dom`
→ `next/navigation` / `next/link`, shims → real `next/*` modules), keep
plain `<img>`, never copy a key value into any file.

# Mentorly — Runbook (independent frontend & backend)

One terminal per service. Start and stop each on its own — never a combined
"run everything" command. A new terminal never stops a process running in an
old terminal.

> **Backend home (2026-11-12):** `alumninetwork/backend` is now THE running
> backend — an independent copy of the current `mentorconnectlpu/backend`,
> rebranded Mentorly (same routes, workflow and details). `mentorconnectlpu`
> is the untouched original/source. Future backend changes go in
> `alumninetwork/backend` so the two do not silently diverge. Both terminals
> below run inside `alumninetwork`; nothing here mentions `mentorconnectlpu`
> as a run location any more.

| Service | Folder | Port | Start |
|---|---|---|---|
| Backend (API) | `/Users/somesh/Projects/alumniconnect/alumninetwork/backend` | 3000 | `npm run server` |
| Frontend (Vite) | `/Users/somesh/Projects/alumniconnect/alumninetwork` | 8080 | `npm run dev` |
| MongoDB | via Docker, from the alumninetwork folder | 27017 | `docker compose up -d mongodb` |

## Terminal 1 — Backend (start this first)

```bash
cd /Users/somesh/Projects/alumniconnect/alumninetwork
# MongoDB first — the backend exits if it cannot connect (see "If the backend won't start")
docker compose up -d mongodb

cd /Users/somesh/Projects/alumniconnect/alumninetwork/backend
npm run server
```

Expected output:

```text
Server running on http://localhost:3000
```

Health check (new terminal, or after the server is up):

```bash
curl http://localhost:3000/api/v1/health
```

Expect HTTP 200 with `"redis": "healthy (in-memory)"`. Redis is gone — the
backend now uses an in-process store and queue, so there is no Redis to run.
The health response also shows the Mentorly API identity (OpenAPI title
"Mentorly API" at `http://localhost:3000/api`).

First run in the new backend folder, or if `npm run server` complains about
missing modules (the folder was copied without `node_modules` — install once):

```bash
cd /Users/somesh/Projects/alumniconnect/alumninetwork/backend
npm install
npx tsc --noEmit
npm run server
```

## Terminal 2 — Frontend

```bash
cd /Users/somesh/Projects/alumniconnect/alumninetwork
npm run build && npm run dev
```

Expected output: Vite serves on `http://localhost:8080`. Open it in the
browser. The home page loads with the backend down — no crash, no blank
page, no infinite spinner. Data sections show a "server unreachable" message
until the backend is back.

If `npm run dev` fails with `Cannot find module 'three'`, install it once:

```bash
npm install three && npm install -D @types/three
```

Note: the frontend `npm run server` script no longer exists. It used to start
a stale copy of the backend nested under `alumninetwork/backend/` — that copy
is now backed up at `/Users/somesh/Projects/alumniconnect/_archive-2026-11-17/backend.stale-pre-mentorly-2026-11-12.bak`
and `alumninetwork/backend/` itself is the real backend (Terminal 1).

## Stopping

`Ctrl+C` in that service's own terminal. Closing the terminal does the same.

## Port already in use

The usual cause is the service still running in an older terminal. Find and
stop it — do not start a second copy.

```bash
lsof -ti:3000   # backend — then: kill <pid>
lsof -ti:8080   # frontend — then: kill <pid>
lsof -ti:27017  # MongoDB
```

Vite uses `strictPort`, so the frontend will not silently move to another
port — fix the conflict instead.

## If the backend won't start

- **MongoDB is not running:** the server waits ~30s trying to connect and
  then exits. Start it first: `docker compose up -d mongodb` from the
  alumninetwork folder (MongoDB 7, port 27017).
- **Docker daemon is not running:** `docker compose` fails with
  `dial unix /Users/somesh/.docker/run/docker.sock: no such file` — start
  Docker Desktop first, then retry. (The `version is obsolete` warning is
  harmless — ignore it.)
- **Stale install (old `dist` / missing modules):** clean reinstall, then
  typecheck, then start — never delete `.env`:

  ```bash
  cd /Users/somesh/Projects/alumniconnect/alumninetwork/backend
  rm -rf node_modules package-lock.json dist
  npm install
  npx tsc --noEmit
  npm run server
  ```

- **EADDRINUSE on :3000:** something else already holds the port — see
  "Port already in use" above. A common culprit was the old frontend
  `npm run server` starting the stale nested backend; that script is removed.

## Do NOT run these (stale, left over from before)

- `/Users/somesh/Projects/alumniconnect/_archive-2026-11-17/backend.stale-pre-mentorly-2026-11-12.bak/` — the
  pre-Redis-removal duplicate of the backend (still has `bullmq` +
  `ioredis` and points at Upstash). Backup only. Never start it.
- `mentorconnectlpu/backend/` — the untouched original/source copy. Do not
  run it and do not edit it; future backend changes go in
  `alumninetwork/backend`.
- `docker compose up` (the whole file) in alumninetwork — it also starts a
  `redis` service the backend no longer uses and builds the stale nested
  backend. Start only the `mongodb` service, as above.

## Auth checklist (both running)

1. Home page loads at `http://localhost:8080`.
2. **Login** (navbar) and **Get Started** open the iOS-glass auth modal;
   Escape / backdrop / X close it.
3. **Standalone `/login`** shows the same dark frosted-glass card under a
   plain sans "Mentorly" wordmark — no orange, no LPU logo, no
   `@lpu.in` placeholder.
4. **Onboarding** (`/onboarding`) is Mentorly throughout — no LPU labels,
   no orange accents, email placeholder `e.g. yourname@email.com`.
5. **Mock test account** signs in and lands on the admin dashboard.
   Works even with the backend down (offline mode — the dashboard stays
   open; its data sections show "server unreachable" until the backend
   is back).
6. **Clerk sign-in** lands on the correct role dashboard, or on
   `/onboarding` for a new user.
7. Signed in: `GET /me` returns 200. Signed out: it returns 401
   (`{ success: false, error: { ... } }`), not a crash.
8. **Sign out** (header) lands on the home page and does not sign back in
   on its own. (Sign-in state is only created by submitting the auth form.)

## How the pieces talk

- Frontend API base: `http://localhost:3000/api/v1` (override with
  `NEXT_PUBLIC_API_URL` in the frontend `.env` if the backend ever moves).
- Backend CORS allows `http://localhost:8080` (via `FRONTEND_URL`, default
  `http://localhost:8080`) with credentials.
- Auth: Clerk JWT (verified by the backend via JWKS) or the local mock
  token (`mock_token_<email>_role<role>`) — mock sign-in never touches
  the network.

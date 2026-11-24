# Mentorly

> Find the right alumni mentor, request mentorship, and manage the whole journey in one place.

Mentorly connects students with verified alumni mentors. Students discover mentors through AI-assisted matching, send mentorship requests, and collaborate in a shared workspace with sessions, chat, and scheduling. Mentors manage requests and mentees, and administrators verify alumni and keep the platform running.

## Features

### For students

- **AI-assisted mentor discovery** — a deterministic weighted scorer ranks mentors on skills, career goals, expertise, industry, target role, and availability, and a local language model re-ranks the top candidates and explains each match.
- **Mentorship requests** — send a request with a goal and a message; the mentor approves or declines. Requests can be refined by AI into a clear summary with focus areas.
- **Mentorship workspace** — sessions, goals, chat, and scheduling in one shared space.
- **Real-time messaging** — instant chat with mentors, with live presence and typing.
- **Calendar** — sessions, reminders, and holidays in one view.

### For mentors

- **Request inbox** — review incoming mentorship requests and approve or decline them.
- **Mentee management** — see your mentees, their goals, and your sessions together.
- **Availability and leave** — set when you are available and block out leave; scheduling respects both.
- **Session management** — approve or decline session requests, with overlap checks.

### For administrators

- **Alumni verification** — review submitted profiles and approve, reject, or request changes. Only approved mentors can accept mentees.
- **Platform overview** — live counts of users, verifications, mentorships, requests, and sessions.
- **AI Engine status** — see whether the local matching engine is reachable, which model is running, and whether ranking is enabled.
- **Notifications** — every important event reaches the right person.

### Mentorly AI

An in-app assistant answers questions from the platform's own knowledge and the asking user's own live data — their profile, verification status, requests, mentorships, sessions, and notifications. It never shares one user's data with another. Administrators can also ask for live platform totals.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend (React) | Vite, React 19, Tailwind CSS 4 |
| Frontend (Next.js) | Next.js 16, React 19 |
| Backend | Express 5, TypeScript, MongoDB |
| Authentication | Clerk (email, OAuth, OTP) |
| AI engine | Ollama, local language model |
| Real-time | WebSockets |

The React app and the Next.js app are the same product in two frameworks — the same pages, the same behaviour, the same backend.

## Project structure

```
alumninetwork/
├── src/                # React frontend (Vite)
│   ├── pages/          # All pages, flat
│   ├── components/     # Shared UI, auth, dashboard, mentor, onboarding
│   └── lib/            # API client, sockets, helpers
├── nextjs/             # Next.js twin of the frontend (App Router)
├── backend/
│   └── src/
│       ├── routes/     # REST API routes
│       ├── services/   # Matching, verification, requests, LLM client
│       └── chatbot/    # Mentorly AI: knowledge, service, routes
└── README.md
```

## Getting started

### Prerequisites

- Node.js 20 or later
- MongoDB running locally (or a MongoDB Atlas cluster)
- A Clerk account and publishable key
- Ollama running locally with a language model pulled (for matching and the chatbot)

### Install

```bash
# Backend
cd backend && npm install

# React frontend
cd .. && npm install

# Next.js frontend
cd nextjs && npm install
```

### Configure

Copy the example environment files and fill in your own values. Never commit real keys.

```bash
# backend/.env
# MongoDB connection string
# Clerk publishable and secret keys
FRONTEND_URL=http://localhost:8080
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
LLM_RANKING_ENABLED=true
```

```bash
# nextjs/.env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

The React app reads the same Clerk publishable key from its own `.env`.

### Run

Run each part in its own terminal. The frontend and backend are never started from a combined script.

```bash
# Terminal 1 — backend (http://localhost:3000)
cd backend && npm run server

# Terminal 2 — React frontend (http://localhost:8080)
npm run dev

# Terminal 3 — Next.js frontend (http://localhost:8081)
cd nextjs && npm run dev
```

## How matching works

1. A deterministic scorer ranks candidate mentors. The weights are: semantic similarity 35, career-goal fit 20, expertise 15, industry 10, target role 10, availability 10.
2. On a cache miss, the local language model re-ranks the top candidates and writes one or two short reasons for each match. It can move a score by at most 15 points and cannot invent mentors or change who is eligible.
3. If the model is unavailable, the deterministic ranking is used as-is and the result is labelled honestly.

## Verification workflow

1. A user completes onboarding and submits their details with a proof-document link.
2. An administrator or alumni officer reviews the submission.
3. The verification moves through `SUBMITTED`, `UNDER_REVIEW`, and then `APPROVED`, `REJECTED`, or `CHANGES_REQUESTED`.
4. Approved users reach their dashboard. Rejected users, or users asked for changes, return to the onboarding review page.

## Contributing

This project is maintained by its author. Bug reports and suggestions are welcome as GitHub issues. Please do not commit secrets, credentials, or environment files.

## Licence

All rights reserved.

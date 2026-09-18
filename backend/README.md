# LPU MentorConnect Backend API
## Lovely Professional University (LPU) Alumni Mentorship & Career Network

Production-grade Node.js + Express.js backend designed to integrate with the **React + TypeScript** frontend.

## Architecture & Subsystems

The backend utilizes a **Modular Monolith** architecture:
* **Runtime & Framework**: Node.js + Express.js (TypeScript) with class-validator/DTO request parsing.
* **Database**: MongoDB 7+ with Mongoose (18 schemas supporting users, mentorships, sessions, goals, and verifications).
* **Caching & Jobs Queue**: Redis with BullMQ for background email deliveries, vector calculations, timeout triggers, and overdue action items.
* **Authentication**: Clerk OAuth token verification with database user resolution and Role-Based Access Control (RBAC).
* **Phone Verification**: MSG91 OTP service with international format normalization.
* **Real-time Messaging**: Socket.IO WebSockets namespace matching private conversation channels.
* **Observability**: Health checks (`/health`), structured logging, and request correlation IDs.
* **API Documentation**: Interactive Swagger/OpenAPI documentation available at `/api`.

```
       [ React + TypeScript Frontend ]
                     │ (HTTPS / WSS)
                     ▼
    [ Node.js + Express.js Gateway & Router ]
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
      [Auth]       [Chat]      [Recs]  (Modular Subsystems)
         │           │           │
         └───────────┬───────────┘
                     ▼
             [ MongoDB 7+ (Mongoose) ] <── [ Redis + BullMQ Jobs ]
```

---

## 1. Prerequisites

Ensure you have the following installed on your system:
* **Node.js** (v18 or higher, Node 20+ recommended)
* **MongoDB** (v7 or higher, local instance or MongoDB Atlas)
* **Redis** (v7 or higher, local instance or Upstash Redis)

---

## 2. Installation & Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your environment variables by copying `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

---

## 3. Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Local server port | `3000` |
| `DATABASE_URL` | MongoDB connection string | `mongodb://localhost:27017/mentorconnect` |
| `REDIS_HOST` | Redis host for queues & cache | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `CLERK_JWKS_URL` | Clerk JSON Web Key Set URL | `https://api.clerk.com/v1/jwks` |
| `GEMINI_API_KEY` | Gemini AI key for embeddings | `(optional - fallbacks to dummy)` |
| `RESEND_API_KEY` | Resend API key for notification emails | `(optional - fallbacks to console log)` |
| `MSG91_AUTH_KEY` | MSG91 Auth key for OTP | `(optional in development)` |
| `AWS_ACCESS_KEY_ID` | S3-compatible key | `(optional - fallbacks to local mock)` |
| `TOKEN_ENCRYPTION_KEY` | Hex key for encrypting OAuth tokens | `32_character_hex_key` |

---

## 4. Database Setup & Seeding

1. **Seed Data**: Populate database with Indian student/mentor records, LPU taxonomies, goals, and matching weights:
   ```bash
   npm run seed
   ```

---

## 5. Running the Application

* **Development Watch Mode**:
  ```bash
  npm run server
  ```
* **Production Build & Run**:
  ```bash
  npm run build
  npm run start:prod
  ```

Swagger interactive API documentation will be available locally at:
👉 **[http://localhost:3000/api](http://localhost:3000/api)**

---

## 6. Integrations Configuration

### AI Recommendations & Vector Search
1. Provides a **hybrid recommendation model**:
   * *Semantic similarity (35%)*: Generated using Gemini embeddings (projected to 1536-dims).
   * *Deterministic matching (65%)*: Skills overlap (15%), target role (10%), industry (10%), career goals (20%), and availability (10%).
2. **Fallback Pipeline**: An in-memory Cosine Similarity fallback engine runs if Atlas vector search is unavailable, tagging results with `matchType: "FALLBACK"`.

### Calendar (Google / Outlook)
* Integrates with Google Calendar using OAuth 2.0 (Google APIs).
* Stored credentials (access/refresh tokens) are encrypted at rest using AES-256-CBC.
* Resilient error handling prevents calendar sync failures from blocking session creation.

### Phone OTP (MSG91)
* Integrates MSG91 for SMS/WhatsApp verification of Indian phone numbers.
* Normalizes phone numbers to international format and verifies codes server-side.

### Email (Resend)
* Utilizes Resend to trigger transactional notifications.
* All email operations are queued in **BullMQ** so that slow SMTP relays never block database writes.

---

## 7. Running the Test Suite

We have built E2E integration tests matching the 10 critical business rules:
1. **TEST 1**: Enforces mentor capacity rules (prevents accepting requests when full).
2. **TEST 2**: Prevents concurrency race conditions (simultaneous acceptances lock & check limits).
3. **TEST 3**: Limits students to 3 active pending requests.
4. **TEST 4**: Rejects accepting expired requests.
5. **TEST 5**: Screens out unverified mentors from searches.
6. **TEST 6**: Validates resource ownership (returns `403 Forbidden` if student accesses other records).
7. **TEST 7**: Asserts recommended endpoints return verified, active mentors.
8. **TEST 8**: Verifies matching fallback operates when AI is down.
9. **TEST 9**: Detects and rejects overlapping session bookings.
10. **TEST 10**: Scrubs private mentor contact information (email, tokens, addresses) from public profiles.

To execute tests:
```bash
npm run test
```

---

## 8. Docker & Compose Setup

To deploy the entire stack locally in docker containers (MongoDB, Redis, and API):
```bash
docker compose up --build
```
This maps:
* Backend API to `http://localhost:3000`
* MongoDB to host port `27017`
* Redis cache to host port `6379`

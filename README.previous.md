# Mentorly
## Alumni Mentorship & Career Network

**Project Description & Technology Overview**

| Property | Value |
|---|---|
| **Project Type** | Full-stack web platform |
| **Frontend** | React + TypeScript (Vite) |
| **Backend** | Node.js + Express.js + TypeScript |
| **Database** | MongoDB 7+ with Mongoose |
| **Supporting Technologies** | Redis, BullMQ, Socket.IO, Clerk, Mentor Matching, Google Calendar, MSG91 |

---

## 1. Project Overview

**LPU MentorConnect** is a platform designed to make it easier for Lovely Professional University (LPU) students to connect with experienced alumni who can guide them in their academic, professional, and career journey. Instead of students searching randomly for someone suitable, the system uses their profile, career goals, skills, interests, preferred roles, industries, and mentoring needs to suggest relevant alumni mentors.

The main idea is simple: a student should be able to create a profile, explain what they want to achieve, discover verified alumni who can help, request mentorship, and then continue the relationship through scheduling, messaging, goals, and feedback — all in one place.

---

## 2. Why This Project Is Needed

Students often know that alumni can provide valuable career guidance, but finding the right person and starting a meaningful conversation can be difficult. At the same time, alumni may be willing to help but have no simple way to discover students who genuinely need their expertise.

- **Connect students with relevant and verified LPU alumni.**
- **Reduce the effort required to find a suitable mentor.**
- **Make mentor recommendations more personalized using mentor matching.**
- **Provide a structured mentorship journey instead of only a one-time connection.**
- **Give university teams useful visibility into alumni engagement and student career readiness.**

---

## 3. User Roles

| Role | Main Responsibility |
|---|---|
| **Student** | Creates a career profile, receives mentor recommendations, sends mentorship requests, schedules sessions, manages goals and communicates with mentors. |
| **Alumni / Mentor** | Builds a professional profile, shares expertise and availability, accepts mentorship requests, conducts sessions and supports students. |
| **Admin** | Manages users, verification, platform settings, mentorship activity, matching configuration, analytics and audit activity. |
| **Alumni Officer** | Reviews LPU alumni information and verification submissions and helps manage the verified alumni/mentor network. |
| **Placement Officer** | Focuses on student career readiness, skill gaps, mentorship participation and placement-related insights where the available data supports them. |

---

## 4. How the Platform Works

1. A user signs in through **Clerk** authentication.
2. The platform identifies the user's role and sends them through the appropriate onboarding process.
3. The user provides profile information such as phone number, LPU registration number, academic details, and career information.
4. Phone ownership is verified through an OTP flow using **MSG91**.
5. LPU affiliation information and required documents can be reviewed by authorized university staff.
6. Once a student profile is sufficiently complete, the matching system recommends suitable mentors.
7. The student can view why a mentor was recommended and send a mentorship request (enforcing a cap of max 3 active pending requests).
8. After acceptance, the mentorship includes sessions, calendar scheduling, messaging, goals, action items, notifications, and feedback.
9. University staff monitor relevant activity through role-specific dashboards.

---

## 5. Mentor Matching

The matching system is intended to assist the matching process rather than replace normal platform rules. The system first considers important eligibility requirements and then ranks suitable mentors using a combination of semantic similarity and structured profile information:

- **Student career goals and mentor expertise**
- **Skills and areas of interest**
- **Target job roles and industries**
- **Professional experience and mentoring areas**
- **Availability and other configurable matching factors**
- **Explainable reasons so the student can understand why a mentor is a good fit**

The matching service also has a local in-memory cosine-similarity fallback so that the core recommendation experience does not depend entirely on an Atlas-only vector search feature.

---

## 6. Frontend — React + TypeScript

The frontend of MentorConnect is built using **React with TypeScript** (powered by Vite). The interface is designed as a modern role-based single-page web application where students, mentors, and university staff see features tailored to their role.

- **React + TypeScript** for the user interface.
- **Role-based routing and protected application areas** via React Router.
- **Responsive dashboards** for Student, Mentor, Admin, Alumni Officer, and Placement Officer.
- **Reusable components** for forms, tables, cards, dialogs, filters, and profile sections.
- **API-driven data** instead of hardcoded dashboard numbers.
- **Loading, empty, error, and success states** for user actions.
- **Real-time updates** for notifications and messaging through Socket.IO.
- **Accessible and mobile-friendly interaction patterns**.

---

## 7. Backend — Node.js + Express.js

The backend is responsible for authentication integration, business rules, data access, verification workflows, mentorship operations, mentor matching, notifications, and real-time communication.

- **Node.js + Express.js + TypeScript**
- **MongoDB with Mongoose**
- **Clerk authentication guard** for authenticated requests
- **Role-based access control (RBAC)** for protected operations
- **Redis** for caching, queues, and supporting real-time workloads
- **BullMQ** for background processing such as embedding and media-related jobs
- **Socket.IO** for real-time messaging and notifications
- **Swagger / OpenAPI** documentation for the API (`/api`)
- **Jest / Supertest-based** backend testing

---

## 8. Database — MongoDB

MongoDB is used as the application's main database. The data model covers the main entities needed for the mentorship lifecycle, user management, and university verification workflows:

- **User and role information**
- **Student and mentor profiles**
- **Alumni verification records**
- **Availability and mentorship requests**
- **Mentorships and sessions**
- **Goals and action items**
- **Conversations and messages**
- **Notifications and feedback**
- **System configuration and audit logs**

---

## 9. Authentication, Phone Verification & LPU Verification

Authentication and identity verification are treated as separate concerns. Clerk is used for application authentication, while MSG91 is used to verify control of a mobile number through OTP. LPU affiliation is handled separately through registration information and an authorized review process.

- **Clerk** handles sign-in and authenticated sessions.
- **MSG91** handles mobile OTP verification.
- Phone numbers are normalized and stored in international format.
- The backend, not the frontend, decides whether a phone number is verified.
- LPU registration numbers are treated as sensitive information and not publicly exposed.
- Authorized Admin / Alumni Officer users review verification submissions.
- Alumni verification and active mentor status are separate concepts.

---

## 10. Mentorship Lifecycle

1. Student discovers a recommended mentor.
2. Student views the mentor profile and match explanation.
3. Student sends a mentorship request.
4. Mentor accepts, declines, or the student cancels the request.
5. An accepted relationship becomes an active mentorship.
6. The participants schedule sessions and manage availability.
7. Google Calendar integration supports calendar events.
8. The participants communicate through private real-time messaging.
9. Goals and action items can be created and tracked.
10. Feedback can be submitted after mentorship activity.

---

## 11. Role-Based Dashboards

- **Admin Dashboard**: Platform-wide users, verification, mentorship activity, mentor matching configuration, analytics, system activity, and audit information.
- **Alumni Officer Dashboard**: Alumni verification queue, verified alumni, mentor network, mentor activity, alumni analytics, and mentorship monitoring.
- **Placement Officer Dashboard**: Student career profiles, readiness indicators, skill gaps, mentorship participation, and career-related insights supported by actual data.
- **Student Dashboard**: Mentorship overview, upcoming sessions, pending requests, milestones, and recommendations.
- **Mentor Dashboard**: Mentee count against capacity, session bookings, incoming request approvals, and active conversations.

All dashboard values derive from real backend queries and MongoDB aggregation results.

---

## 12. Technology Stack Summary

| Layer | Technology |
|---|---|
| **Frontend** | React + TypeScript (Vite) |
| **Backend** | Node.js + Express.js + TypeScript |
| **Database** | MongoDB 7+, Mongoose |
| **Authentication** | Clerk |
| **Phone OTP** | MSG91 |
| **Caching / Queue** | Redis, BullMQ |
| **Real-time** | Socket.IO |
| **Mentor Matching** | Profile-based and structured mentor matching (Google Gemini embeddings + Cosine Similarity fallback) |
| **Calendar** | Google Calendar integration (OAuth 2.0 with AES-256 encrypted tokens) |
| **Testing** | Jest, Supertest |
| **Deployment** | Docker-based deployment with CI/CD support |

---

## 13. Security & Privacy

- Protected API routes and role-based permissions (RBAC).
- Sensitive LPU registration information is not exposed in public profiles.
- OTP credentials and verification secrets are kept out of logs.
- Rate limiting is applied to OTP operations.
- Verification decisions are recorded for accountability.
- Private conversations are accessible only to authorized participants.
- Admin and officer actions are captured through audit logs.
- Environment variables are used for secrets and external service credentials.

---

## 14. How to Run the Project

### Prerequisites
- **Node.js** v18+ (Node 20 or higher recommended)
- **npm** (v9+)
- **MongoDB** (Local instance or MongoDB Atlas)
- **Redis** (Local instance or Upstash Redis)

---

### Step 1: Start Backend Database & Redis
If running services with Docker:
```bash
docker compose up -d mongodb redis
```
*(Or use your cloud MongoDB Atlas and Upstash Redis credentials in `backend/.env`)*

---

### Step 2: Run the Backend (Node.js + Express.js)

```bash
# Option A: From project root
npm run server

# Option B: From backend directory
cd backend
npm run server
```

- **Backend API Gateway**: `http://localhost:3000/api/v1`
- **Swagger / OpenAPI Documentation**: `http://localhost:3000/api`
- **Health Check**: `http://localhost:3000/api/v1/health`

To seed database with initial records:
```bash
cd backend && npm run seed
```

To run backend tests:
```bash
cd backend && npm run test
```

---

### Step 3: Run the Frontend (React + TypeScript)

```bash
# In the root directory:
npm install

# Start Vite React development server
npm run dev
```

- **Frontend Application**: `http://localhost:8080`
- To build for production: `npm run build`
- To preview production build: `npm run preview`

---

## 15. Short Submission Summary

**LPU MentorConnect** is an alumni mentorship and career networking platform for Lovely Professional University. It connects students with verified alumni based on career goals, skills, interests, target roles, industries, experience, and availability. The platform combines **React + TypeScript** on the frontend with **Node.js + Express.js**, **MongoDB**, **Redis**, **Socket.IO**, **Clerk**, and **mentor matching** on the backend. It supports role-based onboarding, phone verification, alumni verification, mentor recommendations, mentorship requests, scheduling, real-time messaging, goals, feedback, and role-specific university dashboards.

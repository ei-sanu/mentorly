/**
 * Platform knowledge for the Mentorly AI chatbot (service-level RAG,
 * 2026-11-20).
 *
 * This is the PLATFORM half of the RAG context: short, curated facts
 * about how Mentorly actually works, written from the real platform
 * (routes, services, and the behaviour verified in the 2026-11-19/20
 * audits). Nothing here is invented — if a feature is not in this
 * file, the chatbot must not claim it exists.
 *
 * Retrieval is keyword-based and live at request time: the chatbot
 * service scores these sections against the user's question and
 * includes only the best-matching ones in the prompt. There is no
 * pre-built index and no copy of user data anywhere in this file.
 */

export interface KnowledgeSection {
  /** Stable id, also used as a source label in tests. */
  id: string;
  title: string;
  /** Lowercase keywords/phrases used to score this section. */
  keywords: string[];
  /** The facts themselves — plain sentences, no markup. */
  text: string;
}

export const PLATFORM_KNOWLEDGE: KnowledgeSection[] = [
  {
    id: 'overview',
    title: 'What Mentorly is',
    // Deliberately narrow: this section is also the fallback when
    // nothing matches, so generic words here ("mentor", "how do",
    // "work") would outrank the topical section on real questions.
    keywords: [
      'mentorly', 'what is', 'about mentorly', 'platform',
      'how does mentorly work', 'what does mentorly do',
      'model', 'what model', 'which model', 'powered by', 'what powers',
      'dashboard', 'what can i do', 'what can i do as',
    ],
    text: [
      'Mentorly is an alumni mentorship platform that connects students with verified alumni mentors.',
      'There are five roles: student, mentor, admin, alumni officer, and placement officer.',
      'Students find mentors, send mentorship requests, and meet in mentorships with sessions, goals, and messages.',
      'Mentors are verified alumni who accept requests, run sessions, and guide their mentees.',
      'Admins review verifications and manage the platform; alumni officers review mentor verifications.',
      'The AI engine behind matching and this chat is Mentorly AI.',
    ].join(' '),
  },
  {
    id: 'onboarding',
    title: 'Signing up, onboarding, and verification status',
    keywords: [
      'onboarding', 'sign up', 'signup', 'register', 'join', 'account',
      'role', 'status', 'approved', 'rejected', 'under review', 'submitted',
      'pending', 'verification', 'verify', 'phone', 'otp', 'document',
      'proof', 'registration number', 'lpu email', 'changes requested',
    ],
    text: [
      'After signing in, a new user chooses a role — student or mentor — and completes onboarding.',
      'Onboarding covers personal details, phone verification by OTP, academic details (school, programme, year of study), and a career profile (skills, target role, industry, career goals).',
      'Mentors also paste a verification document link (a link to a certificate, not a file upload) in onboarding step 4.',
      'The onboarding status moves from NOT_STARTED to IN_PROGRESS to SUBMITTED to UNDER_REVIEW, and then to APPROVED — or REJECTED or CHANGES_REQUESTED if the review team asks for fixes.',
      'Review usually takes 24 to 48 business hours. The Onboarding Status page shows the live status, whether the mobile number is verified, and the registration number on file.',
      'Only an APPROVED account reaches the dashboard; a rejected or changes-requested account is sent to the review page to fix and resubmit.',
      'Your display name comes from your Mentorly profile, not from your Google account.',
    ].join(' '),
  },
  {
    id: 'matching',
    title: 'Finding mentors and AI matching',
    keywords: [
      'find mentor', 'find a mentor', 'mentor', 'recommend', 'match',
      'matching', 'best mentor', 'suggest', 'ai', 'score', 'percent',
      'percentage', 'why this mentor', 'refresh', 'search',
    ],
    text: [
      'The Find Mentors page shows AI Recommended Mentors, ranked for your profile.',
      'Ranking starts from a weighted score — skills and career fit, expertise, industry, target role, and availability — and Mentorly AI re-ranks the top mentors and writes the reasons shown under "Why this mentor?".',
      'Each mentor card shows a match percentage; hovering it (or tapping it) explains the number with the per-component breakdown and both sides of the match.',
      'Recommendations are cached for one hour. The Refresh button on Find Mentors fetches fresh recommendations.',
      'While recommendations load, the page shows "Mentorly AI is currently finding the best mentor for you".',
      'Mentor profiles show their role, company, expertise, mentoring areas, and whether they are accepting new mentees; mentors on leave show "On leave until" and cannot receive new requests until they are back.',
    ].join(' '),
  },
  {
    id: 'requests',
    title: 'Mentorship requests',
    keywords: [
      'request', 'requests', 'send request', 'ask', 'apply', 'cancel',
      'accept', 'decline', 'pending', 'my requests',
    ],
    text: [
      'From a mentor profile or Find Mentors, a student sends a mentorship request with a goal (up to 200 characters) and an intro message (up to 1000 characters).',
      'The mentor accepts or declines the request. Accepting it creates an active mentorship; declining it closes the request.',
      'A student can cancel a request while it is still pending, from My Requests.',
      'Requests that are accepted show as "Mentorship Active"; pending ones show as "Request Sent".',
    ].join(' '),
  },
  {
    id: 'mentorships',
    title: 'Mentorships and the workspace',
    keywords: [
      'mentorship', 'mentorships', 'workspace', 'my mentorships',
      'my mentees', 'goals', 'goal', 'feedback', 'overview',
      'my mentor', 'my mentee', 'who is my mentor', 'mentee', 'mentees',
    ],
    text: [
      'An active mentorship has a workspace with Overview, Sessions, Goals, and Feedback tabs, plus Message and Schedule actions.',
      'Both the student and the mentor have their own workspace view of the same mentorship.',
      'The Overview tab shows the next session and the current goal.',
      // Truthful (2026-11-21): the Goals tab's Add Goal button and the
      // Feedback tab are not wired up yet — the knowledge must not
      // claim they work. Verified in the workspace slice audit.
      'The Goals tab and the Feedback tab exist, but adding a goal and sharing feedback are not wired up yet — the Add Goal button does nothing and the Feedback tab is a placeholder.',
    ].join(' '),
  },
  {
    id: 'sessions',
    title: 'Sessions and scheduling',
    keywords: [
      'session', 'sessions', 'schedule', 'scheduling', 'meeting',
      'meet', 'book', 'appointment', 'join', 'call', 'next session',
      'reschedule', 'cancel session',
    ],
    text: [
      'A student can request a session by proposing a date and time; the mentor approves or declines it.',
      'Only approved sessions (status SCHEDULED) are confirmed and show a Join meeting link. A session request that is still awaiting the mentor is not a confirmed session and never appears as one.',
      'The mentor can also schedule a session directly, including from inside a chat.',
      'Meetings use a real meeting link the mentor pastes in (for example a Google Meet link). Mentorly does not generate meeting links, and a session without a link shows "No meeting link yet".',
      'Sessions live in the workspace Sessions tab and in the chat "Upcoming meetings" card.',
    ].join(' '),
  },
  {
    id: 'messages',
    title: 'Messages and chat',
    keywords: [
      'message', 'messages', 'chat', 'conversation', 'talk', 'online',
      'offline', 'presence', 'reply',
    ],
    text: [
      'Mentor and student message each other inside their mentorship, from the Messages page.',
      'Messages send in real time. A green dot means the other person is online with Messages open; a black dot means offline.',
      'Each conversation shows the mentorship status, and the mentor can schedule a meeting from inside the chat.',
    ].join(' '),
  },
  {
    id: 'notifications',
    title: 'Notifications',
    keywords: [
      'notification', 'notifications', 'bell', 'alert', 'notify',
      'notified', 'unread',
    ],
    text: [
      'Notifications appear under the bell icon and on the Notifications page in the sidebar (students, mentors, and admins all have one).',
      'Each notification shows who it is from, what happened, when it happened, and a View link that opens the relevant page — a request, a mentorship, a session, or a message.',
      'The bell shows the true unread count and hides the dot when there is nothing unread.',
      'New chat messages do not currently create a notification.',
    ].join(' '),
  },
  {
    id: 'calendar',
    title: 'Calendar and notes',
    keywords: [
      'calendar', 'note', 'notes', 'holiday', 'holidays', 'date',
      'diwali', 'christmas', 'republic day',
    ],
    text: [
      'The Calendar page is a month view where you can add personal notes to any day. Notes are private — only you can see them.',
      'Indian national holidays are shown distinctly on the calendar, with a "Holidays in this month" list — for example Republic Day on 26 January, Diwali, and Christmas on 25 December.',
    ].join(' '),
  },
  {
    id: 'account',
    title: 'Account, profile, and settings',
    keywords: [
      'profile', 'settings', 'password', 'forgot', 'reset', 'security',
      'google', 'sso', 'login', 'sign in', 'name', 'edit profile',
      'update profile', 'capacity', 'availability', 'leave',
    ],
    text: [
      'Your profile holds your name, academic details, skills, target role, and industry (students) or your company, role, expertise, and mentoring areas (mentors).',
      'Your display name comes from your Mentorly profile; after you update your profile name, the dashboard and header use the new name.',
      'In Settings, under Security, you can link a Google account for sign-in. Password reset is done with a mobile OTP.',
      'Mentors set their weekly working times and leave dates from the Availability page. While on leave, their profile shows "On leave until" and new requests are blocked.',
      'Mentors also set how many mentees they can take at once (mentee capacity, between 1 and 20).',
    ].join(' '),
  },
  {
    id: 'admin',
    title: 'Admin and verification panel',
    keywords: [
      'admin', 'verify', 'verification panel', 'approve', 'officer',
      'manage users', 'dashboard admin', 'ai engine',
      'how many users', 'how many', 'total users', 'user count',
      'how many mentors', 'how many students', 'platform stats', 'statistics',
      'how many verifications', 'pending verifications', 'how many mentorships',
      'how many requests', 'how many sessions', 'platform totals', 'how many people',
    ],
    text: [
      'Admins review mentor verifications in the verification panel, which lists pending verifications only — an accepted verification leaves the list immediately.',
      'The admin AI Matching page shows the AI Engine card for Mentorly AI. It shows Active only when the local engine is reachable and ranking is enabled.',
      'Admins also manage users and matching configuration.',
      'Admins can also ask this chat for live platform totals — total users by role, pending verifications, active mentorships, mentorship requests, and sessions — counted live from the platform data.',
    ].join(' '),
  },
];

/**
 * Score the knowledge sections against a question (lowercase substring
 * matching on the section keywords). Pure function, exported for tests.
 * Returns the sections sorted best-first with their hit counts.
 */
export function scoreKnowledgeSections(question: string): Array<{ section: KnowledgeSection; hits: number }> {
  const q = (question || '').toLowerCase();
  const scored = PLATFORM_KNOWLEDGE.map((section) => {
    let hits = 0;
    for (const keyword of section.keywords) {
      if (keyword && q.includes(keyword)) hits += 1;
    }
    return { section, hits };
  });
  scored.sort((a, b) => b.hits - a.hits);
  return scored;
}

/**
 * Pick the sections to put in the prompt: the top matches with at least
 * one keyword hit (at most `maxSections`), falling back to the overview
 * section when nothing matches — so the model always has the basic
 * "what Mentorly is" facts and never answers from nothing.
 */
export function selectKnowledgeSections(question: string, maxSections = 3): KnowledgeSection[] {
  const scored = scoreKnowledgeSections(question);
  const matched = scored.filter((s) => s.hits > 0).slice(0, maxSections).map((s) => s.section);
  if (matched.length > 0) return matched;
  const overview = PLATFORM_KNOWLEDGE.find((s) => s.id === 'overview');
  return overview ? [overview] : [];
}

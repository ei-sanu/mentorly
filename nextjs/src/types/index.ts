// 'PENDING' (2026-11-12): a brand-new account provisioned without any
// role signal (e.g. first-time OAuth sign-in). It means "no role chosen
// yet" — never a silent STUDENT. The onboarding role gate asks the user,
// and submitOnboarding writes the chosen role.
export type Role = 'STUDENT' | 'MENTOR' | 'ALUMNI_OFFICER' | 'PLACEMENT_OFFICER' | 'ADMIN' | 'PENDING';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl: string;
  role: Role;
}

export interface MentorPublicProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  title: string;
  company: string;
  experienceYears: number;
  expertise: string[];
  industry: string;
  graduationYear: string;
  programme: string;
  capacity: {
    max: number;
    current: number;
  };
  acceptingMentees: boolean;
}

export interface MentorMatch extends MentorPublicProfile {
  matchScore: number;
  matchReasons: string[];
  /** How this item was computed: 'LLM' = locally re-ranked/reasoned, 'HYBRID' = deterministic scorer, 'FALLBACK' = fallback scoring. */
  matchType?: 'LLM' | 'HYBRID' | 'FALLBACK';
  /** True only when the local LLM genuinely contributed to this item. */
  llmUsed?: boolean;
  /** Ollama error kind when the run fell back because the LLM failed. */
  llmError?: 'unavailable' | 'timeout' | 'invalid_output' | 'disabled';
  /** Mentor's mentoring areas (sent by the backend, used by the LLM prompt). */
  mentoringAreas?: string[];
  /**
   * Per-component score breakdown (2026-11-20, Item 1 follow-up — the
   * "both show 23%" investigation). Each component value is the POINTS
   * contributed, max = its weight: semantic 35, careerGoal 20,
   * expertise 15, industry 10, targetRole 10, availability 10.
   * llmAdjustment is the points the LLM added/subtracted (negative
   * when it lowered the score). The match-% tooltip reads this.
   */
  scoreBreakdown?: {
    semantic: number;
    careerGoal: number;
    expertise: number;
    industry: number;
    targetRole: number;
    availability: number;
    llmAdjustment?: number;
  };
}

export type MentorshipStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';

export interface MentorshipRequest {
  id: string;
  studentId: string;
  mentorId: string;
  status: MentorshipStatus;
  message: string;
  goal: string;
  createdAt: string;
  mentor?: MentorPublicProfile; // Included when fetching for student
  /** Populated student (User) when fetching for a mentor — firstName/lastName live here. */
  student?: { id: string; firstName?: string; lastName?: string; email?: string };
  /** AI-refined summary of the goal + message, written by the local LLM. Present only when aiRefined is true. */
  aiRefinedSummary?: string;
  /** Suggested focus areas from the same refinement. */
  aiFocusAreas?: string[];
  /** True only when the LLM genuinely produced a refinement for this request. */
  aiRefined?: boolean;
  /** Ollama error kind when a refinement was attempted and failed. Absent while a refinement is still running. */
  aiRefineError?: string;
  /** When the refinement completed. */
  aiRefinedAt?: string;
  /**
   * The requesting student's profile (programme, school, year, batch),
   * attached by the backend on the mentor findAll branch and findOne
   * (2026-11-20, Item 3). Whitelisted fields only — never the full
   * profile document. Absent (undefined) when the student has no
   * profile row; individual fields may also be empty, in which case
   * the UI renders "Not provided", never a guessed value.
   */
  studentProfile?: {
    programme?: string;
    school?: string;
    yearOfStudy?: number;
    graduationYear?: number;
    targetRole?: string;
    currentSkills?: string[];
    mentoringNeeds?: string;
  };
}

export interface Mentorship {
  id: string;
  studentId: string;
  mentorId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'AT_RISK' | 'INACTIVE';
  startDate: string;
  mentor?: MentorPublicProfile;
  /**
   * The student (mentee) of this mentorship — present on the MENTOR
   * branch of GET /mentorships and on GET /mentorships/:id (2026-11-20,
   * workspace slice Item 2). Flat display shape built by the backend
   * from the student profile + its User doc: the raw profile spread
   * carried no firstName/lastName at the top level, so mentor pages
   * rendered a bare "Student". Absent fields are ''/undefined and the
   * UI renders "Not provided", never a guess.
   */
  student?: MentorshipStudent;
}

/**
 * The student side of a mentorship, in the same flat display shape as
 * MentorPublicProfile is for the mentor side.
 */
export interface MentorshipStudent {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  imageUrl?: string;
  programme?: string;
  school?: string;
  yearOfStudy?: number;
  graduationYear?: number;
  targetRole?: string;
  targetIndustry?: string;
  currentSkills?: string[];
}

/**
 * A scheduled mentorship session — the REAL backend shape
 * (backend/src/database/schemas/session.schema.ts, 2026-11-20 Item 6).
 * The previous type declared fictional `date` / `time` /
 * `durationMinutes` fields the backend never sends; the workspace
 * rendered "Invalid Date at undefined" from them. Sessions carry
 * startTime/endTime (ISO dates); `meetingUrl` is a mentor- or
 * student-supplied link only — never generated (the old mock
 * meet.google.com link was removed backend-side the same day).
 */
export interface Session {
  id: string;
  mentorshipId: string;
  title: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  /**
   * REQUESTED (2026-11-20, workspace slice Item 3): a student-proposed
   * session awaiting the mentor's decision. It is never a confirmed
   * session — only SCHEDULED sessions appear as Next Session, in the
   * chat "Upcoming meetings" card, or with a Join link.
   */
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'NO_SHOW' | 'REQUESTED';
  notes?: string;
  meetingUrl?: string;
}

/**
 * One weekly recurring availability window for a mentor
 * (backend/src/database/schemas/availability.schema.ts, Item 5).
 * dayOfWeek: 0 = Sunday … 6 = Saturday. Times are "HH:MM" 24h.
 */
export interface AvailabilitySlot {
  id: string;
  mentorProfileId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
}

/**
 * A dated leave / time-off block for a mentor (Item 5, new backend
 * collection mentor-leave). Reason is mentor-written for display.
 */
export interface MentorLeave {
  id: string;
  mentorProfileId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface Goal {
  id: string;
  mentorshipId: string;
  title: string;
  description: string;
  progress: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  targetDate: string;
}

/**
 * A personal calendar note (Item 5, 2026-11-20) — the frontend shape
 * of backend/src/database/schemas/calendar-note.schema.ts. `date` is a
 * plain "YYYY-MM-DD" day string (no time, no timezone); notes are
 * private to the signed-in user — the backend scopes every read/write
 * to the authenticated user, so no note is ever shared.
 */
export interface CalendarNote {
  id: string;
  date: string;
  title?: string;
  text: string;
  createdAt?: string;
  updatedAt?: string;
}

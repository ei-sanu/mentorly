import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import { useUser } from '@/lib/mock-auth';

// Loading fallback: Pulse-style ThinkingDots pill + labelled skeleton stack,
// so a loading screen never reads as a blank or broken page.
const PageLoader = () => (
  <div className="glass-theme flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f2f2f2] px-4" role="status" aria-busy="true">
    <div className="glass-panel flex w-fit items-center gap-2.5 rounded-full px-4 py-2 text-xs text-neutral-500">
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="glass-thinking-dot h-1.5 w-1.5 rounded-full bg-current" />
        <span className="glass-thinking-dot h-1.5 w-1.5 rounded-full bg-current" />
        <span className="glass-thinking-dot h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      Loading Mentorly…
    </div>
    <div className="w-64 space-y-2">
      <div className="pulse-skeleton h-3 w-full rounded-md" aria-hidden="true" />
      <div className="pulse-skeleton h-3 w-2/3 rounded-md" aria-hidden="true" />
    </div>
  </div>
);

// Public Pages
const HomePage = lazy(() => import('@/pages/HomePage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const OnboardingReviewPage = lazy(() => import('@/pages/OnboardingReviewPage'));
const OnboardingStatusPage = lazy(() => import('@/pages/OnboardingStatusPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// Student Pages
const StudentDashboard = lazy(() => import('@/pages/StudentDashboard'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const FindMentors = lazy(() => import('@/pages/FindMentors'));
const MentorProfileView = lazy(() => import('@/pages/MentorProfileView'));
const MyMentorships = lazy(() => import('@/pages/MyMentorships'));
const MentorshipDetail = lazy(() => import('@/pages/MentorshipDetail'));
const StudentMessages = lazy(() => import('@/pages/StudentMessages'));
const StudentProfile = lazy(() => import('@/pages/StudentProfile'));
const MyRequests = lazy(() => import('@/pages/MyRequests'));
const StudentSettings = lazy(() => import('@/pages/StudentSettings'));
const StudentNotifications = lazy(() => import('@/pages/StudentNotifications'));

// Mentor Pages
const MentorDashboard = lazy(() => import('@/pages/MentorDashboard'));
const MentorAvailability = lazy(() => import('@/pages/MentorAvailability'));
const MentorCapacity = lazy(() => import('@/pages/MentorCapacity'));
const MyMentees = lazy(() => import('@/pages/MyMentees'));
const MentorMentorshipDetail = lazy(() => import('@/pages/MentorMentorshipDetail'));
const MentorMessages = lazy(() => import('@/pages/MentorMessages'));
const MentorProfile = lazy(() => import('@/pages/MentorProfile'));
const MentorRequests = lazy(() => import('@/pages/MentorRequests'));
const MentorSettings = lazy(() => import('@/pages/MentorSettings'));
const MentorNotifications = lazy(() => import('@/pages/MentorNotifications'));

// Admin Pages
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const AdminAnalytics = lazy(() => import('@/pages/AdminAnalytics'));
const AdminAuditLogs = lazy(() => import('@/pages/AdminAuditLogs'));
const AdminMatching = lazy(() => import('@/pages/AdminMatching'));
const AdminMatchingConfig = lazy(() => import('@/pages/AdminMatchingConfig'));
const AdminMatchingOverview = lazy(() => import('@/pages/AdminMatchingOverview'));
const AdminMentorships = lazy(() => import('@/pages/AdminMentorships'));
const AdminMentorshipsActive = lazy(() => import('@/pages/AdminMentorshipsActive'));
const AdminMentorshipsCompleted = lazy(() => import('@/pages/AdminMentorshipsCompleted'));
const AdminMentorshipsRequests = lazy(() => import('@/pages/AdminMentorshipsRequests'));
const AdminNotifications = lazy(() => import('@/pages/AdminNotifications'));
const AdminSettings = lazy(() => import('@/pages/AdminSettings'));
const AdminUsers = lazy(() => import('@/pages/AdminUsers'));
const AdminUsersAll = lazy(() => import('@/pages/AdminUsersAll'));
const AdminUsersAlumni = lazy(() => import('@/pages/AdminUsersAlumni'));
const AdminUsersMentors = lazy(() => import('@/pages/AdminUsersMentors'));
const AdminUsersStudents = lazy(() => import('@/pages/AdminUsersStudents'));
const AdminVerification = lazy(() => import('@/pages/AdminVerification'));

// Alumni Officer Pages
const AlumniOfficerDashboard = lazy(() => import('@/pages/AlumniOfficerDashboard'));
const AlumniOfficerAlumni = lazy(() => import('@/pages/AlumniOfficerAlumni'));
const AlumniOfficerAnalytics = lazy(() => import('@/pages/AlumniOfficerAnalytics'));
const AlumniOfficerDirectory = lazy(() => import('@/pages/AlumniOfficerDirectory'));
const AlumniOfficerMentorApplications = lazy(() => import('@/pages/AlumniOfficerMentorApplications'));
const AlumniOfficerMentorPerformance = lazy(() => import('@/pages/AlumniOfficerMentorPerformance'));
const AlumniOfficerMentors = lazy(() => import('@/pages/AlumniOfficerMentors'));
const AlumniOfficerMentorsActive = lazy(() => import('@/pages/AlumniOfficerMentorsActive'));
const AlumniOfficerMentorships = lazy(() => import('@/pages/AlumniOfficerMentorships'));
const AlumniOfficerMentorshipsActive = lazy(() => import('@/pages/AlumniOfficerMentorshipsActive'));
const AlumniOfficerMentorshipsFeedback = lazy(() => import('@/pages/AlumniOfficerMentorshipsFeedback'));
const AlumniOfficerMentorshipsRequests = lazy(() => import('@/pages/AlumniOfficerMentorshipsRequests'));
const AlumniOfficerNotifications = lazy(() => import('@/pages/AlumniOfficerNotifications'));
const AlumniOfficerVerification = lazy(() => import('@/pages/AlumniOfficerVerification'));

// Placement Officer Pages
const PlacementOfficerDashboard = lazy(() => import('@/pages/PlacementOfficerDashboard'));
const PlacementOfficerAiInsights = lazy(() => import('@/pages/PlacementOfficerAiInsights'));
const PlacementOfficerAnalytics = lazy(() => import('@/pages/PlacementOfficerAnalytics'));
const PlacementOfficerDirectory = lazy(() => import('@/pages/PlacementOfficerDirectory'));
const PlacementOfficerNotifications = lazy(() => import('@/pages/PlacementOfficerNotifications'));
const PlacementOfficerOpportunities = lazy(() => import('@/pages/PlacementOfficerOpportunities'));
const PlacementOfficerOpportunitiesActive = lazy(() => import('@/pages/PlacementOfficerOpportunitiesActive'));
const PlacementOfficerOpportunitiesApplications = lazy(() => import('@/pages/PlacementOfficerOpportunitiesApplications'));
const PlacementOfficerOpportunitiesUpcoming = lazy(() => import('@/pages/PlacementOfficerOpportunitiesUpcoming'));
const PlacementOfficerPlacements = lazy(() => import('@/pages/PlacementOfficerPlacements'));
const PlacementOfficerPlacementsApplications = lazy(() => import('@/pages/PlacementOfficerPlacementsApplications'));
const PlacementOfficerPlacementsInterviews = lazy(() => import('@/pages/PlacementOfficerPlacementsInterviews'));
const PlacementOfficerPlacementsOutcomes = lazy(() => import('@/pages/PlacementOfficerPlacementsOutcomes'));
const PlacementOfficerReadiness = lazy(() => import('@/pages/PlacementOfficerReadiness'));
const PlacementOfficerSkillGaps = lazy(() => import('@/pages/PlacementOfficerSkillGaps'));
const PlacementOfficerStudents = lazy(() => import('@/pages/PlacementOfficerStudents'));

// /app has no page of its own. An admin landing on the generic entry is
// sent straight to the admin dashboard; every other role sees exactly
// what /app showed before (an empty shell under the app chrome).
// Redirects only on an EXPLICITLY chosen ADMIN role (see use-role-guard):
// a user whose role is only a backend-cache fallback is never guessed
// at, and role-pending users never reach here — AppLayout's /me check
// sends them to /onboarding before the outlet renders.
function AppIndexRedirect() {
  const navigate = useNavigate();
  const { isLoaded, user, explicitRole } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (user && explicitRole === 'ADMIN') {
      navigate('/app/admin/dashboard', { replace: true });
    }
  }, [isLoaded, user, explicitRole, navigate]);

  return null;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/onboarding/review" element={<OnboardingReviewPage />} />
        <Route path="/onboarding/status" element={<OnboardingStatusPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* Protected / App Routes */}
        <Route path="/app" element={<AppLayout />}>
          {/* Generic entry: admins are redirected to their dashboard;
            other roles keep the empty shell /app always showed. */}
          <Route index element={<AppIndexRedirect />} />
          {/* Student Routes */}
          <Route path="student/dashboard" element={<StudentDashboard />} />
          <Route path="student/mentors" element={<FindMentors />} />
          <Route path="student/mentors/:mentorId" element={<MentorProfileView />} />
          <Route path="student/mentorships" element={<MyMentorships />} />
          <Route path="student/mentorships/:mentorshipId" element={<MentorshipDetail />} />
          <Route path="student/messages" element={<StudentMessages />} />
          <Route path="student/calendar" element={<CalendarPage />} />
          <Route path="student/profile" element={<StudentProfile />} />
          <Route path="student/requests" element={<MyRequests />} />
          <Route path="student/settings" element={<StudentSettings />} />
          <Route path="student/notifications" element={<StudentNotifications />} />

          {/* Mentor Routes */}
          <Route path="mentor/dashboard" element={<MentorDashboard />} />
          <Route path="mentor/availability" element={<MentorAvailability />} />
          <Route path="mentor/capacity" element={<MentorCapacity />} />
          <Route path="mentor/mentees" element={<MyMentees />} />
          {/* (2026-11-20, workspace slice Item 1) Mentor's own workspace
            page — the shared MentorshipWorkspace component, mentor side. */}
          <Route path="mentor/mentorships/:mentorshipId" element={<MentorMentorshipDetail />} />
          <Route path="mentor/messages" element={<MentorMessages />} />
          <Route path="mentor/calendar" element={<CalendarPage />} />
          <Route path="mentor/profile" element={<MentorProfile />} />
          <Route path="mentor/requests" element={<MentorRequests />} />
          <Route path="mentor/settings" element={<MentorSettings />} />
          <Route path="mentor/notifications" element={<MentorNotifications />} />

          {/* Admin Routes */}
          <Route path="admin/dashboard" element={<AdminDashboard />} />
          <Route path="admin/analytics" element={<AdminAnalytics />} />
          <Route path="admin/audit-logs" element={<AdminAuditLogs />} />
          <Route path="admin/matching" element={<AdminMatching />} />
          <Route path="admin/matching/config" element={<AdminMatchingConfig />} />
          <Route path="admin/matching/overview" element={<AdminMatchingOverview />} />
          <Route path="admin/mentorships" element={<AdminMentorships />} />
          <Route path="admin/mentorships/active" element={<AdminMentorshipsActive />} />
          <Route path="admin/mentorships/completed" element={<AdminMentorshipsCompleted />} />
          <Route path="admin/mentorships/requests" element={<AdminMentorshipsRequests />} />
          <Route path="admin/notifications" element={<AdminNotifications />} />
          <Route path="admin/settings" element={<AdminSettings />} />
          <Route path="admin/users" element={<AdminUsers />} />
          <Route path="admin/users/all" element={<AdminUsersAll />} />
          <Route path="admin/users/alumni" element={<AdminUsersAlumni />} />
          <Route path="admin/users/mentors" element={<AdminUsersMentors />} />
          <Route path="admin/users/students" element={<AdminUsersStudents />} />
          <Route path="admin/verification" element={<AdminVerification />} />

          {/* Alumni Officer Routes */}
          <Route path="alumni-officer/dashboard" element={<AlumniOfficerDashboard />} />
          <Route path="alumni-officer/alumni" element={<AlumniOfficerAlumni />} />
          <Route path="alumni-officer/analytics" element={<AlumniOfficerAnalytics />} />
          <Route path="alumni-officer/directory" element={<AlumniOfficerDirectory />} />
          <Route path="alumni-officer/mentor-applications" element={<AlumniOfficerMentorApplications />} />
          <Route path="alumni-officer/mentor-performance" element={<AlumniOfficerMentorPerformance />} />
          <Route path="alumni-officer/mentors" element={<AlumniOfficerMentors />} />
          <Route path="alumni-officer/mentors/active" element={<AlumniOfficerMentorsActive />} />
          <Route path="alumni-officer/mentorships" element={<AlumniOfficerMentorships />} />
          <Route path="alumni-officer/mentorships/active" element={<AlumniOfficerMentorshipsActive />} />
          <Route path="alumni-officer/mentorships/feedback" element={<AlumniOfficerMentorshipsFeedback />} />
          <Route path="alumni-officer/mentorships/requests" element={<AlumniOfficerMentorshipsRequests />} />
          <Route path="alumni-officer/notifications" element={<AlumniOfficerNotifications />} />
          <Route path="alumni-officer/verification" element={<AlumniOfficerVerification />} />

          {/* Placement Officer Routes */}
          <Route path="placement-officer/dashboard" element={<PlacementOfficerDashboard />} />
          <Route path="placement-officer/ai-insights" element={<PlacementOfficerAiInsights />} />
          <Route path="placement-officer/analytics" element={<PlacementOfficerAnalytics />} />
          <Route path="placement-officer/directory" element={<PlacementOfficerDirectory />} />
          <Route path="placement-officer/notifications" element={<PlacementOfficerNotifications />} />
          <Route path="placement-officer/opportunities" element={<PlacementOfficerOpportunities />} />
          <Route path="placement-officer/opportunities/active" element={<PlacementOfficerOpportunitiesActive />} />
          <Route path="placement-officer/opportunities/applications" element={<PlacementOfficerOpportunitiesApplications />} />
          <Route path="placement-officer/opportunities/upcoming" element={<PlacementOfficerOpportunitiesUpcoming />} />
          <Route path="placement-officer/placements" element={<PlacementOfficerPlacements />} />
          <Route path="placement-officer/placements/applications" element={<PlacementOfficerPlacementsApplications />} />
          <Route path="placement-officer/placements/interviews" element={<PlacementOfficerPlacementsInterviews />} />
          <Route path="placement-officer/placements/outcomes" element={<PlacementOfficerPlacementsOutcomes />} />
          <Route path="placement-officer/readiness" element={<PlacementOfficerReadiness />} />
          <Route path="placement-officer/skill-gaps" element={<PlacementOfficerSkillGaps />} />
          <Route path="placement-officer/students" element={<PlacementOfficerStudents />} />
        </Route>

        {/* 404 Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

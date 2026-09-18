import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';

// Loading spinner fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-lpu-bg">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-lpu-orange border-t-transparent mx-auto"></div>
      <p className="text-xs text-lpu-text-secondary font-medium tracking-wide uppercase">Loading...</p>
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
const StudentDashboard = lazy(() => import('@/pages/student/StudentDashboard'));
const FindMentors = lazy(() => import('@/pages/student/FindMentors'));
const MyMentorships = lazy(() => import('@/pages/student/MyMentorships'));
const MentorshipDetail = lazy(() => import('@/pages/student/MentorshipDetail'));
const StudentMessages = lazy(() => import('@/pages/student/StudentMessages'));
const StudentProfile = lazy(() => import('@/pages/student/StudentProfile'));
const MyRequests = lazy(() => import('@/pages/student/MyRequests'));
const StudentSettings = lazy(() => import('@/pages/student/StudentSettings'));

// Mentor Pages
const MentorDashboard = lazy(() => import('@/pages/mentor/MentorDashboard'));
const MentorAvailability = lazy(() => import('@/pages/mentor/MentorAvailability'));
const MentorCapacity = lazy(() => import('@/pages/mentor/MentorCapacity'));
const MyMentees = lazy(() => import('@/pages/mentor/MyMentees'));
const MentorMessages = lazy(() => import('@/pages/mentor/MentorMessages'));
const MentorProfile = lazy(() => import('@/pages/mentor/MentorProfile'));
const MentorRequests = lazy(() => import('@/pages/mentor/MentorRequests'));
const MentorSettings = lazy(() => import('@/pages/mentor/MentorSettings'));

// Admin Pages
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'));
const AdminAuditLogs = lazy(() => import('@/pages/admin/AdminAuditLogs'));
const AdminMatching = lazy(() => import('@/pages/admin/AdminMatching'));
const AdminMatchingConfig = lazy(() => import('@/pages/admin/AdminMatchingConfig'));
const AdminMatchingOverview = lazy(() => import('@/pages/admin/AdminMatchingOverview'));
const AdminMentorships = lazy(() => import('@/pages/admin/AdminMentorships'));
const AdminMentorshipsActive = lazy(() => import('@/pages/admin/AdminMentorshipsActive'));
const AdminMentorshipsCompleted = lazy(() => import('@/pages/admin/AdminMentorshipsCompleted'));
const AdminMentorshipsRequests = lazy(() => import('@/pages/admin/AdminMentorshipsRequests'));
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminUsersAll = lazy(() => import('@/pages/admin/AdminUsersAll'));
const AdminUsersAlumni = lazy(() => import('@/pages/admin/AdminUsersAlumni'));
const AdminUsersMentors = lazy(() => import('@/pages/admin/AdminUsersMentors'));
const AdminUsersStudents = lazy(() => import('@/pages/admin/AdminUsersStudents'));
const AdminVerification = lazy(() => import('@/pages/admin/AdminVerification'));

// Alumni Officer Pages
const AlumniOfficerDashboard = lazy(() => import('@/pages/alumni-officer/AlumniOfficerDashboard'));
const AlumniOfficerAlumni = lazy(() => import('@/pages/alumni-officer/AlumniOfficerAlumni'));
const AlumniOfficerAnalytics = lazy(() => import('@/pages/alumni-officer/AlumniOfficerAnalytics'));
const AlumniOfficerDirectory = lazy(() => import('@/pages/alumni-officer/AlumniOfficerDirectory'));
const AlumniOfficerMentorApplications = lazy(() => import('@/pages/alumni-officer/AlumniOfficerMentorApplications'));
const AlumniOfficerMentorPerformance = lazy(() => import('@/pages/alumni-officer/AlumniOfficerMentorPerformance'));
const AlumniOfficerMentors = lazy(() => import('@/pages/alumni-officer/AlumniOfficerMentors'));
const AlumniOfficerMentorsActive = lazy(() => import('@/pages/alumni-officer/AlumniOfficerMentorsActive'));
const AlumniOfficerMentorships = lazy(() => import('@/pages/alumni-officer/AlumniOfficerMentorships'));
const AlumniOfficerMentorshipsActive = lazy(() => import('@/pages/alumni-officer/AlumniOfficerMentorshipsActive'));
const AlumniOfficerMentorshipsFeedback = lazy(() => import('@/pages/alumni-officer/AlumniOfficerMentorshipsFeedback'));
const AlumniOfficerMentorshipsRequests = lazy(() => import('@/pages/alumni-officer/AlumniOfficerMentorshipsRequests'));
const AlumniOfficerNotifications = lazy(() => import('@/pages/alumni-officer/AlumniOfficerNotifications'));
const AlumniOfficerVerification = lazy(() => import('@/pages/alumni-officer/AlumniOfficerVerification'));

// Placement Officer Pages
const PlacementOfficerDashboard = lazy(() => import('@/pages/placement-officer/PlacementOfficerDashboard'));
const PlacementOfficerAiInsights = lazy(() => import('@/pages/placement-officer/PlacementOfficerAiInsights'));
const PlacementOfficerAnalytics = lazy(() => import('@/pages/placement-officer/PlacementOfficerAnalytics'));
const PlacementOfficerDirectory = lazy(() => import('@/pages/placement-officer/PlacementOfficerDirectory'));
const PlacementOfficerNotifications = lazy(() => import('@/pages/placement-officer/PlacementOfficerNotifications'));
const PlacementOfficerOpportunities = lazy(() => import('@/pages/placement-officer/PlacementOfficerOpportunities'));
const PlacementOfficerOpportunitiesActive = lazy(() => import('@/pages/placement-officer/PlacementOfficerOpportunitiesActive'));
const PlacementOfficerOpportunitiesApplications = lazy(() => import('@/pages/placement-officer/PlacementOfficerOpportunitiesApplications'));
const PlacementOfficerOpportunitiesUpcoming = lazy(() => import('@/pages/placement-officer/PlacementOfficerOpportunitiesUpcoming'));
const PlacementOfficerPlacements = lazy(() => import('@/pages/placement-officer/PlacementOfficerPlacements'));
const PlacementOfficerPlacementsApplications = lazy(() => import('@/pages/placement-officer/PlacementOfficerPlacementsApplications'));
const PlacementOfficerPlacementsInterviews = lazy(() => import('@/pages/placement-officer/PlacementOfficerPlacementsInterviews'));
const PlacementOfficerPlacementsOutcomes = lazy(() => import('@/pages/placement-officer/PlacementOfficerPlacementsOutcomes'));
const PlacementOfficerReadiness = lazy(() => import('@/pages/placement-officer/PlacementOfficerReadiness'));
const PlacementOfficerSkillGaps = lazy(() => import('@/pages/placement-officer/PlacementOfficerSkillGaps'));
const PlacementOfficerStudents = lazy(() => import('@/pages/placement-officer/PlacementOfficerStudents'));

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
          {/* Student Routes */}
          <Route path="student/dashboard" element={<StudentDashboard />} />
          <Route path="student/mentors" element={<FindMentors />} />
          <Route path="student/mentorships" element={<MyMentorships />} />
          <Route path="student/mentorships/:mentorshipId" element={<MentorshipDetail />} />
          <Route path="student/messages" element={<StudentMessages />} />
          <Route path="student/profile" element={<StudentProfile />} />
          <Route path="student/requests" element={<MyRequests />} />
          <Route path="student/settings" element={<StudentSettings />} />

          {/* Mentor Routes */}
          <Route path="mentor/dashboard" element={<MentorDashboard />} />
          <Route path="mentor/availability" element={<MentorAvailability />} />
          <Route path="mentor/capacity" element={<MentorCapacity />} />
          <Route path="mentor/mentees" element={<MyMentees />} />
          <Route path="mentor/messages" element={<MentorMessages />} />
          <Route path="mentor/profile" element={<MentorProfile />} />
          <Route path="mentor/requests" element={<MentorRequests />} />
          <Route path="mentor/settings" element={<MentorSettings />} />

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

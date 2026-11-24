'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  MessageSquare,
  Bell,
  Settings,
  UserCircle,
  GraduationCap,
  Calendar,
  CheckSquare,
  Award,
  ShieldAlert,
  FileText,
  CheckCircle,
  Sparkles,
  Target,
  BarChart3,
  ClipboardList,
  UserCheck,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useUser } from '@/lib/mock-auth';
import { LpuLogo } from '@/components/ui/lpu-logo';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  matchPrefixes?: string[];
}

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Pulse ⌘K: focus the nav search from anywhere in the dashboard.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!user) return null;

  let navItems: NavItem[] = [];

  if (user.role === 'STUDENT') {
    navItems = [
      { title: 'Dashboard', href: '/app/student/dashboard', icon: LayoutDashboard },
      { title: 'Find Mentors', href: '/app/student/mentors', icon: Users },
      { title: 'My Requests', href: '/app/student/requests', icon: Briefcase },
      { title: 'My Mentorships', href: '/app/student/mentorships', icon: GraduationCap },
      { title: 'Messages', href: '/app/student/messages', icon: MessageSquare },
      { title: 'Notifications', href: '/app/student/notifications', icon: Bell },
      { title: 'Calendar', href: '/app/student/calendar', icon: Calendar },
      { title: 'Profile', href: '/app/student/profile', icon: UserCircle },
      { title: 'Settings', href: '/app/student/settings', icon: Settings },
    ];
  } else if (user.role === 'MENTOR') {
    navItems = [
      { title: 'Dashboard', href: '/app/mentor/dashboard', icon: LayoutDashboard },
      { title: 'Requests', href: '/app/mentor/requests', icon: Briefcase },
      { title: 'My Mentees', href: '/app/mentor/mentees', icon: Users },
      { title: 'Availability', href: '/app/mentor/availability', icon: Calendar },
      { title: 'Capacity', href: '/app/mentor/capacity', icon: CheckSquare },
      { title: 'Messages', href: '/app/mentor/messages', icon: MessageSquare },
      { title: 'Notifications', href: '/app/mentor/notifications', icon: Bell },
      { title: 'Calendar', href: '/app/mentor/calendar', icon: Calendar },
      { title: 'Profile', href: '/app/mentor/profile', icon: UserCircle },
      { title: 'Settings', href: '/app/mentor/settings', icon: Settings },
    ];
  } else if (user.role === 'ADMIN') {
    navItems = [
      { title: 'Dashboard', href: '/app/admin/dashboard', icon: LayoutDashboard },
      { title: 'Users', href: '/app/admin/users', icon: Users, matchPrefixes: ['/app/admin/users'] },
      { title: 'Verification', href: '/app/admin/verification', icon: ShieldAlert },
      { title: 'Mentorship', href: '/app/admin/mentorships', icon: FileText, matchPrefixes: ['/app/admin/mentorships'] },
      { title: 'AI Matching', href: '/app/admin/matching', icon: Target, matchPrefixes: ['/app/admin/matching'] },
      { title: 'Analytics', href: '/app/admin/analytics', icon: BarChart3 },
      { title: 'Notifications', href: '/app/admin/notifications', icon: Bell },
      { title: 'Audit Logs', href: '/app/admin/audit-logs', icon: ClipboardList },
      { title: 'System Settings', href: '/app/admin/settings', icon: Settings },
    ];
  } else if (user.role === 'ALUMNI_OFFICER') {
    navItems = [
      { title: 'Dashboard', href: '/app/alumni-officer/dashboard', icon: LayoutDashboard },
      { title: 'Alumni', href: '/app/alumni-officer/alumni', icon: Users, matchPrefixes: ['/app/alumni-officer/directory', '/app/alumni-officer/verification', '/app/alumni-officer/analytics'] },
      { title: 'Mentors', href: '/app/alumni-officer/mentors', icon: UserCheck, matchPrefixes: ['/app/alumni-officer/mentors', '/app/alumni-officer/mentor-applications', '/app/alumni-officer/mentor-performance'] },
      { title: 'Mentorship', href: '/app/alumni-officer/mentorships', icon: CheckCircle, matchPrefixes: ['/app/alumni-officer/mentorships'] },
      { title: 'Notifications', href: '/app/alumni-officer/notifications', icon: Bell },
    ];
  } else if (user.role === 'PLACEMENT_OFFICER') {
    navItems = [
      { title: 'Dashboard', href: '/app/placement-officer/dashboard', icon: LayoutDashboard },
      { title: 'Students', href: '/app/placement-officer/students', icon: Users, matchPrefixes: ['/app/placement-officer/directory', '/app/placement-officer/readiness', '/app/placement-officer/skill-gaps'] },
      { title: 'Opportunities', href: '/app/placement-officer/opportunities', icon: Briefcase, matchPrefixes: ['/app/placement-officer/opportunities'] },
      { title: 'Placements', href: '/app/placement-officer/placements', icon: FileText, matchPrefixes: ['/app/placement-officer/placements'] },
      { title: 'AI Insights', href: '/app/placement-officer/ai-insights', icon: Sparkles },
      { title: 'Analytics', href: '/app/placement-officer/analytics', icon: BarChart3 },
      { title: 'Notifications', href: '/app/placement-officer/notifications', icon: Bell },
    ];
  }

  function isActive(item: NavItem): boolean {
    const prefixes = item.matchPrefixes ?? [item.href];
    return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'));
  }

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter((item) => item.title.toLowerCase().includes(q));
  }, [query, navItems]);

  const panel = (
    <div className="glass-panel flex h-full w-full flex-col rounded-lg p-3">
      <div className="flex items-center gap-2.5 px-2 pb-3 pt-1">
        <Link href="/" className="flex items-center" aria-label="Mentorly home">
          <span className="logo-pill flex items-center rounded-full px-3 py-1 shadow-sm">
            <LpuLogo className="h-9 w-auto" />
          </span>
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-neutral-400" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search navigation"
          aria-label="Search navigation"
          className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        <kbd className="rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-400">⌘K</kbd>
      </div>

      <div className="flex-1 overflow-auto">
        <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">Navigation</p>
        <nav className="grid gap-1">
          {visibleItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
          {visibleItems.length === 0 && (
            <p className="px-3 py-2 text-xs text-neutral-400">No matching navigation item.</p>
          )}
        </nav>
      </div>

      <div className="border-t border-neutral-200 px-3 pb-1 pt-3">
        <p className="text-[11px] leading-relaxed text-neutral-400">
          Verified alumni. Safe in-platform messaging.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: floating frosted panel, Pulse 264px. */}
      <aside className="sticky top-0 hidden h-screen shrink-0 p-3 lg:block">
        <div className="h-full w-[264px]">{panel}</div>
      </aside>
      {/* Mobile: same panel as a drawer. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        className={cn(
          "fixed bottom-3 left-3 top-3 z-50 w-[280px] transition-transform lg:hidden",
          open ? "translate-x-0" : "-translate-x-[calc(100%+1rem)]"
        )}
      >
        {panel}
      </aside>
    </>
  );
}

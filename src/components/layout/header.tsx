'use client';

import { useEffect, useState } from 'react';
import { Bell, Menu } from 'lucide-react';
import { useUser, useAuth } from '@/lib/mock-auth';
import { Button } from '@/components/ui/button';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { useRouter } from 'next/navigation';
import { notificationService } from '@/services/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// (Item 4, 2026-11-20) The bell used to be a dead button with a hardcoded
// dot that showed even with zero unread. It now shows the real unread count
// (hidden at zero) and opens the role's notifications page. Students and
// mentors have a notifications page as of this item, so every role has
// somewhere to land. Count refreshes on mount and whenever the window
// regains focus; there is no notification socket event to subscribe to.
const NOTIFICATIONS_HREF: Record<string, string> = {
  STUDENT: '/app/student/notifications',
  MENTOR: '/app/mentor/notifications',
  ADMIN: '/app/admin/notifications',
  ALUMNI_OFFICER: '/app/alumni-officer/notifications',
  PLACEMENT_OFFICER: '/app/placement-officer/notifications',
};

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationsHref = user ? NOTIFICATIONS_HREF[user.role] : undefined;

  useEffect(() => {
    if (!notificationsHref) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const list = await notificationService.getNotifications();
        if (!cancelled) setUnreadCount((list || []).filter((n) => !n.read).length);
      } catch {
        // The bell stays quiet on failure; the notifications page itself
        // surfaces the load error.
      }
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
    };
  }, [notificationsHref]);

  if (!user) return null;

  const showRoleSwitcher = user.email === 'someshranjanbiswal13678@gmail.com';

  const handleRoleChange = (newRole: string) => {
    localStorage.setItem('active_role', newRole);
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 px-4 lg:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center">
        <h2 className="text-base font-semibold tracking-tight text-neutral-900">
          {/* Page titles live in the pages themselves, as before. */}
        </h2>
      </div>

      {/* Role pill, bell and avatar: one row, all the same 36px height so
        nothing sits higher or lower than its neighbours. */}
      <div className="ml-auto flex items-center gap-2">
        {showRoleSwitcher && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex h-9 shrink-0 items-center gap-2 rounded-md border-neutral-300 text-neutral-900 hover:bg-neutral-100">
                <span className="text-xs font-semibold">Active Role: {user.role.replace('_', ' ')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48" align="end">
              <DropdownMenuLabel className="text-xs text-neutral-400">Switch Active Role</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleRoleChange('ADMIN')} className={user.role === 'ADMIN' ? 'font-bold text-neutral-900' : ''}>
                Admin
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRoleChange('ALUMNI_OFFICER')} className={user.role === 'ALUMNI_OFFICER' ? 'font-bold text-neutral-900' : ''}>
                Alumni Officer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRoleChange('PLACEMENT_OFFICER')} className={user.role === 'PLACEMENT_OFFICER' ? 'font-bold text-neutral-900' : ''}>
                Placement Officer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {notificationsHref && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(notificationsHref)}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            className="relative h-9 w-9 shrink-0 rounded-full text-neutral-500 hover:text-neutral-900"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-semibold leading-none text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 shrink-0 rounded-full p-0" aria-label="Account menu">
              {/* Initials only — no profile photo anywhere (see InitialsAvatar). */}
              <InitialsAvatar
                firstName={user.firstName}
                lastName={user.lastName}
                email={user.email}
                className="h-9 w-9 text-sm ring-1 ring-neutral-200"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72 p-2" align="end" forceMount>
            <DropdownMenuLabel className="px-2 py-2 font-normal">
              <div className="flex items-center gap-3">
                <InitialsAvatar
                  firstName={user.firstName}
                  lastName={user.lastName}
                  email={user.email}
                  className="h-10 w-10 text-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-snug text-neutral-900">{user.firstName} {user.lastName}</p>
                  {/* break-all so a long address wraps instead of being cut
                    off mid-domain; the wider menu fits it on one line. */}
                  <p className="mt-0.5 break-all text-xs leading-snug text-neutral-500">
                    {user.email}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* Profile exists only for student and mentor — admin,
              alumni-officer and placement-officer have no /profile route
              (see App.tsx), so showing it for them 404'd. Those roles
              still have Settings below. */}
            {(user.role === 'STUDENT' || user.role === 'MENTOR') && (
              <DropdownMenuItem onClick={() => router.push(`/app/${user.role.toLowerCase().replace('_', '-')}/profile`)}>
                Profile
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => router.push(`/app/${user.role.toLowerCase().replace('_', '-')}/settings`)}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              signOut();
              router.push('/');
            }}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

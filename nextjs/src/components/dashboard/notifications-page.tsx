'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck, RefreshCw, Inbox, AlertCircle, Calendar, CheckCircle2, XCircle, UserPlus, Briefcase, MessageSquare, ArrowUpRight, ShieldAlert, Target } from 'lucide-react';
import { notificationService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

// (Item 4, 2026-11-20) Every notification now shows proper details: who it
// is from (actorName), what happened (message), when (relative time, with
// the absolute time on hover), and a working link to the relevant place.
// The backend used to send `message` while this page read `body`, so the
// sentence rendered blank under every title — the page now reads
// `message ?? body`, and the backend also returns a `body` alias.
interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  message?: string;
  read: boolean;
  createdAt: string;
  actorName?: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/** "5m ago" / "3h ago" / "Yesterday" / "12 Nov" — absolute time stays on hover. */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const TYPE_ICONS: Record<string, any> = {
  NEW_REQUEST: UserPlus,
  REQUEST_ACCEPTED: CheckCircle2,
  REQUEST_DECLINED: XCircle,
  REQUEST_CANCELLED: XCircle,
  MENTORSHIP_REQUEST_CREATED: UserPlus,
  MENTORSHIP_REQUEST_ACCEPTED: CheckCircle2,
  MENTORSHIP_REQUEST_DECLINED: XCircle,
  MENTORSHIP_REQUEST_CANCELLED: XCircle,
  NEW_MESSAGE: MessageSquare,
  SESSION_SCHEDULED: Calendar,
  OPPORTUNITY: Briefcase,
  VERIFICATION: CheckCircle2,
  VERIFICATION_APPROVED: CheckCircle2,
  VERIFICATION_REJECTED: XCircle,
  VERIFICATION_CHANGES_REQUESTED: AlertCircle,
  PHONE_VERIFIED: CheckCircle2,
  NEW_ONBOARDING: ShieldAlert,
  GOAL_CREATED: Target,
};

const TYPE_COLORS: Record<string, string> = {
  NEW_REQUEST: 'bg-blue-50 text-blue-600',
  REQUEST_ACCEPTED: 'bg-emerald-50 text-emerald-600',
  REQUEST_DECLINED: 'bg-red-50 text-red-600',
  REQUEST_CANCELLED: 'bg-amber-50 text-amber-600',
  MENTORSHIP_REQUEST_CREATED: 'bg-blue-50 text-blue-600',
  MENTORSHIP_REQUEST_ACCEPTED: 'bg-emerald-50 text-emerald-600',
  MENTORSHIP_REQUEST_DECLINED: 'bg-red-50 text-red-600',
  MENTORSHIP_REQUEST_CANCELLED: 'bg-amber-50 text-amber-600',
  NEW_MESSAGE: 'bg-purple-50 text-purple-600',
  SESSION_SCHEDULED: 'bg-indigo-50 text-indigo-600',
  OPPORTUNITY: 'bg-neutral-100 text-neutral-700',
  VERIFICATION: 'bg-emerald-50 text-emerald-600',
  VERIFICATION_APPROVED: 'bg-emerald-50 text-emerald-600',
  VERIFICATION_REJECTED: 'bg-red-50 text-red-600',
  VERIFICATION_CHANGES_REQUESTED: 'bg-amber-50 text-amber-600',
  PHONE_VERIFIED: 'bg-emerald-50 text-emerald-600',
  NEW_ONBOARDING: 'bg-blue-50 text-blue-600',
  GOAL_CREATED: 'bg-indigo-50 text-indigo-600',
};

export function NotificationsPage({ allowedRoles }: { allowedRoles: string[] }) {
  const { allowed, user } = useRoleGuard(allowedRoles);
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await notificationService.getNotifications();
      setNotifications(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) {
    return <PageLoader message="Verifying access…" />;
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err: any) {
      setError(err.message || 'Failed to mark all read.');
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err: any) {
      setError(err.message || 'Failed to mark notification read.');
    }
  };

  // Opening a notification marks it read and takes the user to the real
  // place it is about (request, mentorship, message, verification). Rows
  // without a link just mark read.
  const handleOpen = (n: Notification) => {
    if (!n.read) void handleMarkRead(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Notifications"
        description="Stay on top of mentorship requests, verifications, and platform activity."
        icon={Bell}
        actions={
          <>
            <Button variant="outline" onClick={load} className="rounded-xl" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            {unreadCount > 0 && (
              <Button onClick={handleMarkAllRead} className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl" size="sm">
                <CheckCheck className="h-4 w-4 mr-2" /> Mark all read ({unreadCount})
              </Button>
            )}
          </>
        }
      />

      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'bg-neutral-900 text-white' : 'rounded-xl'}
        >
          All ({notifications.length})
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('unread')}
          className={filter === 'unread' ? 'bg-neutral-900 text-white' : 'rounded-xl'}
        >
          Unread ({unreadCount})
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl">
                  <div className="h-10 w-10 rounded-lg bg-gray-100 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded-full w-1/2 animate-pulse" />
                    <div className="h-3 bg-gray-100 rounded-full w-2/3 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <PageEmptyState
              message={filter === 'unread' ? "You're all caught up!" : 'No notifications yet'}
              hint={filter === 'unread' ? 'No unread notifications at the moment.' : 'Activity will appear here as it happens.'}
              icon={Inbox}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                const color = TYPE_COLORS[n.type] || 'bg-gray-50 text-gray-600';
                const body = n.message ?? n.body ?? '';
                return (
                  <div
                    key={n.id}
                    onClick={() => handleOpen(n)}
                    className={`flex items-start gap-4 p-4 border rounded-2xl transition-colors cursor-pointer ${
                      n.read ? 'border-gray-100 bg-white' : 'border-neutral-200 bg-neutral-100/30'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-semibold ${n.read ? 'text-lpu-text-secondary' : 'text-lpu-text-primary'}`}>
                          {n.title}
                        </h3>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-neutral-900 shrink-0" />}
                      </div>
                      {body && (
                        <p className={`text-sm mt-0.5 ${n.read ? 'text-lpu-text-secondary' : 'text-lpu-text-primary'}`}>
                          {body}
                        </p>
                      )}
                      <p className="text-xs text-lpu-text-muted mt-1" title={new Date(n.createdAt).toLocaleString()}>
                        {n.actorName ? <span className="font-medium text-lpu-text-secondary">{n.actorName} · </span> : null}
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                    {n.link && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-neutral-500">
                        View <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck, RefreshCw, Inbox, AlertCircle, Calendar, CheckCircle2, XCircle, UserPlus, Briefcase, MessageSquare } from 'lucide-react';
import { notificationService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
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
  OPPORTUNITY: 'bg-orange-50 text-orange-600',
  VERIFICATION: 'bg-emerald-50 text-emerald-600',
};

export function NotificationsPage({ allowedRoles }: { allowedRoles: string[] }) {
  const { allowed, user } = useRoleGuard(allowedRoles);
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
              <Button onClick={handleMarkAllRead} className="bg-lpu-orange hover:bg-lpu-orange/95 text-white rounded-xl" size="sm">
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
          className={filter === 'all' ? 'bg-lpu-orange text-white' : 'rounded-xl'}
        >
          All ({notifications.length})
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('unread')}
          className={filter === 'unread' ? 'bg-lpu-orange text-white' : 'rounded-xl'}
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
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.read && handleMarkRead(n.id)}
                    className={`flex items-start gap-4 p-4 border rounded-2xl transition-colors cursor-pointer ${
                      n.read ? 'border-gray-100 bg-white' : 'border-orange-100 bg-orange-50/30'
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
                        {!n.read && <span className="h-2 w-2 rounded-full bg-lpu-orange shrink-0" />}
                      </div>
                      <p className={`text-sm mt-0.5 ${n.read ? 'text-lpu-text-secondary' : 'text-lpu-text-primary'}`}>
                        {n.body}
                      </p>
                      <p className="text-xs text-lpu-text-muted mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
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

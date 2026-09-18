'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, RefreshCw, AlertCircle, Clock, Info } from 'lucide-react';
import { mentorService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function MentorAvailabilityPage() {
  const { allowed } = useRoleGuard(['MENTOR']);
  const [availability, setAvailability] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const me: any = await mentorService.getMyProfile();
      if (me?._id || me?.id) {
        const id = me._id || me.id;
        // Use the apiFetch under the hood via the mentors list (which has population)
        // For raw availability, fall back to fetching through the mentor profile if available
        // The frontend service does not expose getMentorAvailability directly; we reuse getMentorById
        const data = await mentorService.getMentorById(id);
        if (data && Array.isArray((data as any).availability)) {
          setAvailability((data as any).availability);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load availability.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Availability"
        description="Time slots when you're available for mentorship sessions."
        icon={Calendar}
        actions={
          <Button variant="outline" onClick={load} size="sm" className="rounded-xl">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />

      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-900">
              Manage your weekly availability windows. Students can only request sessions during the slots you set here.
            </p>
          </div>
        </CardContent>
      </Card>

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
        <CardHeader>
          <CardTitle>Weekly Slots</CardTitle>
          <CardDescription>{availability.length} slot{availability.length === 1 ? '' : 's'} configured</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading availability…" />
          ) : availability.length === 0 ? (
            <PageEmptyState
              message="No availability configured"
              hint="Update your profile to add weekly time slots for mentees to book."
              icon={Calendar}
            />
          ) : (
            <div className="space-y-2">
              {availability.map((slot: any, idx: number) => (
                <div key={slot._id || slot.id || idx} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{slot.dayOfWeek || 'Day'}</p>
                    <p className="text-xs text-lpu-text-secondary">
                      {slot.startTime || '—'} – {slot.endTime || '—'}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    {slot.status || 'Available'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

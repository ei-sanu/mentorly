'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, RefreshCw, AlertCircle, Clock, Info, Trash2, CalendarOff } from 'lucide-react';
import { mentorService } from '@/services/api';
import type { AvailabilitySlot, MentorLeave } from '@/types';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

// ─── Mentor availability + leave (2026-11-20, Item 5) ──────────────────────
// The old page could never show anything: it read `(data as any)
// .availability` (singular) from GET /mentors/:id, whose response never
// contains availability at all. load() now reads the real endpoints —
// GET /mentors/me/availability (own rows) + GET /mentors/me/leaves — and
// the page can add/delete slots and leaves. Weekday numbers render as
// weekday NAMES (0 = Sunday … 6 = Saturday), never the raw number.
// The old copy ("Students can only request sessions during the slots you
// set here") was false — nothing enforces slots — so it now says the
// truth: slots are a guide students see on the profile, and leave dates
// block new requests and sessions.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

function formatLeaveDate(iso: string): string {
  return new Date(String(iso).slice(0, 10)).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MentorAvailabilityPage() {
  const { allowed } = useRoleGuard(['MENTOR']);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [leaves, setLeaves] = useState<MentorLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add-slot form.
  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState('10:00');
  const [newEnd, setNewEnd] = useState('11:00');
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);

  // Add-leave form.
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [deletingLeaveId, setDeletingLeaveId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [slots, ownLeaves] = await Promise.all([
        mentorService.getMyAvailability(),
        mentorService.getMyLeaves(),
      ]);
      setAvailability(Array.isArray(slots) ? slots : []);
      setLeaves(Array.isArray(ownLeaves) ? ownLeaves : []);
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

  const handleAddSlot = async () => {
    if (!newStart || !newEnd) {
      setSlotError('Choose a start and end time.');
      return;
    }
    if (newEnd <= newStart) {
      setSlotError('End time must be after start time.');
      return;
    }
    setSlotSaving(true);
    setSlotError(null);
    try {
      await mentorService.addAvailability({
        dayOfWeek: newDay,
        startTime: newStart,
        endTime: newEnd,
        timezone: DEFAULT_TIMEZONE,
      });
      setNewStart('10:00');
      setNewEnd('11:00');
      await load();
    } catch (err: any) {
      setSlotError(err.message || 'Could not add this slot.');
    } finally {
      setSlotSaving(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    setDeletingSlotId(slotId);
    try {
      await mentorService.deleteAvailability(slotId);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not delete this slot.');
    } finally {
      setDeletingSlotId(null);
    }
  };

  const handleAddLeave = async () => {
    if (!leaveStart || !leaveEnd) {
      setLeaveError('Choose a start and end date.');
      return;
    }
    if (leaveEnd < leaveStart) {
      setLeaveError('End date must be on or after the start date.');
      return;
    }
    setLeaveSaving(true);
    setLeaveError(null);
    try {
      await mentorService.addLeave({
        startDate: leaveStart,
        endDate: leaveEnd,
        ...(leaveReason.trim() ? { reason: leaveReason.trim() } : {}),
      });
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
      await load();
    } catch (err: any) {
      setLeaveError(err.message || 'Could not add this leave.');
    } finally {
      setLeaveSaving(false);
    }
  };

  const handleDeleteLeave = async (leaveId: string) => {
    setDeletingLeaveId(leaveId);
    try {
      await mentorService.deleteLeave(leaveId);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not delete this leave.');
    } finally {
      setDeletingLeaveId(null);
    }
  };

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
              Students see your weekly slots on your profile. Sessions are still booked per mentorship — slots are a guide, and leave dates block new requests and sessions.
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
              hint="Add a weekly slot below — students see your slots on your profile."
              icon={Calendar}
            />
          ) : (
            <div className="space-y-2">
              {availability.map((slot) => (
                <div key={slot.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{DAY_NAMES[slot.dayOfWeek] ?? 'Day'}</p>
                    <p className="text-xs text-lpu-text-secondary">
                      {slot.startTime} – {slot.endTime} · {slot.timezone || DEFAULT_TIMEZONE}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSlot(slot.id)}
                    disabled={deletingSlotId === slot.id}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingSlotId === slot.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 border-t border-gray-100 pt-5">
            <h4 className="text-sm font-medium mb-3">Add a weekly slot</h4>
            {slotError && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{slotError}</span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex-1">
                <span className="mb-1 block text-xs font-medium text-lpu-text-muted">Day</span>
                <select
                  value={newDay}
                  onChange={(e) => setNewDay(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-lpu-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  {DAY_NAMES.map((name, i) => (
                    <option key={name} value={i}>{name}</option>
                  ))}
                </select>
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-xs font-medium text-lpu-text-muted">Starts</span>
                <input
                  type="time"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="h-10 w-full rounded-xl border border-lpu-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-xs font-medium text-lpu-text-muted">Ends</span>
                <input
                  type="time"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="h-10 w-full rounded-xl border border-lpu-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </label>
              <div className="flex items-end">
                <Button onClick={handleAddSlot} disabled={slotSaving} className="w-full sm:w-auto">
                  {slotSaving ? 'Adding…' : 'Add slot'}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-lpu-text-muted">Timezone: {DEFAULT_TIMEZONE}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-neutral-900" /> Leave
          </CardTitle>
          <CardDescription>
            Dates you’re away. Leave blocks new requests and sessions, and students see it on your profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading leave…" />
          ) : leaves.length === 0 ? (
            <PageEmptyState
              message="No leave set"
              hint="Add leave below when you’ll be away — students will see it before requesting."
              icon={CalendarOff}
            />
          ) : (
            <div className="space-y-2">
              {leaves.map((leave) => (
                <div key={leave.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                  <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                    <CalendarOff className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {formatLeaveDate(leave.startDate)} – {formatLeaveDate(leave.endDate)}
                    </p>
                    {leave.reason && (
                      <p className="text-xs text-lpu-text-secondary">{leave.reason}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    On leave
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteLeave(leave.id)}
                    disabled={deletingLeaveId === leave.id}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingLeaveId === leave.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 border-t border-gray-100 pt-5">
            <h4 className="text-sm font-medium mb-3">Add leave</h4>
            {leaveError && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{leaveError}</span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex-1">
                <span className="mb-1 block text-xs font-medium text-lpu-text-muted">From</span>
                <input
                  type="date"
                  value={leaveStart}
                  onChange={(e) => setLeaveStart(e.target.value)}
                  className="h-10 w-full rounded-xl border border-lpu-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-xs font-medium text-lpu-text-muted">Until</span>
                <input
                  type="date"
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                  className="h-10 w-full rounded-xl border border-lpu-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-xs font-medium text-lpu-text-muted">Reason (optional)</span>
                <input
                  type="text"
                  value={leaveReason}
                  maxLength={200}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="e.g. Travelling"
                  className="h-10 w-full rounded-xl border border-lpu-border bg-white px-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </label>
              <div className="flex items-end">
                <Button onClick={handleAddLeave} disabled={leaveSaving} className="w-full sm:w-auto">
                  {leaveSaving ? 'Adding…' : 'Add leave'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

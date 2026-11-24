'use client';

import { NotificationsPage } from '@/components/dashboard/notifications-page';

export default function AlumniOfficerNotificationsPage() {
  return <NotificationsPage allowedRoles={['ALUMNI_OFFICER']} />;
}

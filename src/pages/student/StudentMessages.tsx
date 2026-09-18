'use client';

import { MessagesPage } from '@/components/dashboard/messages-page';

export default function StudentMessagesPage() {
  return <MessagesPage allowedRoles={['STUDENT']} />;
}

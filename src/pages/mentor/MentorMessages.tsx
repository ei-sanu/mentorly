'use client';

import { MessagesPage } from '@/components/dashboard/messages-page';

export default function MentorMessagesPage() {
  return <MessagesPage allowedRoles={['MENTOR']} />;
}

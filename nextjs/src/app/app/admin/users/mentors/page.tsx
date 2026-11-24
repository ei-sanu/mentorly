'use client';

import { UsersListView } from '@/components/dashboard/users-list-view';

export default function AdminMentorsPage() {
  return (
    <UsersListView
      roleFilter="MENTOR"
      title="Mentors"
      description="Manage all mentor accounts on the platform."
    />
  );
}

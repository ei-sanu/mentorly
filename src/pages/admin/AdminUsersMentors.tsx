'use client';

import { UsersListView } from './users-list-view';

export default function AdminMentorsPage() {
  return (
    <UsersListView
      roleFilter="MENTOR"
      title="Mentors"
      description="Manage all mentor accounts on the platform."
    />
  );
}

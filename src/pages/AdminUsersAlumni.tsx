'use client';

import { UsersListView } from '@/components/dashboard/users-list-view';

export default function AdminAlumniPage() {
  return (
    <UsersListView
      roleFilter="ALUMNI"
      title="Alumni"
      description="Manage all alumni accounts on the platform."
    />
  );
}

'use client';

import { UsersListView } from '@/components/dashboard/users-list-view';

export default function AdminAllUsersPage() {
  return (
    <UsersListView
      title="All Users"
      description="View and manage every registered account on the platform."
    />
  );
}

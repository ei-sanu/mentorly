'use client';

import { UsersListView } from '@/components/dashboard/users-list-view';

export default function AdminStudentsPage() {
  return (
    <UsersListView
      roleFilter="STUDENT"
      title="Students"
      description="Manage all student accounts on the platform."
    />
  );
}

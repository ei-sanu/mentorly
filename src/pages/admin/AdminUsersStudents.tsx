'use client';

import { UsersListView } from './users-list-view';

export default function AdminStudentsPage() {
  return (
    <UsersListView
      roleFilter="STUDENT"
      title="Students"
      description="Manage all student accounts on the platform."
    />
  );
}

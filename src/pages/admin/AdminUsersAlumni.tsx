'use client';

import { UsersListView } from './users-list-view';

export default function AdminAlumniPage() {
  return (
    <UsersListView
      roleFilter="ALUMNI"
      title="Alumni"
      description="Manage all alumni accounts on the platform."
    />
  );
}

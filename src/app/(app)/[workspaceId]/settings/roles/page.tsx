import type { Metadata } from 'next';
import RolesPage from '@/features/settings/components/roles';

export const metadata: Metadata = { title: 'Roles Â· Settings Â· Flux' };

export default function WorkspaceRolesPage() {
  return <RolesPage />;
}

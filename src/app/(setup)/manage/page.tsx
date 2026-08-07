import type { Metadata } from 'next';
import { ManageWorkspaces } from '@/features/workspaces';

export const metadata: Metadata = {
  title: 'Manage Workspaces · Flux',
};

export default function ManageWorkspacesPage() {
  return <ManageWorkspaces />;
}

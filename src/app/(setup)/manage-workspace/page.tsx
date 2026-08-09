import type { Metadata } from 'next';
import { ManageWorkspacesPage } from '@/features/setup';

export const metadata: Metadata = {
  title: 'Manage Workspaces · Flux',
};

export default function Page() {
  return <ManageWorkspacesPage />;
}

import type { Metadata } from 'next';
import ManageWorkspacesPage from '@/features/setup/pages/manage-workspaces-page';

export const metadata: Metadata = {
  title: 'Manage Workspaces · Flux',
};

export default function Page() {
  return <ManageWorkspacesPage />;
}

import type { Metadata } from 'next';
import ViewsPage from '@/features/workspaces/projects/project-id/settings/pages/ViewsPage';

export const metadata: Metadata = { title: 'Saved Views · Flux' };

export default function Page() {
  return <ViewsPage />;
}

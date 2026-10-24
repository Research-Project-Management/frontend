import type { Metadata } from 'next';
import WorkspaceViewsPage from '@/features/projects/shell/pages/WorkspaceViewsPage';

export const metadata: Metadata = {
  title: 'Views · Flux',
  description: 'Workspace views and cross-project custom filters.',
};

export default function ProjectsViewsRoute() {
  return <WorkspaceViewsPage />;
}

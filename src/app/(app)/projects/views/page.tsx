import type { Metadata } from 'next';
import { Suspense } from 'react';
import WorkspaceViewsPage from '@/features/projects/shell/pages/WorkspaceViewsPage';

export const metadata: Metadata = {
  title: 'Views · Flux',
  description: 'Workspace views and cross-project custom filters.',
};

export default function ProjectsViewsRoute() {
  return (
    <Suspense fallback={null}>
      <WorkspaceViewsPage />
    </Suspense>
  );
}

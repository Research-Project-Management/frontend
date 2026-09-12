import type { Metadata } from 'next';
import { Suspense } from 'react';
import WorkItemPage from '@/features/workspaces/projects/project-id/work-items/pages/WorkItemPage';

export const metadata: Metadata = {
  title: 'View · Flux',
  description: 'Saved view for project work items.',
};

export default function ProjectViewDetailRoute() {
  return (
    <Suspense fallback={null}>
      <WorkItemPage />
    </Suspense>
  );
}

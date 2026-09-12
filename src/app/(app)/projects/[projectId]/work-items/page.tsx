import type { Metadata } from 'next';
import { Suspense } from 'react';
import WorkItemPage from '@/features/workspaces/projects/project-id/work-items/pages/WorkItemPage';

export const metadata: Metadata = { title: 'Work Items · Flux' };

export default function WorkItemsRoute() {
  return (
    <Suspense fallback={null}>
      <WorkItemPage />
    </Suspense>
  );
}

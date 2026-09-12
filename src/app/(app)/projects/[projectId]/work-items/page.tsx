import type { Metadata } from 'next';
import { Suspense } from 'react';
import Page from '@/features/workspaces/projects/project-id/work-items/pages/Page';

export const metadata: Metadata = { title: 'Work Items · Flux' };

export default function WorkItemsRoute() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}

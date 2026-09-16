import type { Metadata } from 'next';
import { Suspense } from 'react';
import WorkspaceCyclesPage from '@/features/projects/shell/pages/WorkspaceCyclesPage';

export const metadata: Metadata = {
  title: 'Cycles · Flux',
  description: 'Workspace sprint tracking and agile cycles dashboard.',
};

export default function ProjectsCyclesRoute() {
  return (
    <Suspense fallback={null}>
      <WorkspaceCyclesPage />
    </Suspense>
  );
}

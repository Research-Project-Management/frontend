import type { Metadata } from 'next';
import { Suspense } from 'react';
import WorkspacePagesPage from '@/features/projects/shell/pages/WorkspacePagesPage';

export const metadata: Metadata = {
  title: 'Pages · Flux',
  description: 'Workspace documents, research wiki, and knowledge library.',
};

export default function ProjectsPagesRoute() {
  return (
    <Suspense fallback={null}>
      <WorkspacePagesPage />
    </Suspense>
  );
}

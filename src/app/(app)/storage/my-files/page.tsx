import type { Metadata } from 'next';
import { Suspense } from 'react';
import WorkspaceMyFilesPage from '@/features/workspaces/storage/pages/MyFilesPage';

export const metadata: Metadata = { title: 'My Files · Storage · Flux' };

export default function WorkspaceStorageMyFilesPage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceMyFilesPage />
    </Suspense>
  );
}

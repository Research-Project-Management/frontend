import type { Metadata } from 'next';
import { Suspense } from 'react';
import WorkspaceMyFilesPage from '@/features/workspaces/storage/pages/MyFilesPage';

export const metadata: Metadata = { title: 'Folder · Storage · Flux' };

export default function WorkspaceStorageFolderPage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceMyFilesPage />
    </Suspense>
  );
}

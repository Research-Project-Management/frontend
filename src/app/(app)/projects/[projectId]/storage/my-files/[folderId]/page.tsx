import type { Metadata } from 'next';
import { Suspense } from 'react';
import MyFilesPage from '@/features/workspaces/projects/project-id/storage/pages/MyFilesPage';

export const metadata: Metadata = { title: 'Folder · Storage · Flux' };

export default function ProjectStorageFolderPage() {
  return (
    <Suspense fallback={null}>
      <MyFilesPage />
    </Suspense>
  );
}

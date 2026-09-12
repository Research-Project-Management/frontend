import type { Metadata } from 'next';
import { Suspense } from 'react';
import MyFilesPage from '@/features/workspaces/storage/pages/MyFilesPage';

export const metadata: Metadata = { title: 'Folder · Storage · Flux' };

export default function StorageFolderPage() {
  return (
    <Suspense fallback={null}>
      <MyFilesPage />
    </Suspense>
  );
}

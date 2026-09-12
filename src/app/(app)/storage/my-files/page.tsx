import type { Metadata } from 'next';
import { Suspense } from 'react';
import MyFilesPage from '@/features/workspaces/storage/pages/MyFilesPage';

export const metadata: Metadata = { title: 'My Files · Storage · Flux' };

export default function StorageMyFilesPage() {
  return (
    <Suspense fallback={null}>
      <MyFilesPage />
    </Suspense>
  );
}

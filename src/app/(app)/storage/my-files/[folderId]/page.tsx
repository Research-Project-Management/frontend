import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomePage from '@/features/storage/pages/HomePage';

export const metadata: Metadata = { title: 'Folder · Storage · Flux' };

export default async function StorageFolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  return (
    <Suspense fallback={null}>
      <HomePage initialSection="my-files" initialFolderId={folderId} />
    </Suspense>
  );
}

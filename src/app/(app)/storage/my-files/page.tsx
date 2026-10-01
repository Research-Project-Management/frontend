import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomePage from '@/features/storage/pages/HomePage';

export const metadata: Metadata = { title: 'My Files · Storage · Flux' };

export default function StorageMyFilesPage() {
  return (
    <Suspense fallback={null}>
      <HomePage initialSection="my-files" />
    </Suspense>
  );
}

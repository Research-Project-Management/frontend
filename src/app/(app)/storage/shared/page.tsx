import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomePage from '@/features/storage/pages/HomePage';

export const metadata: Metadata = { title: 'Shared · Storage · Flux' };

export default function StorageSharedPage() {
  return (
    <Suspense fallback={null}>
      <HomePage initialSection="shared" />
    </Suspense>
  );
}

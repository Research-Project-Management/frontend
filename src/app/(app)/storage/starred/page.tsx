import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomePage from '@/features/storage/pages/HomePage';

export const metadata: Metadata = { title: 'Starred · Storage · Flux' };

export default function StorageStarredPage() {
  return (
    <Suspense fallback={null}>
      <HomePage initialSection="starred" />
    </Suspense>
  );
}

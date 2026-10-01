import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomePage from '@/features/storage/pages/HomePage';

export const metadata: Metadata = { title: 'Trash · Storage · Flux' };

export default function StorageTrashPage() {
  return (
    <Suspense fallback={null}>
      <HomePage initialSection="trash" />
    </Suspense>
  );
}

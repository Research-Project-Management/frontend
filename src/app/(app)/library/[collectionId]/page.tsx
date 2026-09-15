import type { Metadata } from 'next';
import { Suspense } from 'react';
import LibraryPage from '@/features/library/pages/LibraryPage';

export const metadata: Metadata = { title: 'Collection · Library · Flux' };

export default function LibraryCollectionPage() {
  return (
    <Suspense fallback={null}>
      <LibraryPage />
    </Suspense>
  );
}

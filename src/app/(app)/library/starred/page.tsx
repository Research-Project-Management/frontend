import type { Metadata } from 'next';
import { Suspense } from 'react';
import LibraryPage from '@/features/library/pages/LibraryPage';

export const metadata: Metadata = { title: 'Starred Items · Library · Flux' };

export default function LibraryStarredPage() {
  return (
    <Suspense fallback={null}>
      <LibraryPage />
    </Suspense>
  );
}

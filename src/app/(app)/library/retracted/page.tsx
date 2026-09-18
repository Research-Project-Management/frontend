import type { Metadata } from 'next';
import { Suspense } from 'react';
import LibraryPage from '@/features/library/pages/LibraryPage';

export const metadata: Metadata = { title: 'Retracted Items · Library · Flux' };

export default function LibraryRetractedPage() {
  return (
    <Suspense fallback={null}>
      <LibraryPage />
    </Suspense>
  );
}

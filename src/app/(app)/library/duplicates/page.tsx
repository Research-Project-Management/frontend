import type { Metadata } from 'next';
import { Suspense } from 'react';
import DuplicatesPage from '@/features/workspaces/library/pages/DuplicatesPage';

export const metadata: Metadata = { title: 'Duplicate Items · Library · Flux' };

export default function LibraryDuplicatesPage() {
  return (
    <Suspense fallback={null}>
      <DuplicatesPage />
    </Suspense>
  );
}

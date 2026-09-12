import type { Metadata } from 'next';
import { Suspense } from 'react';
import LibraryPage from '@/features/workspaces/library/pages/LibraryPage';

export const metadata: Metadata = { title: 'Library · Flux' };

export default function LibraryIndexPage() {
  return (
    <Suspense fallback={null}>
      <LibraryPage />
    </Suspense>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ModernLibraryPage } from '@/features/library';

export const metadata: Metadata = { title: 'Starred Items · Library · Flux' };

export default function LibraryStarredPage() {
  return (
    <Suspense fallback={null}>
      <ModernLibraryPage view="starred" title="Starred Items" />
    </Suspense>
  );
}

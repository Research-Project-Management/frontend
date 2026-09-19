import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ModernLibraryPage } from '@/features/library';

export const metadata: Metadata = { title: 'Collection · Library · Flux' };

export default function LibraryCollectionPage() {
  return (
    <Suspense fallback={null}>
      <ModernLibraryPage />
    </Suspense>
  );
}

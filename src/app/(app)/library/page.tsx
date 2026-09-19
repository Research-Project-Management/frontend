import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ModernLibraryPage } from '@/features/library';

export const metadata: Metadata = { title: 'Library · Flux' };

export default function LibraryIndexPage() {
  return (
    <Suspense fallback={null}>
      <ModernLibraryPage />
    </Suspense>
  );
}

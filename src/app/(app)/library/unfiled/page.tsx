import type { Metadata } from 'next';
import { Suspense } from 'react';
import { UnfiledPage } from '@/features/library';

export const metadata: Metadata = { title: 'Unfiled Items · Library · Flux' };

export default function LibraryUnfiledPage() {
  return (
    <Suspense fallback={null}>
      <UnfiledPage />
    </Suspense>
  );
}

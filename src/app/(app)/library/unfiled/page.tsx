import type { Metadata } from 'next';
import { Suspense } from 'react';
import UnfiledPage from '@/features/workspaces/library/pages/UnfiledPage';

export const metadata: Metadata = { title: 'Unfiled Items · Library · Flux' };

export default function LibraryUnfiledPage() {
  return (
    <Suspense fallback={null}>
      <UnfiledPage />
    </Suspense>
  );
}

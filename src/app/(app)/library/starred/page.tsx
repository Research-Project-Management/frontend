import AppLoading from '@/app/(app)/loading';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ModernLibraryPage } from '@/features/library/pages/LibraryPage';

export const metadata: Metadata = { title: 'Starred Items · Library · Flux' };

export default function LibraryStarredPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <ModernLibraryPage view="starred" title="Starred Items" />
    </Suspense>
  );
}

import AppLoading from '@/app/(app)/loading';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ModernLibraryPage } from '@/features/library/pages/LibraryPage';

export const metadata: Metadata = { title: 'Collection · Library · Flux' };

export default function LibraryCollectionPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <ModernLibraryPage />
    </Suspense>
  );
}

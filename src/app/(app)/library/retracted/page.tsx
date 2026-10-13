import AppLoading from '@/app/(app)/loading';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ModernLibraryPage } from '@/features/library/pages/LibraryPage';

export const metadata: Metadata = { title: 'Retracted Items · Library · Flux' };

export default function LibraryRetractedPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <ModernLibraryPage view="retracted" title="Retracted Items" />
    </Suspense>
  );
}

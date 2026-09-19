import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ModernLibraryPage } from '@/features/library';

export const metadata: Metadata = { title: 'Retracted Items · Library · Flux' };

export default function LibraryRetractedPage() {
  return (
    <Suspense fallback={null}>
      <ModernLibraryPage view="retracted" title="Retracted Items" />
    </Suspense>
  );
}

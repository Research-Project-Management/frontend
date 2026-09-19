import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ModernLibraryPage } from '@/features/library';

export const metadata: Metadata = { title: 'My Publications · Library · Flux' };

export default function LibraryMyPublicationsPage() {
  return (
    <Suspense fallback={null}>
      <ModernLibraryPage view="my-publications" title="My Publications" />
    </Suspense>
  );
}

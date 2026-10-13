import AppLoading from '@/app/(app)/loading';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ModernLibraryPage } from '@/features/library/pages/LibraryPage';

export const metadata: Metadata = { title: 'My Publications · Library · Flux' };

export default function LibraryMyPublicationsPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <ModernLibraryPage view="my-publications" title="My Publications" />
    </Suspense>
  );
}

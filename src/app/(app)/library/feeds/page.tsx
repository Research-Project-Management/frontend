import AppLoading from '@/app/(app)/loading';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FeedPageContent } from '@/features/library/ui/pages/FeedPageContent';

export const metadata: Metadata = { title: 'Feeds · Library · Flux' };

export default function LibraryFeedsPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <FeedPageContent />
    </Suspense>
  );
}

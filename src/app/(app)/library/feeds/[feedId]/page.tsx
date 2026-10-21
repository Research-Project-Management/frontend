import AppLoading from '@/app/(app)/loading';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FeedPageContent } from '@/features/library/ui/pages/FeedPageContent';

export const metadata: Metadata = { title: 'Feed · Library · Flux' };

export default async function LibraryFeedDetailPage({
  params,
}: {
  params: Promise<{ feedId: string }>;
}) {
  const { feedId } = await params;
  return (
    <Suspense fallback={<AppLoading />}>
      <FeedPageContent feedId={feedId} />
    </Suspense>
  );
}

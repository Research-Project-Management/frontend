import type { Metadata } from 'next';
import { LibraryPage } from '@/features/library/ui/pages/LibraryPage';

export const metadata: Metadata = { title: 'Feed · Library · Flux' };

export default async function LibraryFeedDetailPage({
  params,
}: {
  params: Promise<{ feedId: string }>;
}) {
  const { feedId } = await params;
  return <LibraryPage view="feed" feedId={feedId} />;
}

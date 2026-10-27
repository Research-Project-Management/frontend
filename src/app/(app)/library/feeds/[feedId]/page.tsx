import type { Metadata } from 'next';
import { ModernLibraryPage } from '@/features/library/ui/pages/LibraryPage';

export const metadata: Metadata = { title: 'Feed · Library · Flux' };

export default async function LibraryFeedDetailPage({
  params,
}: {
  params: Promise<{ feedId: string }>;
}) {
  const { feedId } = await params;
  return <ModernLibraryPage view="feed" feedId={feedId} />;
}

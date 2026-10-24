import type { Metadata } from 'next';
import { FeedPageContent } from '@/features/library/ui/pages/FeedPageContent';

export const metadata: Metadata = { title: 'Feeds · Library · Flux' };

export default function LibraryFeedsPage() {
  return <FeedPageContent />;
}

import type { Metadata } from 'next';
import { LibraryPage } from '@/features/library/ui/pages/LibraryPage';

export const metadata: Metadata = { title: 'Feeds · Library · Flux' };

export default function LibraryFeedsPage() {
  return <LibraryPage view="feed" />;
}

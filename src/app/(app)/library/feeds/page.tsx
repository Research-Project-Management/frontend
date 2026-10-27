import type { Metadata } from 'next';
import { ModernLibraryPage } from '@/features/library/ui/pages/LibraryPage';

export const metadata: Metadata = { title: 'Feeds · Library · Flux' };

export default function LibraryFeedsPage() {
  return <ModernLibraryPage view="feed" />;
}

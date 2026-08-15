import type { Metadata } from 'next';
import { RecentlyReadPage } from '@/features/workspaces/library';

export const metadata: Metadata = { title: 'Recently Read · Library · Flux' };

export default function LibraryRecentlyReadPage() {
  return <RecentlyReadPage />;
}

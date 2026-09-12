import type { Metadata } from 'next';
import { Suspense } from 'react';
import RecentlyReadPage from '@/features/workspaces/library/pages/RecentlyReadPage';

export const metadata: Metadata = { title: 'Recently Read · Library · Flux' };

export default function LibraryRecentlyReadPage() {
  return (
    <Suspense fallback={null}>
      <RecentlyReadPage />
    </Suspense>
  );
}

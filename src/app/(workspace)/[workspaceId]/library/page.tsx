import type { Metadata } from 'next';
import LibraryPage from '@/features/workspaces/library/pages/LibraryPage';

export const metadata: Metadata = { title: 'Library · Flux' };

export default function LibraryIndexPage() {
  return <LibraryPage />;
}

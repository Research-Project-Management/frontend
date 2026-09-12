import type { Metadata } from 'next';
import StarredPage from '@/features/workspaces/storage/pages/StarredPage';

export const metadata: Metadata = { title: 'Starred · Storage · Flux' };

export default function StorageStarredPage() {
  return <StarredPage />;
}

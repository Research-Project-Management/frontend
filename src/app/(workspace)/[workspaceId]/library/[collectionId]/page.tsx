import type { Metadata } from 'next';
import CollectionDetailPage from '@/features/workspaces/library/pages/CollectionDetailPage';

export const metadata: Metadata = { title: 'Collection · Library · Flux' };

export default function LibraryCollectionPage() {
  return <CollectionDetailPage />;
}

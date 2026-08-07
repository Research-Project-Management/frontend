import type { Metadata } from 'next';
import { CollectionDetailPage } from '@/features/library';

export const metadata: Metadata = { title: 'Collection · Library · Flux' };

export default function LibraryCollectionPage() {
  return <CollectionDetailPage />;
}

import type { Metadata } from 'next';
import { LibraryPage } from '@/features/workspaces/library';

export const metadata: Metadata = { title: 'Collection · Library · Flux' };

export default function LibraryCollectionPage() {
  return <LibraryPage />;
}

import type { Metadata } from 'next';
import { LibraryPage } from '@/features/library/ui/pages/LibraryPage';

export const metadata: Metadata = { title: 'Collection · Library' };

export default function LibraryCollectionPage() {
  return <LibraryPage />;
}

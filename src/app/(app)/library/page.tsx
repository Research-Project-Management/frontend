import type { Metadata } from 'next';
import { LibraryPage } from '@/features/library/ui/pages/LibraryPage';

export const metadata: Metadata = { title: 'Library' };

export default function LibraryIndexPage() {
  return <LibraryPage />;
}

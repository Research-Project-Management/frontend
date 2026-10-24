import type { Metadata } from 'next';
import { ModernLibraryPage } from '@/features/library/ui/pages/LibraryPage';

export const metadata: Metadata = { title: 'Collection · Library · Flux' };

export default function LibraryCollectionPage() {
  return <ModernLibraryPage />;
}

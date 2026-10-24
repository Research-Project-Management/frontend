import type { Metadata } from 'next';
import { ModernLibraryPage } from '@/features/library/ui/pages/LibraryPage';

export const metadata: Metadata = { title: 'Library · Flux' };

export default function LibraryIndexPage() {
  return <ModernLibraryPage />;
}

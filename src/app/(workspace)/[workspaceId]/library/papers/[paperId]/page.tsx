import type { Metadata } from 'next';
import ReaderPage from '@/features/workspaces/library/pages/ReaderPage';

export const metadata: Metadata = { title: 'Paper Reader · Flux' };

export default function LibraryPaperPage() {
  return <ReaderPage />;
}

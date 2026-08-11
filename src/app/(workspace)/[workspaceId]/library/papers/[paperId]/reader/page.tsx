import type { Metadata } from 'next';
import PaperReaderPage from '@/features/workspaces/library/pages/PaperReaderPage';

export const metadata: Metadata = { title: 'Paper Reader · Flux' };

export default function LibraryPaperReaderPage() {
  return <PaperReaderPage />;
}

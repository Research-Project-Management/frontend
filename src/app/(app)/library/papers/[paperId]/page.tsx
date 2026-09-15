import type { Metadata } from 'next';
import ReaderPage from '@/features/reader/pages/ReaderPage';

export const metadata: Metadata = { title: 'Paper Reader · Flux' };

export default async function LibraryPaperPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const resolvedParams = await params;
  return <ReaderPage paperId={resolvedParams.paperId} />;
}

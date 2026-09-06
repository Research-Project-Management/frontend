import type { Metadata } from 'next';
import ReaderPage from '@/features/workspaces/reader/pages/ReaderPage';

export const metadata: Metadata = { title: 'Paper Reader · Flux' };

export default async function LibraryPaperPage({
  params,
}: {
  params: Promise<{ workspaceId: string; paperId: string }>;
}) {
  const resolvedParams = await params;
  return <ReaderPage paperId={resolvedParams.paperId} />;
}

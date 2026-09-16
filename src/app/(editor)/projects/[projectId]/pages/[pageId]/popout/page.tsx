import type { Metadata } from 'next';
import StandaloneViewerPage from '@/features/editor/pages/StandaloneViewerPage';

export const metadata: Metadata = { title: 'PDF Preview · Flux' };

export default function ProjectPopoutViewerPageWrapper() {
  return <StandaloneViewerPage />;
}

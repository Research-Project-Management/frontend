import type { Metadata } from 'next';
import ClientStandaloneViewer from '@/features/editor/pages/ClientStandaloneViewer';

export const metadata: Metadata = { title: 'PDF Preview · Flux' };

export default function PopoutViewerPageWrapper() {
  return <ClientStandaloneViewer />;
}

import type { Metadata } from 'next';
import { DetachedPdfViewer } from '@/features/editor/subsystems/compiler';

export const metadata: Metadata = { title: 'PDF Preview' };

export default function DetachedPdfPreviewPage() {
  return <DetachedPdfViewer />;
}

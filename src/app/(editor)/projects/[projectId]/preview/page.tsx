'use client';

import { useEffect } from 'react';
import { DetachedPdfViewer } from '@/features/editor/subsystems/compiler/ui/pdf/DetachedViewer';

export default function DetachedPdfPreviewPage() {
  useEffect(() => {
    document.title = 'PDF Preview · Flux';
  }, []);

  return <DetachedPdfViewer />;
}

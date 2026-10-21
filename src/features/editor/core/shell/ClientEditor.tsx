'use client';

/**
 * ClientEditor.tsx
 *
 * Dynamic Client-only wrapper for Next.js SSR avoidance.
 * Location: `features/editor/ui/shell/ClientEditor.tsx`
 */

import dynamic from 'next/dynamic';
import React, { useEffect } from 'react';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { sessionCoordinator } from '@/features/editor/core';
import EditorSkeleton from './EditorSkeleton';

const ModernWorkbenchLayout = dynamic(
  () => import('./ModernWorkbenchLayout'),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  },
);

export default function ClientEditor() {
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
    const unsubBeforeUnload = sessionCoordinator.initBeforeUnloadProtection();
    return () => {
      unsubBeforeUnload();
    };
  }, []);

  if (!mounted) {
    return <EditorSkeleton />;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <ModernWorkbenchLayout />
    </TooltipProvider>
  );
}

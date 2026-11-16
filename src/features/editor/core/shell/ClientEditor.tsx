'use client';

/**
 * ClientEditor.tsx
 *
 * Dynamic Client-only wrapper for Next.js SSR avoidance.
 * Location: `features/editor/core/shell/ClientEditor.tsx`
 */

import dynamic from 'next/dynamic';
import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { useSafeQueryClient } from '@/features/editor/subsystems/review/ui/hooks/safeQueryClient';
import { editorBootstrapQuery } from '@/features/editor/ui/hooks/document.queries';
import { sessionCoordinator } from '../coordinator/session.coordinator';
import EditorSkeleton from './EditorSkeleton';

const WorkbenchLayout = dynamic(
  () => import('./WorkbenchLayout'),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  },
);

export default function ClientEditor() {
  const params = useParams<{
    id?: string;
    projectId?: string;
    pageId?: string;
    draftId?: string;
  }>();
  const searchParams = useSearchParams();
  const queryClient = useSafeQueryClient();

  const directPageId = params?.pageId || params?.id || params?.draftId || '';
  const projectId = params?.projectId || '';
  const bootstrapTargetId = directPageId || projectId || '';
  const isProjectRoute = Boolean(!directPageId && projectId);
  const fileId = searchParams?.get('file') ?? null;

  useEffect(() => {
    if (bootstrapTargetId) {
      void queryClient.prefetchQuery(
        editorBootstrapQuery(queryClient, bootstrapTargetId, {
          fileId,
          isProjectRoute,
        }),
      );
    }
  }, [queryClient, bootstrapTargetId, fileId, isProjectRoute]);

  useEffect(() => {
    const unsubBeforeUnload = sessionCoordinator.initBeforeUnloadProtection();
    return () => {
      unsubBeforeUnload();
    };
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <WorkbenchLayout />
    </TooltipProvider>
  );
}

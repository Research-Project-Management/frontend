'use client';

/**
 * ClientEditor.tsx
 *
 * Dynamic Client-only wrapper for Next.js SSR avoidance.
 * Location: `features/editor/core/shell/ClientEditor.tsx`
 */

import dynamic from 'next/dynamic';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { useSafeQueryClient } from '@/features/editor/core/queries/safe-query-client';
import { editorBootstrapQuery } from '@/features/editor/core/queries/document.queries';
import { sessionCoordinator } from '../coordinator/session.coordinator';
import { usePageStore } from '../store/editor.store';
import { resetEditorWorkspace } from '../../editor-workspace-lifecycle';
import EditorSkeleton from './EditorSkeleton';

const WorkbenchLayout = dynamic(
  () => import('./WorkbenchLayout'),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  },
);

let activeEditorTargetId: string | null = null;

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

  const pageState = usePageStore.getState();
  const storedRootId =
    pageState.rootPageId || pageState.parentPageId || pageState.currentPage?.id || null;
  const storedSpaceId = pageState.spaceId || pageState.projectId || null;
  const hasStaleForeignState =
    Boolean(bootstrapTargetId) &&
    Boolean(
      (activeEditorTargetId && activeEditorTargetId !== bootstrapTargetId) ||
        (storedRootId &&
          storedRootId !== bootstrapTargetId &&
          (!isProjectRoute || storedSpaceId !== bootstrapTargetId)),
    );

  const [readyTargetId, setReadyTargetId] = useState<string>(() =>
    hasStaleForeignState ? '' : bootstrapTargetId,
  );

  useLayoutEffect(() => {
    if (!bootstrapTargetId) return;
    const currentPageState = usePageStore.getState();
    const currentStoredRoot =
      currentPageState.rootPageId ||
      currentPageState.parentPageId ||
      currentPageState.currentPage?.id ||
      null;
    const currentStoredSpace =
      currentPageState.spaceId || currentPageState.projectId || null;
    const needsReset =
      Boolean(activeEditorTargetId && activeEditorTargetId !== bootstrapTargetId) ||
      Boolean(
        currentStoredRoot &&
          currentStoredRoot !== bootstrapTargetId &&
          (!isProjectRoute || currentStoredSpace !== bootstrapTargetId),
      );

    if (needsReset) {
      resetEditorWorkspace({
        skipFlush: false,
        scopeId: activeEditorTargetId || currentStoredRoot || undefined,
      });
    }

    activeEditorTargetId = bootstrapTargetId;
    setReadyTargetId(bootstrapTargetId);
  }, [bootstrapTargetId, isProjectRoute]);

  useEffect(() => {
    const mountedTarget = bootstrapTargetId;
    return () => {
      if (mountedTarget && activeEditorTargetId === mountedTarget) {
        resetEditorWorkspace({
          skipFlush: false,
          scopeId: mountedTarget,
        });
        activeEditorTargetId = null;
      }
    };
  }, [bootstrapTargetId]);

  useEffect(() => {
    if (bootstrapTargetId && readyTargetId === bootstrapTargetId) {
      void queryClient.prefetchQuery(
        editorBootstrapQuery(queryClient, bootstrapTargetId, {
          fileId,
          isProjectRoute,
        }),
      );
    }
  }, [queryClient, bootstrapTargetId, readyTargetId, fileId, isProjectRoute]);

  useEffect(() => {
    const unsubBeforeUnload = sessionCoordinator.initBeforeUnloadProtection();
    return () => {
      unsubBeforeUnload();
    };
  }, []);

  const isWorkspaceReady =
    !bootstrapTargetId || (readyTargetId === bootstrapTargetId && !hasStaleForeignState);

  return (
    <TooltipProvider delayDuration={200}>
      {isWorkspaceReady ? (
        <WorkbenchLayout key={bootstrapTargetId || 'default'} />
      ) : (
        <EditorSkeleton />
      )}
    </TooltipProvider>
  );
}

/**
 * useEditorScope.ts
 *
 * Canonical React hook resolving (spaceId, rootPageId, activeFileId, effectiveScopeId)
 * from Next.js route params + URL search params + usePageStore.
 */

import { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { usePageStore } from '../store/editor.store';
import {
  resolveEditorScopeFromState,
  type EditorScopeOverrides,
  type ResolvedEditorScope,
} from '../coordinator/editor-scope';

export type { ResolvedEditorScope, EditorScopeOverrides };

export function useEditorScope(overrides?: EditorScopeOverrides): ResolvedEditorScope {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const searchParams = useSearchParams();
  const fileParam = searchParams.get('file');

  const storeSlice = usePageStore(
    useShallow((s) => ({
      spaceId: s.spaceId,
      projectId: s.projectId,
      rootPageId: s.rootPageId,
      parentPageId: s.parentPageId,
      activeDocId: s.activeDocId,
      currentPage: s.currentPage,
      activeFilePage: s.activeFilePage,
    })),
  );

  return useMemo(
    () =>
      resolveEditorScopeFromState(storeSlice, {
        spaceId: overrides?.spaceId,
        projectId: overrides?.projectId ?? params?.projectId,
        pageId: overrides?.pageId ?? params?.pageId,
        fileId: overrides?.fileId ?? fileParam,
      }),
    [
      storeSlice,
      overrides?.spaceId,
      overrides?.projectId,
      overrides?.pageId,
      overrides?.fileId,
      params?.projectId,
      params?.pageId,
      fileParam,
    ],
  );
}

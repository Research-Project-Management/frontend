'use client';

/**
 * useCitation.ts
 *
 * Hydrates Digital Library items (`'user'` in Personal Space, `projectId` in Project Space)
 * and workspace `.bib` files into `latexSymbolsIndex`.
 */

import { useEffect, useMemo } from 'react';
import { useViewItems } from '@/features/library/sdk/queries/catalog.queries';
import type { Item } from '@/features/library/types/core.types';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { lruDocumentCache, useEditorScope, workspaceCoordinator } from '@/features/editor/core';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { resolveCitationScope } from '../model/scope';

export interface UseEditorCitationsOptions {
  projectId?: string;
  pageId?: string;
  enabled?: boolean;
}

export interface UseEditorCitationsResult {
  libraryItems: Item[];
  isLoading: boolean;
  isError: boolean;
}

export function useEditorCitations({
  projectId,
  pageId: propPageId,
  enabled = true,
}: UseEditorCitationsOptions): UseEditorCitationsResult {
  const editorScope = useEditorScope({
    projectId,
    pageId: propPageId,
  });
  const { spaceId: targetSpaceId, libraryScope, pageId: activePageId } = useMemo(
    () =>
      resolveCitationScope({
        spaceType: editorScope.spaceKind,
        propProjectId: projectId,
        storeProjectId: editorScope.projectId || undefined,
        storeSpaceId: editorScope.spaceId || undefined,
        pageId: propPageId || editorScope.rootPageId || undefined,
      }),
    [
      editorScope.spaceKind,
      editorScope.projectId,
      editorScope.spaceId,
      editorScope.rootPageId,
      projectId,
      propPageId,
    ],
  );

  const { data, isLoading, isError } = useViewItems(libraryScope, 'all', { enabled });
  const libraryItems: Item[] = useMemo(() => data?.items ?? [], [data?.items]);

  useEffect(() => {
    if (libraryItems.length > 0) {
      latexSymbolsIndex.setLibraryCitations(libraryItems);
    }
  }, [libraryItems]);

  useEffect(() => {
    if (!enabled) return;
    if (targetSpaceId && activePageId) {
      void pagesService.citations
        .list(targetSpaceId, '', 500, activePageId)
        .catch(() => null);
    }
    const seenIds = new Set<string>();
    const wsFiles = workspaceCoordinator.getProjectFiles() || [];
    for (const wf of wsFiles) {
      const fileName = (wf.path || wf.title || '').trim();
      if (!fileName.toLowerCase().endsWith('.bib')) continue;
      const id = wf.id || fileName;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const cached = wf.id ? lruDocumentCache.get(wf.id) : undefined;
      const bibText = cached?.content ?? extractDocumentContentString(wf.content);
      if (bibText) {
        latexSymbolsIndex.indexFile(id, fileName, bibText, true);
      }
    }
    for (const model of lruDocumentCache.getAllModels()) {
      const fileName = (model.filePath || '').trim();
      if (!fileName.toLowerCase().endsWith('.bib') || seenIds.has(model.fileId)) continue;
      seenIds.add(model.fileId);
      if (model.content) {
        latexSymbolsIndex.indexFile(model.fileId, fileName, model.content, true);
      }
    }
  }, [targetSpaceId, activePageId, enabled]);

  return {
    libraryItems,
    isLoading,
    isError,
  };
}



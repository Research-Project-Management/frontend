'use client';

/**
 * useProjectSearchActions.ts
 *
 * Dedicated custom hook for project search actions: replace across active file or whole project.
 * Adheres to architectural constraint: Toasts strictly managed in hooks.
 */

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { filesQuery } from '@/features/editor/ui/hooks/document.queries';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import {
  sessionCoordinator,
  documentAuthority,
  lruDocumentCache,
} from '@/features/editor/core';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';

export function buildSearchRegex(
  query: string,
  options: { useRegex: boolean; wholeWord: boolean; caseSensitive: boolean },
): RegExp | null {
  let pattern = query;
  if (!options.useRegex) {
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  if (options.wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }
  const flags = options.caseSensitive ? 'g' : 'gi';

  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

interface UseProjectSearchActionsParams {
  engine: IEditorEngine | null;
  effectiveQuery: string;
  replaceText: string;
  useRegex: boolean;
  wholeWord: boolean;
  caseSensitive: boolean;
  rootProjectId?: string;
  rootPageId: string;
  activeFileId: string | null;
}

export function useProjectSearchActions({
  engine,
  effectiveQuery,
  replaceText,
  useRegex,
  wholeWord,
  caseSensitive,
  rootProjectId,
  rootPageId,
  activeFileId,
}: UseProjectSearchActionsParams) {
  const queryClient = useQueryClient();
  const [isReplacingAll, setIsReplacingAll] = useState(false);

  const handleReplaceAllCurrentFile = useCallback(() => {
    if (!engine || !effectiveQuery) return;
    const re = buildSearchRegex(effectiveQuery, { useRegex, wholeWord, caseSensitive });
    if (!re) return;

    const content = engine.getContent();
    const replaced = content.replace(re, replaceText);
    if (replaced !== content) {
      engine.setContent(replaced);
      engine.focus();
    }
    toast.success('Replaced matches in active file', { id: 'search-replace-status' });
  }, [engine, effectiveQuery, useRegex, wholeWord, caseSensitive, replaceText]);

  const handleReplaceAllEverywhere = useCallback(async () => {
    if (!effectiveQuery || !rootProjectId) return;
    setIsReplacingAll(true);
    try {
      // 1. Flush pending debounced writes across all sessions so server has latest content
      await sessionCoordinator.flushAllPending();

      const res = await manuscriptService.search.batchReplace(
        rootProjectId,
        effectiveQuery,
        replaceText,
        {
          caseSensitive,
          wholeWord,
          useRegex,
        },
      );
      toast.success(
        `Replaced ${res.totalOccurrencesReplaced} occurrence(s) across ${res.totalFilesAffected} file(s)`,
        { id: 'search-replace-status' },
      );
      await queryClient.invalidateQueries({
        queryKey: ['project-document-search'],
      });
      await queryClient.invalidateQueries({
        queryKey: filesQuery(rootPageId).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: ['pages'],
      });

      // 2. Reconcile all affected files across mounted engines (active & split-pane) and LRU cache
      const re = buildSearchRegex(effectiveQuery, { useRegex, wholeWord, caseSensitive });
      if (re) {
        for (const affectedId of res.affectedFileIds) {
          const mountedEngine = documentAuthority.getEditorEngineForFile(affectedId);
          if (mountedEngine) {
            const currentContent = mountedEngine.getContent();
            const replaced = currentContent.replace(re, replaceText);
            if (replaced !== currentContent) {
              mountedEngine.setContent(replaced);
            }
            lruDocumentCache.updateContent(affectedId, replaced, false);
            lruDocumentCache.markClean(affectedId);
          } else {
            const cachedModel = lruDocumentCache.getModel(affectedId);
            if (cachedModel) {
              const replaced = cachedModel.content.replace(re, replaceText);
              lruDocumentCache.updateContent(affectedId, replaced, false);
              lruDocumentCache.markClean(affectedId);
            }
            lruDocumentCache.evictModel(affectedId);
          }
        }
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to replace across project', { id: 'search-replace-status' });
    } finally {
      setIsReplacingAll(false);
    }
  }, [
    effectiveQuery,
    rootProjectId,
    replaceText,
    caseSensitive,
    wholeWord,
    useRegex,
    queryClient,
    rootPageId,
  ]);

  const handleReplaceSingleMatch = useCallback(
    (fileId: string, line: number, matchStart: number, matchEnd: number) => {
      if (!engine || fileId !== activeFileId) {
        toast.info('Please open this file to replace this match', { id: 'search-replace-status' });
        return;
      }
      const content = engine.getContent();
      const lines = content.split('\n');
      if (line - 1 < 0 || line - 1 >= lines.length) return;
      const targetLine = lines[line - 1];
      const before = targetLine.slice(0, matchStart);
      const after = targetLine.slice(matchEnd);
      lines[line - 1] = before + replaceText + after;
      const newContent = lines.join('\n');
      engine.setContent(newContent);
      engine.jumpToLine(line, undefined, matchStart, replaceText.length);
      engine.focus();
      toast.success('Replaced occurrence', { id: 'search-replace-status' });
    },
    [engine, activeFileId, replaceText]
  );

  return {
    isReplacingAll,
    handleReplaceAllCurrentFile,
    handleReplaceAllEverywhere,
    handleReplaceSingleMatch,
  };
}

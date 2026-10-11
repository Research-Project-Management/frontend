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
import { documentSearchService } from '@/features/editor/sdk';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';

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
    const content = engine.getContent();
    let pattern = effectiveQuery;
    if (!useRegex) pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) pattern = `\\b${pattern}\\b`;
    const flags = caseSensitive ? 'g' : 'gi';

    let re: RegExp;
    try {
      re = new RegExp(pattern, flags);
    } catch {
      return;
    }

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
      const res = await documentSearchService.batchReplace(
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
      if (res.affectedFileIds.includes(activeFileId || '')) {
        handleReplaceAllCurrentFile();
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
    activeFileId,
    handleReplaceAllCurrentFile,
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
      engine.jumpToLine(line);
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

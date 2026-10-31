'use client';

/**
 * useFileExplorerActions.ts
 *
 * Dedicated custom hook for file explorer operations and notifications:
 * - Download LaTeX file (.tex/.bib)
 * - Copy \input{} / \bibliography{} snippet to clipboard
 * - Refresh external linked reference files with status toasts
 * - Insert graphics/assets into active editor instance
 *
 * Adheres to architectural constraint: Toasts are strictly managed within hooks,
 * keeping UI presentation components purely declarative.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import { filesQuery } from '@/features/editor/ui/hooks/document.queries';
import { extractDocumentContentString, type Page, type PageFile } from '@/features/editor/domain/types/core.types';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';
import { displayName, formatLatexIncludeSnippet } from '@/features/editor/domain/document/document-naming';
import { prepareAssetInsertion } from '@/features/editor/domain/latex/smart-paste';
import { downloadFileUrl } from '@/shared/lib/file-client';

import { usePageStore, editorCommandBus, workspaceCoordinator } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';

export interface UseFileExplorerActionsOptions {
  projectId?: string;
  parentPageId?: string | null;
  currentPage?: Page | PageFile | null;
  engine?: IEditorEngine | null;
}

export function copyTexCommandToClipboard(title: string): void {
  const snippet = formatLatexIncludeSnippet(title, 'tex');

  navigator.clipboard.writeText(snippet);
  toast.success(`Copied ${snippet} to clipboard`, { id: 'copy-tex-snippet' });
}

export function useFileExplorerActions(options?: UseFileExplorerActionsOptions) {
  const queryClient = useQueryClient();
  const { projectId, parentPageId, currentPage, engine } = options || {};
  const [isRenamePending, setIsRenamePending] = useState(false);

  const downloadTex = useCallback(
    async (file: { id: string; title: string }) => {
      try {
        let rawContent: unknown = lruDocumentCache.getContent(file.id);
        if (rawContent === undefined) {
          const latestPage = currentPage || usePageStore.getState().currentPage;
          if (latestPage && latestPage.id === file.id && latestPage.content) {
            rawContent = latestPage.content;
          } else {
            const doc = await manuscriptService.docs.getById(file.id);
            rawContent = doc?.content ?? '';
          }
        }

        const textContent = extractDocumentContentString(rawContent);

        const blob = new Blob([textContent], { type: 'text/x-tex;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = displayName(file.title);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${displayName(file.title)}`, { id: `download-${file.id}` });
      } catch {
        toast.error('Failed to download file', { id: `download-${file.id}` });
      }
    },
    [currentPage],
  );

  const copyTexCommand = useCallback((title: string) => {
    copyTexCommandToClipboard(title);
  }, []);

  const refreshLinkedFile = useCallback(
    async (linkedFileId: string, fileName: string) => {
      if (!projectId) return;
      const toastId = toast.loading(`Refreshing ${fileName} from external source...`);
      try {
        await manuscriptService.linkedFiles.refresh(projectId, linkedFileId);
        if (parentPageId) {
          queryClient.invalidateQueries({ queryKey: filesQuery(parentPageId).queryKey });
        }
        queryClient.invalidateQueries({ queryKey: ['project-linked-files', projectId] });
        editorCommandBus.dispatch({ type: 'filetree:updated' });
        toast.success(`Successfully refreshed ${fileName}`, { id: toastId });
      } catch (err: unknown) {
        toast.error(`Failed to refresh ${fileName}: ${(err as Error)?.message || 'Network error'}`, { id: toastId });
      }
    },
    [projectId, parentPageId, queryClient],
  );

  const deleteLinkedFile = useCallback(
    async (linkedFileId: string, fileName: string, deleteNode = false) => {
      if (!projectId) return;
      const toastId = toast.loading(`Unlinking ${fileName}...`);
      try {
        await manuscriptService.linkedFiles.delete(projectId, linkedFileId, deleteNode);
        if (parentPageId) {
          queryClient.invalidateQueries({ queryKey: filesQuery(parentPageId).queryKey });
        }
        queryClient.invalidateQueries({ queryKey: ['project-linked-files', projectId] });
        editorCommandBus.dispatch({ type: 'filetree:updated' });
        toast.success(`Unlinked ${fileName}`, { id: toastId });
      } catch (err: unknown) {
        toast.error(`Failed to unlink ${fileName}: ${(err as Error)?.message || 'Network error'}`, { id: toastId });
      }
    },
    [projectId, parentPageId, queryClient],
  );

  const refreshAllLinkedFiles = useCallback(
    async () => {
      if (!projectId) return;
      const toastId = toast.loading('Refreshing all linked external files...');
      try {
        const res = await manuscriptService.linkedFiles.refreshAll(projectId);
        if (parentPageId) {
          queryClient.invalidateQueries({ queryKey: filesQuery(parentPageId).queryKey });
        }
        queryClient.invalidateQueries({ queryKey: ['project-linked-files', projectId] });
        editorCommandBus.dispatch({ type: 'filetree:updated' });
        toast.success(`Refreshed ${res?.refreshedCount ?? 0} linked file(s)`, { id: toastId });
      } catch (err: unknown) {
        toast.error(`Failed to refresh linked files: ${(err as Error)?.message || 'Network error'}`, { id: toastId });
      }
    },
    [projectId, parentPageId, queryClient],
  );

  const insertAsset = useCallback(
    (name: string) => {
      if (!engine) return;
      const currentContent = engine.getContent();
      const { snippet, newDocSource } = prepareAssetInsertion(name, currentContent);
      if (newDocSource) {
        const offsets = engine.getSelectionOffsets?.();
        if (offsets) {
          const beginDocIdx = currentContent.indexOf('\\begin{document}');
          const delta = newDocSource.length - currentContent.length;
          const shift = beginDocIdx !== -1 && offsets.from >= beginDocIdx ? delta : 0;
          const from = offsets.from + shift;
          const to = offsets.to + shift;
          const combined = newDocSource.slice(0, from) + snippet + newDocSource.slice(to);
          engine.setContent(combined);
        } else if (typeof engine.replaceRange === 'function') {
          const beginDocIdx = currentContent.indexOf('\\begin{document}');
          if (beginDocIdx !== -1) {
            engine.replaceRange('\\usepackage{graphicx}\n', beginDocIdx, beginDocIdx);
          }
          engine.insertText(snippet);
        } else {
          engine.setContent(`${newDocSource}\n${snippet}`);
        }
      } else {
        engine.insertText(snippet);
      }
      engine.focus();
    },
    [engine],
  );

  const handleRenameSubmit = useCallback(
    async (fileId: string, newName: string, oldName = '') => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === oldName) return false;
      setIsRenamePending(true);
      try {
        return await workspaceCoordinator.renameItem({
          itemId: fileId,
          oldName: oldName || trimmed,
          newName: trimmed,
          projectId: projectId || parentPageId || undefined,
        });
      } finally {
        setIsRenamePending(false);
      }
    },
    [projectId, parentPageId],
  );

  return {
    downloadTex,
    copyTexCommand,
    refreshLinkedFile,
    deleteLinkedFile,
    refreshAllLinkedFiles,
    insertAsset,
    handleRenameSubmit,
    isRenamePending,
  };
}

export function useStorageItemActions() {
  const copyStorageSnippet = useCallback((filename: string) => {
    const snippet = formatLatexIncludeSnippet(filename, 'asset');
    navigator.clipboard.writeText(snippet);
    toast.success(`Copied ${snippet} to clipboard`, { id: 'copy-tex-snippet' });
  }, []);

  const downloadStorageItem = useCallback((url?: string, filename?: string) => {
    if (url && filename) {
      downloadFileUrl(url, filename);
    } else {
      toast.info('Downloading file...', { id: 'download-file' });
    }
  }, []);

  return {
    copyStorageSnippet,
    downloadStorageItem,
  };
}

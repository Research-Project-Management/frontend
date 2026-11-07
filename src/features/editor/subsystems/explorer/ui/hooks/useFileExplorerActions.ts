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
import { manuscriptService } from '@/features/editor/sdk/pages.service';
import { extractDocumentContentString, type Page, type PageFile } from '@/features/editor/domain/types/core.types';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';
import {
  displayName,
  formatLatexIncludeSnippet,
  splitVirtualPath,
} from '@/features/editor/domain/document/document-naming';
import { prepareAssetInsertion } from '@/features/editor/domain/latex/smart-paste';
import { downloadFileUrl } from '@/shared/lib/file-client';

import { usePageStore, workspaceCoordinator } from '@/features/editor/core';
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
      const { leafName: oldLeaf } = splitVirtualPath(oldName);
      if (!trimmed || trimmed === oldName || (!trimmed.includes('/') && trimmed === oldLeaf)) {
        return false;
      }
      setIsRenamePending(true);
      try {
        return await workspaceCoordinator.renameItem({
          itemId: fileId,
          oldName: oldName || trimmed,
          newName: trimmed,
          projectId: parentPageId || projectId || undefined,
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

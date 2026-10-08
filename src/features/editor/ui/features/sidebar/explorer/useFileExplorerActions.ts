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

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { pageService } from '@/features/editor/coordinators/services/core.service';
import { manuscriptService } from '@/features/editor/coordinators/services/manuscript.service';
import { filesQuery } from '@/features/editor/ui/hooks/use-core';
import type { Page, PageFile } from '@/features/editor/domain/types';
import { displayName, prepareAssetInsertion } from './file-actions.util';

export interface UseFileExplorerActionsOptions {
  projectId?: string;
  parentPageId?: string | null;
  currentPage?: Page | PageFile | null;
  engine?: any;
}

export function useFileExplorerActions(options?: UseFileExplorerActionsOptions) {
  const queryClient = useQueryClient();
  const { projectId, parentPageId, currentPage, engine } = options || {};

  const downloadTex = useCallback(
    async (file: { id: string; title: string }) => {
      try {
        let rawContent: unknown = '';
        if (currentPage && currentPage.id === file.id && currentPage.content) {
          rawContent = currentPage.content;
        } else {
          const doc = await pageService.getById(file.id);
          rawContent = doc?.content ?? '';
        }

        const textContent =
          typeof rawContent === 'string'
            ? rawContent
            : (rawContent as any)?.source ||
              (rawContent as any)?.text ||
              (rawContent as any)?.content ||
              '';

        const blob = new Blob([textContent], { type: 'text/x-tex;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = displayName(file.title);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${displayName(file.title)}`);
      } catch {
        toast.error('Failed to download file');
      }
    },
    [currentPage],
  );

  const copyTexCommand = useCallback((title: string) => {
    const full = displayName(title);
    const base = full.replace(/\.[a-z0-9]+$/i, '');
    const ext = full.split('.').pop()?.toLowerCase();
    const snippet = ext === 'bib' ? `\\bibliography{${base}}` : `\\input{${base}}`;

    navigator.clipboard.writeText(snippet);
    toast.success(`Copied ${snippet} to clipboard`);
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
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
        }
        toast.success(`Successfully refreshed ${fileName}`, { id: toastId });
      } catch (err: any) {
        toast.error(`Failed to refresh ${fileName}: ${err?.message || 'Network error'}`, { id: toastId });
      }
    },
    [projectId, parentPageId, queryClient],
  );

  const insertAsset = useCallback(
    (name: string) => {
      if (!engine) return;
      const { snippet, newDocSource } = prepareAssetInsertion(name, engine.getContent());
      if (newDocSource) {
        engine.setContent(newDocSource);
      }
      engine.insertText(snippet);
      engine.focus();
    },
    [engine],
  );

  return {
    downloadTex,
    copyTexCommand,
    refreshLinkedFile,
    insertAsset,
  };
}

export function useStorageItemActions() {
  const copyStorageSnippet = useCallback((filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    let snippet = `\\includegraphics[width=\\linewidth]{${filename}}`;
    if (['bib', 'bst'].includes(ext)) {
      snippet = `\\bibliography{${filename.replace(/\.[a-z0-9]+$/i, '')}}`;
    } else if (['tex', 'ltx'].includes(ext)) {
      snippet = `\\input{${filename.replace(/\.[a-z0-9]+$/i, '')}}`;
    }
    navigator.clipboard.writeText(snippet);
    toast.success(`Copied ${snippet} to clipboard`);
  }, []);

  const downloadStorageItem = useCallback((url?: string, filename?: string) => {
    if (url && filename) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      toast.info('Downloading file...');
    }
  }, []);

  return {
    copyStorageSnippet,
    downloadStorageItem,
  };
}

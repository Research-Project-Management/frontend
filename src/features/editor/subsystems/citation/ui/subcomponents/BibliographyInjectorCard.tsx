'use client';

import React, { useState, useCallback } from 'react';
import { BookOpen, Copy, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/utils';
import { CitationService } from '@/features/library/sdk/clients/attachments-annotations.client';
import { pagesService } from '@/features/editor/sdk/pages.service';
import type { Item } from '@/features/library/types/core.types';
import {
  isLatexDocument,
  detectDocumentCitationStyle,
  buildBibliographySection,
  injectBibliographyIntoDocument,
} from '@/features/editor/subsystems/citation/model/bibliography-generator';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';
import {
  editorCommandBus,
  sessionCoordinator,
  usePageStore,
} from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';

export interface BibliographyInjectorCardProps {
  citedCount: number;
  citedItems: Item[];
  projectId?: string;
  engine?: IEditorEngine | null;
  getContent?: () => string;
  refreshContent?: () => void;
  activeFilePath?: string;
}

export const BibliographyInjectorCard = React.memo(function BibliographyInjectorCard({
  citedCount,
  citedItems,
  projectId,
  engine,
  getContent,
  refreshContent,
  activeFilePath,
}: BibliographyInjectorCardProps) {
  const [isInjecting, setIsInjecting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const storeProjectId = usePageStore((s) => s.projectId);
  const storeSpaceId = usePageStore((s) => s.spaceId);

  const fetchFormattedBibliography = useCallback(async () => {
    const itemIds = (citedItems || []).map((i) => i.id).filter(Boolean);
    if (itemIds.length === 0) {
      throw new Error('No library items have been cited yet');
    }

    const currentContent = getContent ? getContent() : engine?.getContent?.() || '';
    const detectedStyle = detectDocumentCitationStyle(currentContent, activeFilePath);
    const libraryProjectId =
      storeProjectId || (projectId && projectId !== storeSpaceId ? projectId : undefined);

    return await CitationService.batchFormat(libraryProjectId, itemIds, detectedStyle);
  }, [citedItems, projectId, storeProjectId, storeSpaceId, getContent, engine, activeFilePath]);

  // Handler: Insert bibliography section directly into document content
  const handleInsert = useCallback(async () => {
    if (!engine && !getContent) {
      toast.error('Editor is not ready');
      return;
    }

    const currentContent = getContent ? getContent() : engine?.getContent?.() || '';
    const format = isLatexDocument(currentContent, activeFilePath) ? 'latex' : 'markdown';
    const detectedStyle = detectDocumentCitationStyle(currentContent, activeFilePath);

    setIsInjecting(true);
    const toastId = toast.loading('Formatting bibliography...');

    try {
      const res = await fetchFormattedBibliography();
      const rawText = res.bibliographyText || '';

      const citationsList = (res.citations || []).map((c, idx) => ({
        key: citedItems[idx]?.citationKey || `ref_${idx + 1}`,
        inText: c.citation?.inText || '',
        bibliography: c.citation?.bibliography || '',
      }));

      const activeDocId = usePageStore.getState().getActiveDocumentId();
      let nextContent: string;
      let action: 'replaced' | 'appended';

      try {
        const serverInj = await pagesService.citations.injectBibliography(
          projectId || storeSpaceId || storeProjectId,
          {
          docId: activeDocId ?? undefined,
          content: currentContent,
          filePath: activeFilePath,
          format,
          styleId: detectedStyle,
          bibliographyText: rawText,
          citations: citationsList,
        });
        nextContent = serverInj.nextContent;
        action = serverInj.action;
      } catch {
        const newSection = buildBibliographySection({
          bibliographyText: rawText,
          format,
          styleId: detectedStyle,
          citations: citationsList,
        });

        const fallbackRes = injectBibliographyIntoDocument({
          currentContent,
          newSection,
          format,
        });
        nextContent = fallbackRes.nextContent;
        action = fallbackRes.action;
      }

      if (activeDocId) {
        lruDocumentCache.updateContent(activeDocId, nextContent, true);
        sessionCoordinator.notifyContentChange(activeDocId, nextContent);
      }

      if (engine?.setContent) {
        engine.setContent(nextContent);
      } else {
        editorCommandBus.dispatch({
          type: 'editor:set-content',
          content: nextContent,
          fileId: activeDocId ?? undefined,
        });
      }
      if (refreshContent) refreshContent();

      const actionText = action === 'replaced' ? 'Updated' : 'Inserted';
      toast.success(
        `${actionText} bibliography with ${citedItems.length} references!`,
        { id: toastId },
      );
    } catch (err: unknown) {
      toast.error('Failed to generate bibliography', {
        description: (err as Error)?.message || 'Error calling citation engine',
        id: toastId,
      });
    } finally {
      setIsInjecting(false);
    }
  }, [
    engine,
    getContent,
    activeFilePath,
    fetchFormattedBibliography,
    citedItems,
    projectId,
    storeProjectId,
    storeSpaceId,
    refreshContent,
  ]);

  // Handler: Copy full bibliography directly to clipboard
  const handleCopy = useCallback(async () => {
    const toastId = toast.loading('Copying bibliography...');
    try {
      const res = await fetchFormattedBibliography();
      const text = res.bibliographyText || '';
      if (!text.trim()) {
        toast.error('Bibliography is empty', { id: toastId });
        return;
      }

      const ok = await copyToClipboard(text);
      if (ok) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast.success(
          `Copied ${citedItems.length} references to clipboard!`,
          { id: toastId },
        );
      } else {
        toast.error('Failed to copy', { id: toastId });
      }
    } catch (err: unknown) {
      toast.error('Copy failed', {
        description: (err as Error)?.message || 'Error formatting citations',
        id: toastId,
      });
    }
  }, [fetchFormattedBibliography, citedItems.length]);

  if (citedCount === 0) return null;

  return (
    <div className="flex items-center justify-between gap-2 pb-2 mb-1.5 border-b border-border/60 select-none">
      <span className="text-11 font-medium text-muted-foreground">
        References{' '}
        <span className="tabular-nums text-muted-foreground/70">({citedCount})</span>
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleInsert}
          disabled={isInjecting}
          title="Insert bibliography into document"
          className="h-6 px-2 rounded text-11 font-medium text-foreground/80 hover:text-foreground hover:bg-muted flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-border"
        >
          {isInjecting ? (
            <RefreshCw className="size-3 animate-spin shrink-0" />
          ) : (
            <BookOpen className="size-3 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          )}
          <span>{isInjecting ? 'Inserting...' : 'Insert'}</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          title="Copy bibliography"
          aria-label="Copy bibliography"
          className="size-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-border"
        >
          {isCopied ? (
            <Check className="size-3 text-foreground shrink-0" />
          ) : (
            <Copy className="size-3 shrink-0" />
          )}
        </button>
      </div>
    </div>
  );
});


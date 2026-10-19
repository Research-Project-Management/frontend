'use client';

import React, { useState, useCallback } from 'react';
import { BookOpen, Copy, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/utils';
import { libraryServices } from '@/features/library/sdk/library.client';
import type { Item } from '@/features/library/domain/types/library.types';
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

  const fetchFormattedBibliography = useCallback(async () => {
    const itemIds = (citedItems || []).map((i) => i.id).filter(Boolean);
    if (itemIds.length === 0) {
      throw new Error('No library items have been cited yet');
    }

    const currentContent = getContent ? getContent() : engine?.getContent?.() || '';
    const detectedStyle = detectDocumentCitationStyle(currentContent, activeFilePath);

    return await libraryServices.citations.batchFormat(projectId, itemIds, detectedStyle);
  }, [citedItems, projectId, getContent, engine, activeFilePath]);

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

      const newSection = buildBibliographySection({
        bibliographyText: rawText,
        format,
        styleId: detectedStyle,
        citations: citationsList,
      });

      const { nextContent, action } = injectBibliographyIntoDocument({
        currentContent,
        newSection,
        format,
      });

      const activeDocId = usePageStore.getState().getActiveDocumentId();
      if (activeDocId) {
        lruDocumentCache.updateContent(activeDocId, nextContent, true);
        sessionCoordinator.notifyContentChange(activeDocId, nextContent);
      }

      if (engine && typeof engine.setContent === 'function') {
        engine.setContent(nextContent);
      } else {
        editorCommandBus.dispatch({ type: 'editor:set-content', content: nextContent });
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
        toast.error('Failed to copy to clipboard', { id: toastId });
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
    <div className="p-2.5 mb-2.5 rounded-md bg-muted/40 border border-border text-foreground space-y-2 select-none">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-12 font-medium">
          <BookOpen className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
          <span>References ({citedCount})</span>
        </div>

        {/* Auto-detect badge */}
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
          title="Automatically detects document syntax and normalizes author names"
        >
          <Check className="size-2.5 shrink-0" />
          <span>Auto-detected</span>
        </span>
      </div>

      <p className="text-11 leading-relaxed text-muted-foreground">
        Automatically detects document format and normalizes author names.
      </p>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={handleInsert}
          disabled={isInjecting}
          className="flex-1 h-7 px-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-11 font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          {isInjecting ? (
            <RefreshCw className="size-3 animate-spin shrink-0" />
          ) : (
            <BookOpen className="size-3 shrink-0" />
          )}
          <span>{isInjecting ? 'Generating...' : 'Insert Bibliography'}</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-foreground text-11 font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          title="Copy full bibliography to clipboard"
        >
          {isCopied ? (
            <Check className="size-3 text-primary shrink-0" />
          ) : (
            <Copy className="size-3 shrink-0 text-muted-foreground" />
          )}
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
});


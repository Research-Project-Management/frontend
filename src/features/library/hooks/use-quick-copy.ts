'use client';

import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/utils';
import { CitationService } from '../data';
import type { Item, CslStyle } from '../types/library.types';

export interface UseQuickCopyOptions {
  scopeId?: string;
  items?: Item[];
  selectedIds: Set<string>;
  activeItemId?: string | null;
  defaultStyle?: CslStyle;
}

/**
 * Zotero 7 Parity Quick Copy Shortcuts:
 * - Ctrl+Shift+C (Cmd+Shift+C on macOS): Copy Selected References as Bibliography
 * - Ctrl+Shift+A (Cmd+Shift+A on macOS): Copy Selected References as In-text Citation
 */
export function useQuickCopyShortcuts({
  scopeId,
  items = [],
  selectedIds,
  activeItemId,
  defaultStyle = 'apa',
}: UseQuickCopyOptions) {
  const getTargetItemIds = useCallback((): string[] => {
    if (selectedIds && selectedIds.size > 0) {
      return Array.from(selectedIds);
    }
    if (activeItemId) {
      return [activeItemId];
    }
    return [];
  }, [selectedIds, activeItemId]);

  const copyBibliography = useCallback(
    async (style: CslStyle = defaultStyle) => {
      const itemIds = getTargetItemIds();
      if (itemIds.length === 0) {
        toast.info('Select references first to copy citation', { id: 'quick-copy' });
        return;
      }

      const toastId = toast.loading(`Formatting bibliography (${style.toUpperCase()})...`, {
        id: 'quick-copy',
      });

      try {
        let text = '';
        if (itemIds.length === 1) {
          const res = await CitationService.formatCitation(scopeId, itemIds[0], style);
          text = res.bibliography || res.inText || '';
        } else {
          const res = await CitationService.batchFormat(scopeId, itemIds, style);
          text = res.citations
            .map((c) => c.citation?.bibliography)
            .filter(Boolean)
            .join('\n\n');
        }

        if (!text.trim()) {
          toast.error('Unable to generate bibliography for selected items', { id: toastId });
          return;
        }

        const ok = await copyToClipboard(text);
        if (ok) {
          toast.success(
            `Copied ${itemIds.length} reference${itemIds.length > 1 ? 's' : ''} (${style.toUpperCase()}) to clipboard`,
            { id: toastId },
          );
        } else {
          toast.error('Failed to copy to clipboard', { id: toastId });
        }
      } catch (err: any) {
        toast.error('Citation copy failed', {
          description: err?.message || 'Could not contact citation formatting engine',
          id: toastId,
        });
      }
    },
    [getTargetItemIds, scopeId, defaultStyle],
  );

  const copyInTextCitation = useCallback(
    async (style: CslStyle = defaultStyle) => {
      const itemIds = getTargetItemIds();
      if (itemIds.length === 0) {
        toast.info('Select references first to copy citation', { id: 'quick-copy' });
        return;
      }

      const toastId = toast.loading(`Formatting in-text citation...`, { id: 'quick-copy' });

      try {
        let text = '';
        if (itemIds.length === 1) {
          const res = await CitationService.formatCitation(scopeId, itemIds[0], style);
          text = res.inText || (res as any).citation || '';
        } else {
          const res = await CitationService.batchFormat(scopeId, itemIds, style);
          const inTexts = res.citations
            .map((c) => c.citation?.inText)
            .filter(Boolean);

          // If standard parenthetical citations, combine them: (Author 1, 2020; Author 2, 2021)
          if (inTexts.every((t) => t.startsWith('(') && t.endsWith(')'))) {
            const stripped = inTexts.map((t) => t.slice(1, -1));
            text = `(${stripped.join('; ')})`;
          } else {
            text = inTexts.join('; ');
          }
        }

        if (!text.trim()) {
          toast.error('Unable to generate in-text citation', { id: toastId });
          return;
        }

        const ok = await copyToClipboard(text);
        if (ok) {
          toast.success(
            `Copied in-text citation for ${itemIds.length} reference${itemIds.length > 1 ? 's' : ''} to clipboard`,
            { id: toastId },
          );
        } else {
          toast.error('Failed to copy to clipboard', { id: toastId });
        }
      } catch (err: any) {
        toast.error('In-text citation copy failed', {
          description: err?.message || 'Could not contact citation formatting engine',
          id: toastId,
        });
      }
    },
    [getTargetItemIds, scopeId, defaultStyle],
  );

  // Global Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing into form controls
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }

      const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier || !e.shiftKey) return;

      const key = e.key.toLowerCase();
      if (key === 'c') {
        // Ctrl+Shift+C / Cmd+Shift+C: Quick Copy Bibliography
        e.preventDefault();
        e.stopPropagation();
        copyBibliography();
      } else if (key === 'a') {
        // Ctrl+Shift+A / Cmd+Shift+A: Quick Copy In-text Citation
        e.preventDefault();
        e.stopPropagation();
        copyInTextCitation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [copyBibliography, copyInTextCitation]);

  return {
    copyBibliography,
    copyInTextCitation,
  };
}

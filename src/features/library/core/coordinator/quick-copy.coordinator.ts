'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { libraryServices } from '@/features/library/sdk/library.client';
import type { Item, CslStyle } from '@/features/library/domain/types/library.types';
import { isItemRetracted } from '@/features/library/domain/retraction';
import { copyWithToastHelper, warnIfRetractedHelper } from './citation-export.coordinator';

export interface UseQuickCopyOptions {
  scopeId?: string;
  items?: Item[];
  selectedIds?: Set<string>;
  activeItemId?: string | null;
  defaultStyle?: CslStyle;
}

/**
 * Native Academic Quick Copy Coordinator:
 * - Ctrl+Shift+C (Cmd+Shift+C on macOS): Copy Selected References as Bibliography
 * - Ctrl+Shift+A (Cmd+Shift+A on macOS): Copy Selected References as In-text Citation
 */
export function useQuickCopyCoordinator({
  scopeId,
  items,
  selectedIds: propSelectedIds,
  activeItemId: propActiveItemId,
  defaultStyle = 'apa',
}: UseQuickCopyOptions = {}) {
  const getTargetItemIds = useCallback((): string[] => {
    if (propSelectedIds && propSelectedIds.size > 0) {
      return Array.from(propSelectedIds);
    }
    const currentSelectedIds = useLibraryUIStore.getState().selectedIds;
    if (currentSelectedIds && currentSelectedIds.size > 0) {
      return Array.from(currentSelectedIds);
    }
    const currentActiveItemId =
      propActiveItemId !== undefined
        ? propActiveItemId
        : useLibraryUIStore.getState().activeItemId;
    if (currentActiveItemId) {
      return [currentActiveItemId];
    }
    return [];
  }, [propSelectedIds, propActiveItemId]);

  const warnRetractedIfNeeded = useCallback(
    (itemIds: string[], actionLabel: string) => {
      if (!items || items.length === 0 || itemIds.length === 0) return;
      const targetIdSet = new Set(itemIds);
      const retractedCount = items.filter(
        (it) => targetIdSet.has(it.id) && isItemRetracted(it),
      ).length;
      warnIfRetractedHelper(retractedCount, itemIds.length, actionLabel);
    },
    [items],
  );

  const copyBibliography = useCallback(
    async (style: CslStyle = defaultStyle) => {
      const itemIds = getTargetItemIds();
      if (itemIds.length === 0) {
        toast.info('Select references first to copy citation', { id: 'quick-copy' });
        return;
      }

      warnRetractedIfNeeded(itemIds, 'citation formatting');

      const toastId = String(
        toast.loading(`Formatting bibliography (${style.toUpperCase()})...`, {
          id: 'quick-copy',
        }),
      );

      try {
        let text = '';
        if (itemIds.length === 1) {
          const res = await libraryServices.citations.formatCitation(scopeId, itemIds[0], style);
          text = res.bibliography || res.inText || '';
        } else {
          const res = await libraryServices.citations.batchFormat(scopeId, itemIds, style);
          text =
            res.bibliographyText ||
            res.citations
              .map((c) => c.citation?.bibliography)
              .filter(Boolean)
              .join('\n\n');
        }

        if (!text.trim()) {
          toast.error('Unable to generate bibliography for selected items', { id: toastId });
          return;
        }

        await copyWithToastHelper(
          text,
          `Copied ${itemIds.length} reference${itemIds.length > 1 ? 's' : ''} (${style.toUpperCase()}) to clipboard`,
          toastId,
        );
      } catch (err: unknown) {
        toast.error('Citation copy failed', {
          description:
            err instanceof Error
              ? err.message
              : 'Could not contact citation formatting engine',
          id: toastId,
        });
      }
    },
    [getTargetItemIds, warnRetractedIfNeeded, scopeId, defaultStyle],
  );

  const copyInTextCitation = useCallback(
    async (style: CslStyle = defaultStyle) => {
      const itemIds = getTargetItemIds();
      if (itemIds.length === 0) {
        toast.info('Select references first to copy citation', { id: 'quick-copy' });
        return;
      }

      warnRetractedIfNeeded(itemIds, 'in-text citation');

      const toastId = String(
        toast.loading('Formatting in-text citation...', { id: 'quick-copy' }),
      );

      try {
        let text = '';
        if (itemIds.length === 1) {
          const res = await libraryServices.citations.formatCitation(scopeId, itemIds[0], style);
          text = res.inText || '';
        } else {
          const res = await libraryServices.citations.batchFormat(scopeId, itemIds, style);
          text =
            res.combinedInText ||
            res.citations
              .map((c) => c.citation?.inText)
              .filter(Boolean)
              .join('; ');
        }

        if (!text.trim()) {
          toast.error('Unable to generate in-text citation', { id: toastId });
          return;
        }

        await copyWithToastHelper(
          text,
          `Copied in-text citation for ${itemIds.length} reference${itemIds.length > 1 ? 's' : ''} to clipboard`,
          toastId,
        );
      } catch (err: unknown) {
        toast.error('In-text citation copy failed', {
          description:
            err instanceof Error
              ? err.message
              : 'Could not contact citation formatting engine',
          id: toastId,
        });
      }
    },
    [getTargetItemIds, warnRetractedIfNeeded, scopeId, defaultStyle],
  );

  // Global Keyboard Listener
  useEffect(() => {
    const isMac =
      typeof navigator !== 'undefined'
        ? /mac/i.test(navigator.userAgent) ||
          /mac/i.test(
            (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? '',
          )
        : false;

    const handleKeyDown = (e: KeyboardEvent) => {
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

      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (!modifier || !e.shiftKey) return;

      const key = e.key.toLowerCase();
      if (key === 'c') {
        e.preventDefault();
        e.stopPropagation();
        void copyBibliography();
      } else if (key === 'a') {
        e.preventDefault();
        e.stopPropagation();
        void copyInTextCitation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [copyBibliography, copyInTextCitation]);

  return useMemo(
    () => ({
      copyBibliography,
      copyInTextCitation,
    }),
    [copyBibliography, copyInTextCitation],
  );
}

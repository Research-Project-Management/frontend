'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/utils';
import { readerService } from '@/features/library/sdk/library.client';
import { annotationKeys } from '@/features/library/sdk/query-keys';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { PdfAnnotationEngine } from '@/features/library/domain/reader.domain';
import type {
  ReaderAnnotation,
  ReaderDocument,
} from '@/features/library/domain/types/reader.types';

export interface UseAnnotationBatchOptions {
  scopeId: string;
  effectiveAttachmentId?: string;
  paper: ReaderDocument | null;
  setPendingNoteText: (text: string) => void;
}

type UndoAction =
  | {
      type: 'delete';
      items: ReaderAnnotation[];
    }
  | {
      type: 'color';
      items: {
        id: string;
        prevColor: string;
        newColor: string;
        version: number;
        previousData: ReaderAnnotation;
      }[];
    }
  | {
      type: 'tag';
      items: {
        id: string;
        prevTags: string[];
        newTags: string[];
        version: number;
        previousData: ReaderAnnotation;
      }[];
    };

/**
 * Manages native multi-annotation selection, batch operations,
 * context actions, and undo/redo inside the PDF Reader.
 */
export function useAnnotationBatch({
  scopeId,
  effectiveAttachmentId,
  paper,
  setPendingNoteText,
}: UseAnnotationBatchOptions) {
  const qc = useQueryClient();
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);
  const isProcessingRef = useRef(false);
  const attachmentEpochRef = useRef(0);

  useEffect(() => {
    attachmentEpochRef.current += 1;
    isProcessingRef.current = false;
    setIsBatchProcessing(false);
    setSelectedAnnotationIds(new Set());
    setUndoStack([]);
    setRedoStack([]);
  }, [scopeId, effectiveAttachmentId]);

  const handleToggleSelectAnnotation = useCallback((id: string) => {
    setSelectedAnnotationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((allIds: string[]) => {
    setSelectedAnnotationIds(new Set(allIds));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedAnnotationIds(new Set());
  }, []);

  const pruneDeletedFromHistory = useCallback((deletedIds: string[]) => {
    if (!deletedIds || deletedIds.length === 0) return;
    const deletedSet = new Set(deletedIds);
    const filterAction = (action: UndoAction): UndoAction | null => {
      if (action.type === 'delete') return action;
      const remaining = action.items.filter((it) => !deletedSet.has(it.id));
      if (remaining.length === 0) return null;
      return { ...action, items: remaining } as UndoAction;
    };
    setUndoStack((prev) => prev.map(filterAction).filter((a): a is UndoAction => a !== null));
    setRedoStack((prev) => prev.map(filterAction).filter((a): a is UndoAction => a !== null));
  }, []);

  // Undo function
  const undo = useCallback(async () => {
    if (!effectiveAttachmentId || undoStack.length === 0 || isProcessingRef.current || isBatchProcessing) return;
    const action = undoStack[undoStack.length - 1];

    isProcessingRef.current = true;
    setIsBatchProcessing(true);
    try {
      if (action.type === 'delete') {
        const upserts = action.items.map((item) => ({
          id: item.id,
          pageIndex: item.pageIndex,
          color: item.color,
          rects: item.rects,
          quoteText: item.quoteText,
          comment: item.comment,
          tags: item.tags,
          type: item.type,
          expectedVersion: 0,
        }));

        await readerService.annotations.batch(scopeId, effectiveAttachmentId, {
          upserts,
          deletes: [],
        });

        qc.invalidateQueries({
          queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
        });

        setUndoStack((prev) => prev.slice(0, prev.length - 1));
        setRedoStack((prev) => [...prev.slice(-19), action]);
        toast.success(`Restored ${action.items.length} annotation${action.items.length > 1 ? 's' : ''}`);
      } else if (action.type === 'color') {
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(
            annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
          ) || [];
        const existingMap = new Map(existing.map((a) => [a.id, a]));
        const liveItems = action.items.filter((item) => existingMap.has(item.id));
        if (liveItems.length === 0) {
          setUndoStack((prev) => prev.slice(0, prev.length - 1));
          return;
        }

        await Promise.all(
          liveItems.map((item) => {
            const found = existingMap.get(item.id);
            return readerService.annotations.update(
              scopeId,
              effectiveAttachmentId,
              item.id,
              found?.version ?? item.version,
              { color: item.prevColor },
            );
          }),
        );

        qc.invalidateQueries({
          queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
        });

        setUndoStack((prev) => prev.slice(0, prev.length - 1));
        setRedoStack((prev) => [...prev.slice(-19), { ...action, items: liveItems }]);
        toast.success(`Reverted color change`);
      } else if (action.type === 'tag') {
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(
            annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
          ) || [];
        const existingMap = new Map(existing.map((a) => [a.id, a]));
        const liveItems = action.items.filter((item) => existingMap.has(item.id));
        if (liveItems.length === 0) {
          setUndoStack((prev) => prev.slice(0, prev.length - 1));
          return;
        }

        await Promise.all(
          liveItems.map((item) => {
            const found = existingMap.get(item.id);
            return readerService.annotations.update(
              scopeId,
              effectiveAttachmentId,
              item.id,
              found?.version ?? item.version,
              { tags: item.prevTags },
            );
          }),
        );

        qc.invalidateQueries({
          queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
        });

        setUndoStack((prev) => prev.slice(0, prev.length - 1));
        setRedoStack((prev) => [...prev.slice(-19), { ...action, items: liveItems }]);
        toast.success(`Reverted tag change`);
      }
    } catch (err) {
      toast.error('Undo failed', { description: getErrorMessage(err) });
    } finally {
      isProcessingRef.current = false;
      setIsBatchProcessing(false);
    }
  }, [effectiveAttachmentId, undoStack, scopeId, qc, isBatchProcessing]);

  // Redo function
  const redo = useCallback(async () => {
    if (!effectiveAttachmentId || redoStack.length === 0 || isProcessingRef.current || isBatchProcessing) return;
    const action = redoStack[redoStack.length - 1];

    isProcessingRef.current = true;
    setIsBatchProcessing(true);
    try {
      if (action.type === 'delete') {
        const deletes = action.items.map((a) => a.id);
        await readerService.annotations.batch(scopeId, effectiveAttachmentId, {
          upserts: [],
          deletes,
        });

        qc.invalidateQueries({
          queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
        });

        setRedoStack((prev) => prev.slice(0, prev.length - 1));
        setUndoStack((prev) => [...prev.slice(-19), action]);
        toast.success(`Re-deleted ${deletes.length} annotation${deletes.length > 1 ? 's' : ''}`);
      } else if (action.type === 'color') {
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(
            annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
          ) || [];
        const existingMap = new Map(existing.map((a) => [a.id, a]));
        const liveItems = action.items.filter((item) => existingMap.has(item.id));
        if (liveItems.length === 0) {
          setRedoStack((prev) => prev.slice(0, prev.length - 1));
          return;
        }

        await Promise.all(
          liveItems.map((item) => {
            const found = existingMap.get(item.id);
            return readerService.annotations.update(
              scopeId,
              effectiveAttachmentId,
              item.id,
              found?.version ?? item.version,
              { color: item.newColor },
            );
          }),
        );

        qc.invalidateQueries({
          queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
        });

        setRedoStack((prev) => prev.slice(0, prev.length - 1));
        setUndoStack((prev) => [...prev.slice(-19), { ...action, items: liveItems }]);
        toast.success(`Re-applied color change`);
      } else if (action.type === 'tag') {
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(
            annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
          ) || [];
        const existingMap = new Map(existing.map((a) => [a.id, a]));
        const liveItems = action.items.filter((item) => existingMap.has(item.id));
        if (liveItems.length === 0) {
          setRedoStack((prev) => prev.slice(0, prev.length - 1));
          return;
        }

        await Promise.all(
          liveItems.map((item) => {
            const found = existingMap.get(item.id);
            return readerService.annotations.update(
              scopeId,
              effectiveAttachmentId,
              item.id,
              found?.version ?? item.version,
              { tags: item.newTags },
            );
          }),
        );

        qc.invalidateQueries({
          queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
        });

        setRedoStack((prev) => prev.slice(0, prev.length - 1));
        setUndoStack((prev) => [...prev.slice(-19), { ...action, items: liveItems }]);
        toast.success(`Re-applied tag change`);
      }
    } catch (err) {
      toast.error('Redo failed', { description: getErrorMessage(err) });
    } finally {
      isProcessingRef.current = false;
      setIsBatchProcessing(false);
    }
  }, [effectiveAttachmentId, redoStack, scopeId, qc, isBatchProcessing]);

  // Keyboard shortcut for Undo (Ctrl+Z) / Redo (Ctrl+Y or Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleBatchChangeColor = useCallback(
    async (colorHex: string, targetIds?: string[]) => {
      const ids = targetIds && targetIds.length > 0 ? targetIds : Array.from(selectedAnnotationIds);
      if (!effectiveAttachmentId || ids.length === 0 || isProcessingRef.current || isBatchProcessing) return;
      isProcessingRef.current = true;
      setIsBatchProcessing(true);
      try {
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(
            annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
          ) || [];
        const existingMap = new Map(existing.map((a) => [a.id, a]));

        const historyItems: {
          id: string;
          prevColor: string;
          newColor: string;
          version: number;
          previousData: ReaderAnnotation;
        }[] = [];

        const upserts = ids.map((id) => {
          const found = existingMap.get(id);
          if (found) {
            historyItems.push({
              id,
              prevColor: found.color || '#ffd400',
              newColor: colorHex,
              version: found.version ?? 1,
              previousData: {
                ...found,
                type: found.type,
                rects: found.rects,
                quoteText: found.quoteText,
                comment: found.comment,
                color: found.color,
                tags: found.tags,
              },
            });
          }
          return {
            id,
            pageIndex: found?.pageIndex ?? 0,
            type: found?.type,
            rects: found?.rects,
            quoteText: found?.quoteText,
            comment: found?.comment,
            color: colorHex,
            tags: found?.tags,
            expectedVersion: found?.version ?? 1,
          };
        });

        await readerService.annotations.batch(scopeId, effectiveAttachmentId, {
          upserts,
          deletes: [],
        });

        qc.invalidateQueries({
          queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
        });

        setUndoStack((prev) => [...prev.slice(-19), { type: 'color', items: historyItems }]);
        setRedoStack([]);

        toast.success(`Updated color for ${ids.length} highlight${ids.length > 1 ? 's' : ''}`, {
          id: 'reader-batch-action',
          action: {
            label: 'Undo',
            onClick: () => undo(),
          },
        });
      } catch (err) {
        toast.error('Batch update failed', {
          description: getErrorMessage(err),
          id: 'reader-batch-action',
        });
      } finally {
        isProcessingRef.current = false;
        setIsBatchProcessing(false);
      }
    },
    [effectiveAttachmentId, selectedAnnotationIds, qc, scopeId, undo, isBatchProcessing],
  );

  const handleBatchDelete = useCallback(
    async (targetIds?: string[]) => {
      const ids = targetIds && targetIds.length > 0 ? targetIds : Array.from(selectedAnnotationIds);
      if (!effectiveAttachmentId || ids.length === 0 || isProcessingRef.current || isBatchProcessing) return;
      isProcessingRef.current = true;
      setIsBatchProcessing(true);
      try {
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(
            annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
          ) || [];

        const targetSet = new Set(ids);
        const deletedItems = existing.filter((a) => targetSet.has(a.id));

        await readerService.annotations.batch(scopeId, effectiveAttachmentId, {
          upserts: [],
          deletes: ids,
        });

        qc.invalidateQueries({
          queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
        });

        pruneDeletedFromHistory(ids);
        setUndoStack((prev) => [...prev.slice(-19), { type: 'delete', items: deletedItems }]);
        setRedoStack([]);

        setSelectedAnnotationIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });

        toast.success(`Deleted ${ids.length} highlight${ids.length > 1 ? 's' : ''}`, {
          id: 'reader-batch-action',
          action: {
            label: 'Undo',
            onClick: () => undo(),
          },
        });
      } catch (err) {
        toast.error('Batch delete failed', {
          description: getErrorMessage(err),
          id: 'reader-batch-action',
        });
      } finally {
        isProcessingRef.current = false;
        setIsBatchProcessing(false);
      }
    },
    [effectiveAttachmentId, selectedAnnotationIds, qc, scopeId, undo, isBatchProcessing, pruneDeletedFromHistory],
  );

  const handleBatchAddToNote = useCallback(
    (targetIds?: string[]) => {
      const ids = targetIds && targetIds.length > 0 ? targetIds : Array.from(selectedAnnotationIds);
      if (!effectiveAttachmentId || ids.length === 0) return;
      const idSet = new Set(ids);
      const existing =
        qc.getQueryData<ReaderAnnotation[]>(
          annotationKeys.byAttachment(scopeId, effectiveAttachmentId),
        ) || [];

      const selected = PdfAnnotationEngine.sortAnnotationsInReadingOrder(
        existing.filter((a) => idSet.has(a.id)),
      );
      const quotes = PdfAnnotationEngine.synthesizeMarkdownNote(
        selected,
        paper,
        effectiveAttachmentId,
      );

      setPendingNoteText(quotes);
      useLibraryUIStore.getState().setIsInspectorOpen(true);
      useLibraryUIStore.getState().setActiveInspectorTab('notes');
      toast.success(`Added ${selected.length} highlight${selected.length > 1 ? 's' : ''} to Note draft`, {
        id: 'reader-note-toast',
      });
    },
    [effectiveAttachmentId, selectedAnnotationIds, qc, scopeId, paper, setPendingNoteText],
  );

  return {
    selectedAnnotationIds,
    setSelectedAnnotationIds,
    isBatchProcessing,
    handleToggleSelectAnnotation,
    handleSelectAll,
    handleClearSelection,
    handleBatchChangeColor,
    handleBatchDelete,
    handleBatchAddToNote,
    pruneDeletedFromHistory,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}

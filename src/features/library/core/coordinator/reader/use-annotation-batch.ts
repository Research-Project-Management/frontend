'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/utils';
import type { ExtractNotesOptions } from '@/features/library/sdk';
import { annotationKeys } from '@/features/library/sdk/query-keys';
import {
  ANNOTATION_HISTORY_HANDLERS,
  executeAnnotationHistoryEntry,
  executeAnnotationBatchSync,
  executeExtractAnnotationNotes,
  type UndoAction,
  type HistoryEntry,
  type AnnotationHistoryContext,
  type AnnotationHistoryStrategy,
} from '@/features/library/sdk/queries/reader.queries';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import type {
  ReaderAnnotation,
  ReaderDocument,
} from '@/features/library/domain/types/reader.schema';

export {
  ANNOTATION_HISTORY_HANDLERS,
  executeAnnotationHistoryEntry,
  type UndoAction,
  type HistoryEntry,
  type AnnotationHistoryContext,
  type AnnotationHistoryStrategy,
};

export interface UseAnnotationBatchOptions {
  scopeId: string;
  effectiveAttachmentId?: string;
  paper: ReaderDocument | null;
  setPendingNoteText: (text: string) => void;
  extractNotes?: (paperId: string, options?: ExtractNotesOptions) => Promise<unknown>;
}

function dispatchPruneHistoryEntry(action: UndoAction, deletedSet: ReadonlySet<string>): UndoAction | null {
  const handler = ANNOTATION_HISTORY_HANDLERS[action.type] as AnnotationHistoryStrategy<UndoAction>;
  return handler.prune(action, deletedSet);
}

async function dispatchUndoHistoryEntry(action: UndoAction, ctx: AnnotationHistoryContext): Promise<void> {
  await executeAnnotationHistoryEntry(action, ctx, 'undo');
}

async function dispatchRedoHistoryEntry(action: UndoAction, ctx: AnnotationHistoryContext): Promise<void> {
  await executeAnnotationHistoryEntry(action, ctx, 'redo');
}

/**
 * Manages native multi-annotation selection, batch operations,
 * context actions, and undo/redo inside the PDF Reader.
 */
export function useAnnotationBatch({
  scopeId,
  effectiveAttachmentId,
  paper,
  setPendingNoteText: _setPendingNoteText,
  extractNotes,
}: UseAnnotationBatchOptions) {
  const qc = useQueryClient();
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [undoStack, setUndoStackState] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStackState] = useState<UndoAction[]>([]);
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<UndoAction[]>([]);
  const isProcessingRef = useRef(false);
  const attachmentEpochRef = useRef(0);

  const updateUndoStack = useCallback(
    (updater: UndoAction[] | ((prev: UndoAction[]) => UndoAction[])) => {
      const next =
        typeof updater === 'function' ? updater(undoStackRef.current) : updater;
      undoStackRef.current = next;
      setUndoStackState(next);
    },
    [],
  );

  const updateRedoStack = useCallback(
    (updater: UndoAction[] | ((prev: UndoAction[]) => UndoAction[])) => {
      const next =
        typeof updater === 'function' ? updater(redoStackRef.current) : updater;
      redoStackRef.current = next;
      setRedoStackState(next);
    },
    [],
  );

  useEffect(() => {
    attachmentEpochRef.current += 1;
    isProcessingRef.current = false;
    setIsBatchProcessing(false);
    setSelectedAnnotationIds(new Set());
    updateUndoStack([]);
    updateRedoStack([]);
  }, [scopeId, effectiveAttachmentId, updateUndoStack, updateRedoStack]);

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
    const filterAction = (action: UndoAction): UndoAction | null =>
      dispatchPruneHistoryEntry(action, deletedSet);
    updateUndoStack((prev) => prev.map(filterAction).filter((a): a is UndoAction => a !== null));
    updateRedoStack((prev) => prev.map(filterAction).filter((a): a is UndoAction => a !== null));
  }, [updateUndoStack, updateRedoStack]);

  const undo = useCallback(async () => {
    const currentStack = undoStackRef.current;
    if (!effectiveAttachmentId || currentStack.length === 0 || isProcessingRef.current || isBatchProcessing) return;
    const action = currentStack[currentStack.length - 1];
    if (!action) return;

    const startEpoch = attachmentEpochRef.current;
    isProcessingRef.current = true;
    setIsBatchProcessing(true);
    try {
      await dispatchUndoHistoryEntry(action, {
        scopeId,
        effectiveAttachmentId,
        qc,
        updateUndoStack: (updater) => {
          if (attachmentEpochRef.current !== startEpoch) return;
          updateUndoStack(updater);
        },
        updateRedoStack: (updater) => {
          if (attachmentEpochRef.current !== startEpoch) return;
          updateRedoStack(updater);
        },
      });
    } catch (err) {
      if (attachmentEpochRef.current === startEpoch) {
        toast.error('Undo failed', { description: getErrorMessage(err) });
      }
    } finally {
      if (attachmentEpochRef.current === startEpoch) {
        isProcessingRef.current = false;
        setIsBatchProcessing(false);
      }
    }
  }, [effectiveAttachmentId, scopeId, qc, isBatchProcessing, updateUndoStack, updateRedoStack]);

  const redo = useCallback(async () => {
    const currentStack = redoStackRef.current;
    if (!effectiveAttachmentId || currentStack.length === 0 || isProcessingRef.current || isBatchProcessing) return;
    const action = currentStack[currentStack.length - 1];
    if (!action) return;

    const startEpoch = attachmentEpochRef.current;
    isProcessingRef.current = true;
    setIsBatchProcessing(true);
    try {
      await dispatchRedoHistoryEntry(action, {
        scopeId,
        effectiveAttachmentId,
        qc,
        updateUndoStack: (updater) => {
          if (attachmentEpochRef.current !== startEpoch) return;
          updateUndoStack(updater);
        },
        updateRedoStack: (updater) => {
          if (attachmentEpochRef.current !== startEpoch) return;
          updateRedoStack(updater);
        },
      });
    } catch (err) {
      if (attachmentEpochRef.current === startEpoch) {
        toast.error('Redo failed', { description: getErrorMessage(err) });
      }
    } finally {
      if (attachmentEpochRef.current === startEpoch) {
        isProcessingRef.current = false;
        setIsBatchProcessing(false);
      }
    }
  }, [effectiveAttachmentId, scopeId, qc, isBatchProcessing, updateUndoStack, updateRedoStack]);

  // Keyboard shortcut for Undo (Ctrl+Z) / Redo (Ctrl+Y or Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key.toLowerCase() === 'z') {
          if (e.shiftKey) {
            if (redoStackRef.current.length === 0) return;
            e.preventDefault();
            void redo();
          } else {
            if (undoStackRef.current.length === 0) return;
            e.preventDefault();
            void undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          if (redoStackRef.current.length === 0) return;
          e.preventDefault();
          void redo();
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
      const startEpoch = attachmentEpochRef.current;
      isProcessingRef.current = true;
      setIsBatchProcessing(true);
      try {
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(scopeId, effectiveAttachmentId)) || [];
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
              previousData: { ...found },
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

        await executeAnnotationBatchSync(qc, scopeId, effectiveAttachmentId, {
          upserts,
          deletes: [],
        });

        if (attachmentEpochRef.current !== startEpoch) return;

        updateUndoStack((prev) => [...prev.slice(-19), { type: 'color', items: historyItems }]);
        updateRedoStack([]);

        toast.success(`Updated color for ${ids.length} highlight${ids.length > 1 ? 's' : ''}`, {
          id: 'reader-batch-action',
        });
      } catch (err) {
        if (attachmentEpochRef.current === startEpoch) {
          toast.error('Batch update failed', {
            description: getErrorMessage(err),
            id: 'reader-batch-action',
          });
        }
      } finally {
        if (attachmentEpochRef.current === startEpoch) {
          isProcessingRef.current = false;
          setIsBatchProcessing(false);
        }
      }
    },
    [effectiveAttachmentId, selectedAnnotationIds, qc, scopeId, isBatchProcessing, updateUndoStack, updateRedoStack],
  );

  const handleBatchDelete = useCallback(
    async (targetIds?: string[]) => {
      const ids = targetIds && targetIds.length > 0 ? targetIds : Array.from(selectedAnnotationIds);
      if (!effectiveAttachmentId || ids.length === 0 || isProcessingRef.current || isBatchProcessing) return;
      const startEpoch = attachmentEpochRef.current;
      isProcessingRef.current = true;
      setIsBatchProcessing(true);
      try {
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(scopeId, effectiveAttachmentId)) || [];
        const targetSet = new Set(ids);
        const deletedItems = existing.filter((a) => targetSet.has(a.id));

        await executeAnnotationBatchSync(qc, scopeId, effectiveAttachmentId, {
          upserts: [],
          deletes: ids,
        });

        if (attachmentEpochRef.current !== startEpoch) return;

        pruneDeletedFromHistory(ids);
        updateUndoStack((prev) => [...prev.slice(-19), { type: 'delete', items: deletedItems }]);
        updateRedoStack([]);

        setSelectedAnnotationIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });

        toast.success(`Deleted ${ids.length} highlight${ids.length > 1 ? 's' : ''}`, {
          id: 'reader-batch-action',
        });
      } catch (err) {
        if (attachmentEpochRef.current === startEpoch) {
          toast.error('Batch delete failed', {
            description: getErrorMessage(err),
            id: 'reader-batch-action',
          });
        }
      } finally {
        if (attachmentEpochRef.current === startEpoch) {
          isProcessingRef.current = false;
          setIsBatchProcessing(false);
        }
      }
    },
    [effectiveAttachmentId, selectedAnnotationIds, qc, scopeId, isBatchProcessing, pruneDeletedFromHistory, updateUndoStack, updateRedoStack],
  );

  const recordDeletedAnnotations = useCallback((items: ReaderAnnotation[]) => {
    if (!items || items.length === 0) return;
    updateUndoStack((prev) => [...prev.slice(-19), { type: 'delete', items }]);
    updateRedoStack([]);
  }, []);

  const recordSingleDeleteAnnotation = useCallback((annotation: ReaderAnnotation) => {
    if (!annotation) return;
    updateUndoStack((prev) => [...prev.slice(-19), { type: 'delete', items: [annotation] }]);
    updateRedoStack([]);
  }, []);

  const recordCreateAnnotation = useCallback(
    (createdAnnotation: ReaderAnnotation, attachmentId?: string) => {
      const targetAttId = attachmentId || effectiveAttachmentId;
      if (!createdAnnotation || !targetAttId) return;
      updateUndoStack((prev) => [
        ...prev.slice(-19),
        { type: 'create', createdAnnotation, attachmentId: targetAttId },
      ]);
      updateRedoStack([]);
    },
    [effectiveAttachmentId],
  );

  const recordUpdateAnnotation = useCallback(
    (params: {
      annotationId: string;
      attachmentId?: string;
      before: Partial<ReaderAnnotation>;
      after: Partial<ReaderAnnotation>;
      version?: number;
    }) => {
      const targetAttId = params.attachmentId || effectiveAttachmentId;
      if (!params.annotationId || !targetAttId) return;
      updateUndoStack((prev) => [
        ...prev.slice(-19),
        {
          type: 'update',
          annotationId: params.annotationId,
          attachmentId: targetAttId,
          before: params.before,
          after: params.after,
          version: params.version,
        },
      ]);
      updateRedoStack([]);
    },
    [effectiveAttachmentId],
  );

  const handleBatchAddToNote = useCallback(
    async (targetIds?: string[]) => {
      const ids = targetIds && targetIds.length > 0 ? targetIds : Array.from(selectedAnnotationIds);
      if (!effectiveAttachmentId || ids.length === 0 || !paper?.id) return;

      useLibraryUIStore.getState().setIsInspectorOpen(true);
      useLibraryUIStore.getState().setActiveInspectorTab('notes');

      if (extractNotes) {
        await extractNotes(paper.id, {
          attachmentId: effectiveAttachmentId,
          annotationIds: ids,
        });
      } else {
        await executeExtractAnnotationNotes(scopeId, paper.id, {
          attachmentId: effectiveAttachmentId,
          annotationIds: ids,
        });
      }
    },
    [effectiveAttachmentId, selectedAnnotationIds, scopeId, paper?.id, extractNotes],
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
    recordCreateAnnotation,
    recordUpdateAnnotation,
    recordSingleDeleteAnnotation,
    recordDeletedAnnotations,
    pruneDeletedFromHistory,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}

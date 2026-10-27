'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/utils';
import { AnnotationsService } from '@/features/library/sdk/library.client';
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

export type UndoAction =
  | {
      type: 'create';
      createdAnnotation: ReaderAnnotation;
      attachmentId: string;
    }
  | {
      type: 'update';
      annotationId: string;
      attachmentId: string;
      before: Partial<ReaderAnnotation>;
      after: Partial<ReaderAnnotation>;
      version?: number;
    }
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
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<UndoAction[]>([]);
  const isProcessingRef = useRef(false);
  const attachmentEpochRef = useRef(0);

  useEffect(() => {
    undoStackRef.current = undoStack;
  }, [undoStack]);

  useEffect(() => {
    redoStackRef.current = redoStack;
  }, [redoStack]);

  useEffect(() => {
    attachmentEpochRef.current += 1;
    isProcessingRef.current = false;
    setIsBatchProcessing(false);
    setSelectedAnnotationIds(new Set());
    setUndoStack([]);
    setRedoStack([]);
    undoStackRef.current = [];
    redoStackRef.current = [];
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
      if (action.type === 'create') {
        return deletedSet.has(action.createdAnnotation.id) ? null : action;
      }
      if (action.type === 'update') {
        return deletedSet.has(action.annotationId) ? null : action;
      }
      const remaining = action.items.filter((it) => !deletedSet.has(it.id));
      return remaining.length === 0 ? null : ({ ...action, items: remaining } as UndoAction);
    };
    setUndoStack((prev) => prev.map(filterAction).filter((a): a is UndoAction => a !== null));
    setRedoStack((prev) => prev.map(filterAction).filter((a): a is UndoAction => a !== null));
  }, []);

  const undo = useCallback(async () => {
    const currentStack = undoStackRef.current;
    if (!effectiveAttachmentId || currentStack.length === 0 || isProcessingRef.current || isBatchProcessing) return;
    const action = currentStack[currentStack.length - 1];
    if (!action) return;

    isProcessingRef.current = true;
    setIsBatchProcessing(true);
    try {
      if (action.type === 'create') {
        const targetAttId = action.attachmentId || effectiveAttachmentId;
        await AnnotationsService.batch(scopeId, targetAttId, {
          upserts: [],
          deletes: [action.createdAnnotation.id],
        });
        qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(scopeId, targetAttId) });
        setUndoStack((prev) => prev.slice(0, prev.length - 1));
        setRedoStack((prev) => [...prev.slice(-19), action]);
        toast.success('Undid annotation creation');
      } else if (action.type === 'update') {
        const targetAttId = action.attachmentId || effectiveAttachmentId;
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(scopeId, targetAttId)) || [];
        const found = existing.find((a) => a.id === action.annotationId);
        if (!found) {
          setUndoStack((prev) => prev.slice(0, prev.length - 1));
          return;
        }
        await AnnotationsService.update(
          scopeId,
          targetAttId,
          action.annotationId,
          found.version ?? action.version ?? 1,
          {
            ...(action.before.color !== undefined ? { color: action.before.color } : {}),
            ...(action.before.comment !== undefined ? { comment: action.before.comment } : {}),
            ...(action.before.quoteText !== undefined ? { quoteText: action.before.quoteText } : {}),
            ...(action.before.tags !== undefined ? { tags: action.before.tags } : {}),
          },
        );
        qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(scopeId, targetAttId) });
        setUndoStack((prev) => prev.slice(0, prev.length - 1));
        setRedoStack((prev) => [...prev.slice(-19), action]);
        toast.success('Reverted annotation edit');
      } else if (action.type === 'delete') {
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
        await AnnotationsService.batch(scopeId, effectiveAttachmentId, {
          upserts,
          deletes: [],
        });
        qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId) });
        setUndoStack((prev) => prev.slice(0, prev.length - 1));
        setRedoStack((prev) => [...prev.slice(-19), action]);
        toast.success(`Restored ${action.items.length} annotation${action.items.length > 1 ? 's' : ''}`);
      } else if (action.type === 'color' || action.type === 'tag') {
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(scopeId, effectiveAttachmentId)) || [];
        const existingMap = new Map(existing.map((a) => [a.id, a]));
        const liveItems = action.items.filter((item) => existingMap.has(item.id));
        if (liveItems.length === 0) {
          setUndoStack((prev) => prev.slice(0, prev.length - 1));
          return;
        }
        await AnnotationsService.batch(scopeId, effectiveAttachmentId, {
          upserts: liveItems.map((item) => {
            const found = existingMap.get(item.id)!;
            return {
              id: item.id,
              pageIndex: found.pageIndex,
              color:
                action.type === 'color'
                  ? (item as { prevColor: string }).prevColor
                  : found.color,
              rects: found.rects,
              quoteText: found.quoteText,
              comment: found.comment,
              tags:
                action.type === 'tag'
                  ? (item as { prevTags: string[] }).prevTags
                  : found.tags,
              type: found.type,
              expectedVersion: found.version ?? item.version,
            };
          }),
          deletes: [],
        });
        qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId) });
        setUndoStack((prev) => prev.slice(0, prev.length - 1));
        setRedoStack((prev) => [...prev.slice(-19), { ...action, items: liveItems } as UndoAction]);
        toast.success(action.type === 'color' ? 'Reverted color change' : 'Reverted tag change');
      }
    } catch (err) {
      toast.error('Undo failed', { description: getErrorMessage(err) });
    } finally {
      isProcessingRef.current = false;
      setIsBatchProcessing(false);
    }
  }, [effectiveAttachmentId, scopeId, qc, isBatchProcessing]);

  const redo = useCallback(async () => {
    const currentStack = redoStackRef.current;
    if (!effectiveAttachmentId || currentStack.length === 0 || isProcessingRef.current || isBatchProcessing) return;
    const action = currentStack[currentStack.length - 1];
    if (!action) return;

    isProcessingRef.current = true;
    setIsBatchProcessing(true);
    try {
      if (action.type === 'create') {
        const targetAttId = action.attachmentId || effectiveAttachmentId;
        const item = action.createdAnnotation;
        await AnnotationsService.batch(scopeId, targetAttId, {
          upserts: [
            {
              id: item.id,
              pageIndex: item.pageIndex,
              color: item.color,
              rects: item.rects,
              quoteText: item.quoteText,
              comment: item.comment,
              tags: item.tags,
              type: item.type,
              expectedVersion: 0,
            },
          ],
          deletes: [],
        });
        qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(scopeId, targetAttId) });
        setRedoStack((prev) => prev.slice(0, prev.length - 1));
        setUndoStack((prev) => [...prev.slice(-19), action]);
        toast.success('Restored annotation');
      } else if (action.type === 'update') {
        const targetAttId = action.attachmentId || effectiveAttachmentId;
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(scopeId, targetAttId)) || [];
        const found = existing.find((a) => a.id === action.annotationId);
        if (!found) {
          setRedoStack((prev) => prev.slice(0, prev.length - 1));
          return;
        }
        await AnnotationsService.update(
          scopeId,
          targetAttId,
          action.annotationId,
          found.version ?? action.version ?? 1,
          {
            ...(action.after.color !== undefined ? { color: action.after.color } : {}),
            ...(action.after.comment !== undefined ? { comment: action.after.comment } : {}),
            ...(action.after.quoteText !== undefined ? { quoteText: action.after.quoteText } : {}),
            ...(action.after.tags !== undefined ? { tags: action.after.tags } : {}),
          },
        );
        qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(scopeId, targetAttId) });
        setRedoStack((prev) => prev.slice(0, prev.length - 1));
        setUndoStack((prev) => [...prev.slice(-19), action]);
        toast.success('Re-applied annotation edit');
      } else if (action.type === 'delete') {
        const deletes = action.items.map((a) => a.id);
        await AnnotationsService.batch(scopeId, effectiveAttachmentId, {
          upserts: [],
          deletes,
        });
        qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId) });
        setRedoStack((prev) => prev.slice(0, prev.length - 1));
        setUndoStack((prev) => [...prev.slice(-19), action]);
        toast.success(`Re-deleted ${deletes.length} annotation${deletes.length > 1 ? 's' : ''}`);
      } else if (action.type === 'color' || action.type === 'tag') {
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(scopeId, effectiveAttachmentId)) || [];
        const existingMap = new Map(existing.map((a) => [a.id, a]));
        const liveItems = action.items.filter((item) => existingMap.has(item.id));
        if (liveItems.length === 0) {
          setRedoStack((prev) => prev.slice(0, prev.length - 1));
          return;
        }
        await AnnotationsService.batch(scopeId, effectiveAttachmentId, {
          upserts: liveItems.map((item) => {
            const found = existingMap.get(item.id)!;
            return {
              id: item.id,
              pageIndex: found.pageIndex,
              color:
                action.type === 'color'
                  ? (item as { newColor: string }).newColor
                  : found.color,
              rects: found.rects,
              quoteText: found.quoteText,
              comment: found.comment,
              tags:
                action.type === 'tag'
                  ? (item as { newTags: string[] }).newTags
                  : found.tags,
              type: found.type,
              expectedVersion: found.version ?? item.version,
            };
          }),
          deletes: [],
        });
        qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId) });
        setRedoStack((prev) => prev.slice(0, prev.length - 1));
        setUndoStack((prev) => [...prev.slice(-19), { ...action, items: liveItems } as UndoAction]);
        toast.success(action.type === 'color' ? 'Re-applied color change' : 'Re-applied tag change');
      }
    } catch (err) {
      toast.error('Redo failed', { description: getErrorMessage(err) });
    } finally {
      isProcessingRef.current = false;
      setIsBatchProcessing(false);
    }
  }, [effectiveAttachmentId, scopeId, qc, isBatchProcessing]);

  // Keyboard shortcut for Undo (Ctrl+Z) / Redo (Ctrl+Y or Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
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

        await AnnotationsService.batch(scopeId, effectiveAttachmentId, {
          upserts,
          deletes: [],
        });

        qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId) });
        setUndoStack((prev) => [...prev.slice(-19), { type: 'color', items: historyItems }]);
        setRedoStack([]);

        toast.success(`Updated color for ${ids.length} highlight${ids.length > 1 ? 's' : ''}`, {
          id: 'reader-batch-action',
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
    [effectiveAttachmentId, selectedAnnotationIds, qc, scopeId, isBatchProcessing],
  );

  const handleBatchDelete = useCallback(
    async (targetIds?: string[]) => {
      const ids = targetIds && targetIds.length > 0 ? targetIds : Array.from(selectedAnnotationIds);
      if (!effectiveAttachmentId || ids.length === 0 || isProcessingRef.current || isBatchProcessing) return;
      isProcessingRef.current = true;
      setIsBatchProcessing(true);
      try {
        const existing =
          qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(scopeId, effectiveAttachmentId)) || [];
        const targetSet = new Set(ids);
        const deletedItems = existing.filter((a) => targetSet.has(a.id));

        await AnnotationsService.batch(scopeId, effectiveAttachmentId, {
          upserts: [],
          deletes: ids,
        });

        qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(scopeId, effectiveAttachmentId) });
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
    [effectiveAttachmentId, selectedAnnotationIds, qc, scopeId, isBatchProcessing, pruneDeletedFromHistory],
  );

  const recordDeletedAnnotations = useCallback((items: ReaderAnnotation[]) => {
    if (!items || items.length === 0) return;
    setUndoStack((prev) => [...prev.slice(-19), { type: 'delete', items }]);
    setRedoStack([]);
  }, []);

  const recordSingleDeleteAnnotation = useCallback((annotation: ReaderAnnotation) => {
    if (!annotation) return;
    setUndoStack((prev) => [...prev.slice(-19), { type: 'delete', items: [annotation] }]);
    setRedoStack([]);
  }, []);

  const recordCreateAnnotation = useCallback(
    (createdAnnotation: ReaderAnnotation, attachmentId?: string) => {
      const targetAttId = attachmentId || effectiveAttachmentId;
      if (!createdAnnotation || !targetAttId) return;
      setUndoStack((prev) => [
        ...prev.slice(-19),
        { type: 'create', createdAnnotation, attachmentId: targetAttId },
      ]);
      setRedoStack([]);
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
      setUndoStack((prev) => [
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
      setRedoStack([]);
    },
    [effectiveAttachmentId],
  );

  const handleBatchAddToNote = useCallback(
    (targetIds?: string[]) => {
      const ids = targetIds && targetIds.length > 0 ? targetIds : Array.from(selectedAnnotationIds);
      if (!effectiveAttachmentId || ids.length === 0) return;
      const idSet = new Set(ids);
      const existing =
        qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(scopeId, effectiveAttachmentId)) || [];
      const selected = PdfAnnotationEngine.sortAnnotationsInReadingOrder(
        existing.filter((a) => idSet.has(a.id)),
      );
      const quotes = PdfAnnotationEngine.synthesizeMarkdownNote(selected, paper, effectiveAttachmentId);

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

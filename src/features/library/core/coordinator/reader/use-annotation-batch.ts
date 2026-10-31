'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/utils';
import { AnnotationsService, type ExtractNotesOptions } from '@/features/library/sdk';
import { annotationKeys } from '@/features/library/sdk/query-keys';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import type {
  ReaderAnnotation,
  ReaderDocument,
} from '@/features/library/domain/types/reader.schema';

export interface UseAnnotationBatchOptions {
  scopeId: string;
  effectiveAttachmentId?: string;
  paper: ReaderDocument | null;
  setPendingNoteText: (text: string) => void;
  extractNotes?: (paperId: string, options?: ExtractNotesOptions) => Promise<unknown>;
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

export type HistoryEntry = UndoAction;

export interface AnnotationHistoryContext {
  scopeId: string;
  effectiveAttachmentId: string;
  qc: ReturnType<typeof useQueryClient>;
  updateUndoStack: (updater: UndoAction[] | ((prev: UndoAction[]) => UndoAction[])) => void;
  updateRedoStack: (updater: UndoAction[] | ((prev: UndoAction[]) => UndoAction[])) => void;
}

export interface AnnotationHistoryStrategy<T extends UndoAction = UndoAction> {
  prune(entry: T, deletedSet: ReadonlySet<string>): T | null;
  undo(entry: T, ctx: AnnotationHistoryContext): Promise<void>;
  redo(entry: T, ctx: AnnotationHistoryContext): Promise<void>;
}

export const ANNOTATION_HISTORY_HANDLERS: {
  [K in HistoryEntry['type']]: AnnotationHistoryStrategy<Extract<HistoryEntry, { type: K }>>;
} = {
  create: {
    prune: (entry, deletedSet) =>
      deletedSet.has(entry.createdAnnotation.id) ? null : entry,
    undo: async (entry, ctx) => {
      const targetAttId = entry.attachmentId || ctx.effectiveAttachmentId;
      await AnnotationsService.batch(ctx.scopeId, targetAttId, {
        upserts: [],
        deletes: [entry.createdAnnotation.id],
      });
      ctx.qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(ctx.scopeId, targetAttId) });
      ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateRedoStack((prev) => [...prev.slice(-19), entry]);
      toast.success('Undid annotation creation');
    },
    redo: async (entry, ctx) => {
      const targetAttId = entry.attachmentId || ctx.effectiveAttachmentId;
      const item = entry.createdAnnotation;
      await AnnotationsService.batch(ctx.scopeId, targetAttId, {
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
          },
        ],
        deletes: [],
      });
      ctx.qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(ctx.scopeId, targetAttId) });
      ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateUndoStack((prev) => [...prev.slice(-19), entry]);
      toast.success('Restored annotation');
    },
  },
  update: {
    prune: (entry, deletedSet) =>
      deletedSet.has(entry.annotationId) ? null : entry,
    undo: async (entry, ctx) => {
      const targetAttId = entry.attachmentId || ctx.effectiveAttachmentId;
      const existing =
        ctx.qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(ctx.scopeId, targetAttId)) || [];
      const found = existing.find((a) => a.id === entry.annotationId);
      if (!found) {
        ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
        return;
      }
      await AnnotationsService.update(
        ctx.scopeId,
        targetAttId,
        entry.annotationId,
        found.version ?? entry.version ?? 1,
        {
          ...(entry.before.color !== undefined ? { color: entry.before.color } : {}),
          ...(entry.before.comment !== undefined ? { comment: entry.before.comment } : {}),
          ...(entry.before.quoteText !== undefined ? { quoteText: entry.before.quoteText } : {}),
          ...(entry.before.tags !== undefined ? { tags: entry.before.tags } : {}),
        },
      );
      ctx.qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(ctx.scopeId, targetAttId) });
      ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateRedoStack((prev) => [...prev.slice(-19), entry]);
      toast.success('Reverted annotation edit');
    },
    redo: async (entry, ctx) => {
      const targetAttId = entry.attachmentId || ctx.effectiveAttachmentId;
      const existing =
        ctx.qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(ctx.scopeId, targetAttId)) || [];
      const found = existing.find((a) => a.id === entry.annotationId);
      if (!found) {
        ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
        return;
      }
      await AnnotationsService.update(
        ctx.scopeId,
        targetAttId,
        entry.annotationId,
        found.version ?? entry.version ?? 1,
        {
          ...(entry.after.color !== undefined ? { color: entry.after.color } : {}),
          ...(entry.after.comment !== undefined ? { comment: entry.after.comment } : {}),
          ...(entry.after.quoteText !== undefined ? { quoteText: entry.after.quoteText } : {}),
          ...(entry.after.tags !== undefined ? { tags: entry.after.tags } : {}),
        },
      );
      ctx.qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(ctx.scopeId, targetAttId) });
      ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateUndoStack((prev) => [...prev.slice(-19), entry]);
      toast.success('Re-applied annotation edit');
    },
  },
  delete: {
    prune: (entry) => entry,
    undo: async (entry, ctx) => {
      const upserts = entry.items.map((item) => ({
        id: item.id,
        pageIndex: item.pageIndex,
        color: item.color,
        rects: item.rects,
        quoteText: item.quoteText,
        comment: item.comment,
        tags: item.tags,
        type: item.type,
      }));
      await AnnotationsService.batch(ctx.scopeId, ctx.effectiveAttachmentId, {
        upserts,
        deletes: [],
      });
      ctx.qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(ctx.scopeId, ctx.effectiveAttachmentId) });
      ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateRedoStack((prev) => [...prev.slice(-19), entry]);
      toast.success(`Restored ${entry.items.length} annotation${entry.items.length > 1 ? 's' : ''}`);
    },
    redo: async (entry, ctx) => {
      const deletes = entry.items.map((a) => a.id);
      await AnnotationsService.batch(ctx.scopeId, ctx.effectiveAttachmentId, {
        upserts: [],
        deletes,
      });
      ctx.qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(ctx.scopeId, ctx.effectiveAttachmentId) });
      ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateUndoStack((prev) => [...prev.slice(-19), entry]);
      toast.success(`Re-deleted ${deletes.length} annotation${deletes.length > 1 ? 's' : ''}`);
    },
  },
  color: {
    prune: (entry, deletedSet) => {
      const remaining = entry.items.filter((it) => !deletedSet.has(it.id));
      return remaining.length === 0 ? null : { ...entry, items: remaining };
    },
    undo: async (entry, ctx) => {
      const existing =
        ctx.qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(ctx.scopeId, ctx.effectiveAttachmentId)) || [];
      const existingMap = new Map(existing.map((a) => [a.id, a]));
      const liveItems = entry.items.filter((item) => existingMap.has(item.id));
      if (liveItems.length === 0) {
        ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
        return;
      }
      await AnnotationsService.batch(ctx.scopeId, ctx.effectiveAttachmentId, {
        upserts: liveItems.map((item) => {
          const found = existingMap.get(item.id)!;
          return {
            id: item.id,
            pageIndex: found.pageIndex,
            color: item.prevColor,
            rects: found.rects,
            quoteText: found.quoteText,
            comment: found.comment,
            tags: found.tags,
            type: found.type,
            expectedVersion: found.version ?? item.version,
          };
        }),
        deletes: [],
      });
      ctx.qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(ctx.scopeId, ctx.effectiveAttachmentId) });
      ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateRedoStack((prev) => [...prev.slice(-19), { ...entry, items: liveItems }]);
      toast.success('Reverted color change');
    },
    redo: async (entry, ctx) => {
      const existing =
        ctx.qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(ctx.scopeId, ctx.effectiveAttachmentId)) || [];
      const existingMap = new Map(existing.map((a) => [a.id, a]));
      const liveItems = entry.items.filter((item) => existingMap.has(item.id));
      if (liveItems.length === 0) {
        ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
        return;
      }
      await AnnotationsService.batch(ctx.scopeId, ctx.effectiveAttachmentId, {
        upserts: liveItems.map((item) => {
          const found = existingMap.get(item.id)!;
          return {
            id: item.id,
            pageIndex: found.pageIndex,
            color: item.newColor,
            rects: found.rects,
            quoteText: found.quoteText,
            comment: found.comment,
            tags: found.tags,
            type: found.type,
            expectedVersion: found.version ?? item.version,
          };
        }),
        deletes: [],
      });
      ctx.qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(ctx.scopeId, ctx.effectiveAttachmentId) });
      ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateUndoStack((prev) => [...prev.slice(-19), { ...entry, items: liveItems }]);
      toast.success('Re-applied color change');
    },
  },
  tag: {
    prune: (entry, deletedSet) => {
      const remaining = entry.items.filter((it) => !deletedSet.has(it.id));
      return remaining.length === 0 ? null : { ...entry, items: remaining };
    },
    undo: async (entry, ctx) => {
      const existing =
        ctx.qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(ctx.scopeId, ctx.effectiveAttachmentId)) || [];
      const existingMap = new Map(existing.map((a) => [a.id, a]));
      const liveItems = entry.items.filter((item) => existingMap.has(item.id));
      if (liveItems.length === 0) {
        ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
        return;
      }
      await AnnotationsService.batch(ctx.scopeId, ctx.effectiveAttachmentId, {
        upserts: liveItems.map((item) => {
          const found = existingMap.get(item.id)!;
          return {
            id: item.id,
            pageIndex: found.pageIndex,
            color: found.color,
            rects: found.rects,
            quoteText: found.quoteText,
            comment: found.comment,
            tags: item.prevTags,
            type: found.type,
            expectedVersion: found.version ?? item.version,
          };
        }),
        deletes: [],
      });
      ctx.qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(ctx.scopeId, ctx.effectiveAttachmentId) });
      ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateRedoStack((prev) => [...prev.slice(-19), { ...entry, items: liveItems }]);
      toast.success('Reverted tag change');
    },
    redo: async (entry, ctx) => {
      const existing =
        ctx.qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(ctx.scopeId, ctx.effectiveAttachmentId)) || [];
      const existingMap = new Map(existing.map((a) => [a.id, a]));
      const liveItems = entry.items.filter((item) => existingMap.has(item.id));
      if (liveItems.length === 0) {
        ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
        return;
      }
      await AnnotationsService.batch(ctx.scopeId, ctx.effectiveAttachmentId, {
        upserts: liveItems.map((item) => {
          const found = existingMap.get(item.id)!;
          return {
            id: item.id,
            pageIndex: found.pageIndex,
            color: found.color,
            rects: found.rects,
            quoteText: found.quoteText,
            comment: found.comment,
            tags: item.newTags,
            type: found.type,
            expectedVersion: found.version ?? item.version,
          };
        }),
        deletes: [],
      });
      ctx.qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(ctx.scopeId, ctx.effectiveAttachmentId) });
      ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateUndoStack((prev) => [...prev.slice(-19), { ...entry, items: liveItems }]);
      toast.success('Re-applied tag change');
    },
  },
};

function dispatchPruneHistoryEntry(action: UndoAction, deletedSet: ReadonlySet<string>): UndoAction | null {
  const handler = ANNOTATION_HISTORY_HANDLERS[action.type] as AnnotationHistoryStrategy<UndoAction>;
  return handler.prune(action, deletedSet);
}

async function dispatchUndoHistoryEntry(action: UndoAction, ctx: AnnotationHistoryContext): Promise<void> {
  const handler = ANNOTATION_HISTORY_HANDLERS[action.type] as AnnotationHistoryStrategy<UndoAction>;
  await handler.undo(action, ctx);
}

async function dispatchRedoHistoryEntry(action: UndoAction, ctx: AnnotationHistoryContext): Promise<void> {
  const handler = ANNOTATION_HISTORY_HANDLERS[action.type] as AnnotationHistoryStrategy<UndoAction>;
  await handler.redo(action, ctx);
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

    isProcessingRef.current = true;
    setIsBatchProcessing(true);
    try {
      await dispatchUndoHistoryEntry(action, {
        scopeId,
        effectiveAttachmentId,
        qc,
        updateUndoStack,
        updateRedoStack,
      });
    } catch (err) {
      toast.error('Undo failed', { description: getErrorMessage(err) });
    } finally {
      isProcessingRef.current = false;
      setIsBatchProcessing(false);
    }
  }, [effectiveAttachmentId, scopeId, qc, isBatchProcessing, updateUndoStack, updateRedoStack]);

  const redo = useCallback(async () => {
    const currentStack = redoStackRef.current;
    if (!effectiveAttachmentId || currentStack.length === 0 || isProcessingRef.current || isBatchProcessing) return;
    const action = currentStack[currentStack.length - 1];
    if (!action) return;

    isProcessingRef.current = true;
    setIsBatchProcessing(true);
    try {
      await dispatchRedoHistoryEntry(action, {
        scopeId,
        effectiveAttachmentId,
        qc,
        updateUndoStack,
        updateRedoStack,
      });
    } catch (err) {
      toast.error('Redo failed', { description: getErrorMessage(err) });
    } finally {
      isProcessingRef.current = false;
      setIsBatchProcessing(false);
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
        updateUndoStack((prev) => [...prev.slice(-19), { type: 'color', items: historyItems }]);
        updateRedoStack([]);

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
        await AnnotationsService.extractNotes(scopeId, paper.id, {
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

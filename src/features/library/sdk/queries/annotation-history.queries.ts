'use client';

import type { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AnnotationsService } from '../clients/annotations.client';
import { annotationKeys } from '@/features/library/sdk/query-keys';
import type { ReaderAnnotation } from '@/features/library/types/reader.types';

export type UndoAction =
  | {
      type: 'create';
      createdAnnotation: ReaderAnnotation;
      attachmentId: string;
      timestamp?: number;
    }
  | {
      type: 'update';
      annotationId: string;
      attachmentId: string;
      before: Partial<ReaderAnnotation>;
      after: Partial<ReaderAnnotation>;
      version?: number;
      timestamp?: number;
    }
  | {
      type: 'delete';
      items: ReaderAnnotation[];
      timestamp?: number;
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
      timestamp?: number;
    };

export type HistoryEntry = UndoAction;
export type AnnotationHistoryEntry = UndoAction & { timestamp: number };

export interface AnnotationHistoryContext {
  spaceId: string;
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

export async function executeAnnotationBatchSync(
  qc: ReturnType<typeof useQueryClient>,
  spaceId: string,
  attachmentId: string,
  payload: Parameters<typeof AnnotationsService.batch>[2],
): Promise<void> {
  await AnnotationsService.batch(spaceId, attachmentId, payload);
  await qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(spaceId, attachmentId) });
}

export const ANNOTATION_HISTORY_HANDLERS: {
  [K in HistoryEntry['type']]: AnnotationHistoryStrategy<Extract<HistoryEntry, { type: K }>>;
} = {
  create: {
    prune: (entry, deletedSet) => (deletedSet.has(entry.createdAnnotation.id) ? null : entry),
    undo: async (entry, ctx) => {
      const targetAttId = entry.attachmentId || ctx.effectiveAttachmentId;
      await executeAnnotationBatchSync(ctx.qc, ctx.spaceId, targetAttId, {
        upserts: [],
        deletes: [entry.createdAnnotation.id],
      });
      ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateRedoStack((prev) => [...prev.slice(-19), { ...entry, timestamp: Date.now() }]);
      toast.success('Undid annotation creation', { id: 'reader-history-action', duration: 1500 });
    },
    redo: async (entry, ctx) => {
      const targetAttId = entry.attachmentId || ctx.effectiveAttachmentId;
      const item = entry.createdAnnotation;
      await executeAnnotationBatchSync(ctx.qc, ctx.spaceId, targetAttId, {
        upserts: [
          {
            id: item.id,
            pageIndex: item.pageIndex,
            pageLabel: item.pageLabel ?? null,
            annotationSortIndex: item.annotationSortIndex ?? null,
            color: item.color,
            rects: item.rects,
            boundingRect: item.boundingRect,
            quoteText: item.quoteText,
            comment: item.comment,
            tags: item.tags,
            type: item.type,
          },
        ],
        deletes: [],
      });
      ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateUndoStack((prev) => [...prev.slice(-19), { ...entry, timestamp: Date.now() }]);
      toast.success('Restored annotation', { id: 'reader-history-action', duration: 1500 });
    },
  },
  update: {
    prune: (entry, deletedSet) => (deletedSet.has(entry.annotationId) ? null : entry),
    undo: async (entry, ctx) => {
      const targetAttId = entry.attachmentId || ctx.effectiveAttachmentId;
      const existing =
        ctx.qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(ctx.spaceId, targetAttId)) || [];
      const found = existing.find((a) => a.id === entry.annotationId);
      if (!found) {
        ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
        return;
      }
      await AnnotationsService.update(
        ctx.spaceId,
        targetAttId,
        entry.annotationId,
        found.version ?? entry.version ?? 1,
        {
          ...(entry.before.color !== undefined ? { color: entry.before.color } : {}),
          ...(entry.before.comment !== undefined ? { comment: entry.before.comment } : {}),
          ...(entry.before.quoteText !== undefined ? { quoteText: entry.before.quoteText } : {}),
          ...(entry.before.tags !== undefined ? { tags: entry.before.tags } : {}),
          ...(entry.before.type !== undefined ? { type: entry.before.type } : {}),
          ...(entry.before.pageLabel !== undefined ? { pageLabel: entry.before.pageLabel } : {}),
          ...(entry.before.rects !== undefined ? { rects: entry.before.rects } : {}),
          ...(entry.before.boundingRect !== undefined ? { boundingRect: entry.before.boundingRect } : {}),
        },
      );
      await ctx.qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(ctx.spaceId, targetAttId) });
      ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateRedoStack((prev) => [...prev.slice(-19), { ...entry, timestamp: Date.now() }]);
      toast.success('Reverted annotation edit', { id: 'reader-history-action', duration: 1500 });
    },
    redo: async (entry, ctx) => {
      const targetAttId = entry.attachmentId || ctx.effectiveAttachmentId;
      const existing =
        ctx.qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(ctx.spaceId, targetAttId)) || [];
      const found = existing.find((a) => a.id === entry.annotationId);
      if (!found) {
        ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
        return;
      }
      await AnnotationsService.update(
        ctx.spaceId,
        targetAttId,
        entry.annotationId,
        found.version ?? entry.version ?? 1,
        {
          ...(entry.after.color !== undefined ? { color: entry.after.color } : {}),
          ...(entry.after.comment !== undefined ? { comment: entry.after.comment } : {}),
          ...(entry.after.quoteText !== undefined ? { quoteText: entry.after.quoteText } : {}),
          ...(entry.after.tags !== undefined ? { tags: entry.after.tags } : {}),
          ...(entry.after.type !== undefined ? { type: entry.after.type } : {}),
          ...(entry.after.pageLabel !== undefined ? { pageLabel: entry.after.pageLabel } : {}),
          ...(entry.after.rects !== undefined ? { rects: entry.after.rects } : {}),
          ...(entry.after.boundingRect !== undefined ? { boundingRect: entry.after.boundingRect } : {}),
        },
      );
      await ctx.qc.invalidateQueries({ queryKey: annotationKeys.byAttachment(ctx.spaceId, targetAttId) });
      ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateUndoStack((prev) => [...prev.slice(-19), { ...entry, timestamp: Date.now() }]);
      toast.success('Re-applied annotation edit', { id: 'reader-history-action', duration: 1500 });
    },
  },
  delete: {
    prune: (entry) => entry,
    undo: async (entry, ctx) => {
      const upserts = entry.items.map((item) => ({
        id: item.id,
        pageIndex: item.pageIndex,
        pageLabel: item.pageLabel ?? null,
        annotationSortIndex: item.annotationSortIndex ?? null,
        color: item.color,
        rects: item.rects,
        boundingRect: item.boundingRect,
        quoteText: item.quoteText,
        comment: item.comment,
        tags: item.tags,
        type: item.type,
      }));
      await executeAnnotationBatchSync(ctx.qc, ctx.spaceId, ctx.effectiveAttachmentId, { upserts, deletes: [] });
      ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateRedoStack((prev) => [...prev.slice(-19), { ...entry, timestamp: Date.now() }]);
      toast.success(`Restored ${entry.items.length} annotation${entry.items.length > 1 ? 's' : ''}`, { id: 'reader-history-action', duration: 1500 });
    },
    redo: async (entry, ctx) => {
      const deletes = entry.items.map((a) => a.id);
      await executeAnnotationBatchSync(ctx.qc, ctx.spaceId, ctx.effectiveAttachmentId, { upserts: [], deletes });
      ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateUndoStack((prev) => [...prev.slice(-19), { ...entry, timestamp: Date.now() }]);
      toast.success(`Re-deleted ${deletes.length} annotation${deletes.length > 1 ? 's' : ''}`, { id: 'reader-history-action', duration: 1500 });
    },
  },
  color: {
    prune: (entry, deletedSet) => {
      const remaining = entry.items.filter((it) => !deletedSet.has(it.id));
      return remaining.length === 0 ? null : { ...entry, items: remaining };
    },
    undo: async (entry, ctx) => {
      const existing =
        ctx.qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(ctx.spaceId, ctx.effectiveAttachmentId)) || [];
      const existingMap = new Map(existing.map((a) => [a.id, a]));
      const liveItems = entry.items.filter((item) => existingMap.has(item.id));
      if (liveItems.length === 0) {
        ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
        return;
      }
      await executeAnnotationBatchSync(ctx.qc, ctx.spaceId, ctx.effectiveAttachmentId, {
        upserts: liveItems.map((item) => {
          const found = existingMap.get(item.id)!;
          return {
            id: item.id,
            pageIndex: found.pageIndex,
            pageLabel: found.pageLabel ?? item.previousData.pageLabel ?? null,
            annotationSortIndex: found.annotationSortIndex ?? item.previousData.annotationSortIndex ?? null,
            color: item.prevColor,
            rects: found.rects,
            boundingRect: found.boundingRect ?? item.previousData.boundingRect,
            quoteText: found.quoteText,
            comment: found.comment,
            tags: found.tags,
            type: found.type,
            expectedVersion: found.version ?? item.version,
          };
        }),
        deletes: [],
      });
      ctx.updateUndoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateRedoStack((prev) => [...prev.slice(-19), { ...entry, items: liveItems, timestamp: Date.now() }]);
      toast.success('Reverted color change', { id: 'reader-history-action', duration: 1500 });
    },
    redo: async (entry, ctx) => {
      const existing =
        ctx.qc.getQueryData<ReaderAnnotation[]>(annotationKeys.byAttachment(ctx.spaceId, ctx.effectiveAttachmentId)) || [];
      const existingMap = new Map(existing.map((a) => [a.id, a]));
      const liveItems = entry.items.filter((item) => existingMap.has(item.id));
      if (liveItems.length === 0) {
        ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
        return;
      }
      await executeAnnotationBatchSync(ctx.qc, ctx.spaceId, ctx.effectiveAttachmentId, {
        upserts: liveItems.map((item) => {
          const found = existingMap.get(item.id)!;
          return {
            id: item.id,
            pageIndex: found.pageIndex,
            pageLabel: found.pageLabel ?? item.previousData.pageLabel ?? null,
            annotationSortIndex: found.annotationSortIndex ?? item.previousData.annotationSortIndex ?? null,
            color: item.newColor,
            rects: found.rects,
            boundingRect: found.boundingRect ?? item.previousData.boundingRect,
            quoteText: found.quoteText,
            comment: found.comment,
            tags: found.tags,
            type: found.type,
            expectedVersion: found.version ?? item.version,
          };
        }),
        deletes: [],
      });
      ctx.updateRedoStack((prev) => prev.slice(0, prev.length - 1));
      ctx.updateUndoStack((prev) => [...prev.slice(-19), { ...entry, items: liveItems, timestamp: Date.now() }]);
      toast.success('Re-applied color change', { id: 'reader-history-action', duration: 1500 });
    },
  },
};

export function pruneAnnotationHistoryEntry(
  action: UndoAction,
  deletedSet: ReadonlySet<string>,
): UndoAction | null {
  const handler = ANNOTATION_HISTORY_HANDLERS[action.type] as AnnotationHistoryStrategy<UndoAction>;
  return handler.prune(action, deletedSet);
}

export async function runUndoAnnotationHistoryAction(
  action: UndoAction,
  ctx: AnnotationHistoryContext,
): Promise<void> {
  const handler = ANNOTATION_HISTORY_HANDLERS[action.type] as AnnotationHistoryStrategy<UndoAction>;
  await handler.undo(action, ctx);
}

export async function runRedoAnnotationHistoryAction(
  action: UndoAction,
  ctx: AnnotationHistoryContext,
): Promise<void> {
  const handler = ANNOTATION_HISTORY_HANDLERS[action.type] as AnnotationHistoryStrategy<UndoAction>;
  await handler.redo(action, ctx);
}

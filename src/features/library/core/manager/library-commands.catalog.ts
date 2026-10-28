'use client';

import type { Item } from '@/features/library/domain/types/library.types';
import { extractExplicitUserMergeOverrides } from '@/features/library/domain/diff';
import type { LibraryCommand } from './library-command.manager';

// ---------------------------------------------------------------------------
// Concrete Command Factories (Command Catalog)
// ---------------------------------------------------------------------------

export interface TrashCommandOptions {
  itemIds: string[];
  itemTitle?: string;
  deleteMutation: { mutateAsync: (ids: string[]) => Promise<unknown> };
  restoreMutation: { mutateAsync: (ids: string[]) => Promise<unknown> };
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createTrashCommand(options: TrashCommandOptions): LibraryCommand {
  const count = options.itemIds.length;
  const description =
    count === 1
      ? 'Item moved to trash'
      : `Moved ${count} items to trash`;

  return {
    id: `trash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: async () => {
      await options.deleteMutation.mutateAsync(options.itemIds);
      options.onExecuted?.();
    },
    undo: async () => {
      await options.restoreMutation.mutateAsync(options.itemIds);
      options.onUndone?.();
    },
  };
}

export const createDeleteItemsCommand = createTrashCommand;

export interface RestoreCommandOptions {
  itemIds: string[];
  itemTitle?: string;
  restoreMutation: { mutateAsync: (ids: string[]) => Promise<unknown> };
  deleteMutation: { mutateAsync: (ids: string[]) => Promise<unknown> };
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createRestoreCommand(options: RestoreCommandOptions): LibraryCommand {
  const count = options.itemIds.length;
  const description =
    count === 1 && options.itemTitle
      ? `Restored "${options.itemTitle}"`
      : count === 1
        ? 'Restored 1 item'
        : `Restored ${count} items`;

  return {
    id: `restore-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: async () => {
      await options.restoreMutation.mutateAsync(options.itemIds);
      options.onExecuted?.();
    },
    undo: async () => {
      await options.deleteMutation.mutateAsync(options.itemIds);
      options.onUndone?.();
    },
  };
}

export interface MoveItemsCommandOptions {
  itemIds: string[];
  sourceCollectionId: string | null;
  targetCollectionId: string | null;
  targetCollectionName?: string;
  previousCollectionsByItem?: Map<string, string[]>;
  onUndoMove?: () => Promise<void>;
  detachMutation?: {
    mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown>;
  };
  assignMutation?: {
    mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown>;
  };
  moveMutation: {
    mutateAsync: (args: {
      targetCollectionId: string | null;
      itemIds: string[];
      sourceCollectionId?: string | null;
      scopeId?: string;
    }) => Promise<unknown>;
  };
  scopeId?: string;
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createMoveItemsCommand(options: MoveItemsCommandOptions): LibraryCommand {
  const count = options.itemIds.length;
  const destName = options.targetCollectionName || 'collection';
  const description = `Moved ${count} ${count === 1 ? 'item' : 'items'} to ${destName}`;

  return {
    id: `move-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: async () => {
      await options.moveMutation.mutateAsync({
        targetCollectionId: options.targetCollectionId,
        itemIds: options.itemIds,
        sourceCollectionId: options.sourceCollectionId,
        scopeId: options.scopeId,
      });
      options.onExecuted?.();
    },
    undo: async () => {
      if (options.onUndoMove) {
        await options.onUndoMove();
        options.onUndone?.();
        return;
      }

      if (options.sourceCollectionId && options.sourceCollectionId !== 'unfiled') {
        await options.moveMutation.mutateAsync({
          targetCollectionId: options.sourceCollectionId,
          itemIds: options.itemIds,
          sourceCollectionId: options.targetCollectionId,
          scopeId: options.scopeId,
        });
        options.onUndone?.();
        return;
      }

      // When moved from "All Papers" (sourceCollectionId = null), restore exact previous collections
      // or detach from targetCollectionId without stripping unrelated collection memberships via 'unfiled'.
      if (options.previousCollectionsByItem && options.previousCollectionsByItem.size > 0) {
        if (options.targetCollectionId && options.detachMutation) {
          const itemsNotPreviouslyInTarget = options.itemIds.filter((id) => {
            const prevCols = options.previousCollectionsByItem?.get(id) || [];
            return !prevCols.includes(options.targetCollectionId!);
          });
          if (itemsNotPreviouslyInTarget.length > 0) {
            await options.detachMutation.mutateAsync({
              collectionId: options.targetCollectionId,
              itemIds: itemsNotPreviouslyInTarget,
            });
          }
        }
        if (options.assignMutation) {
          const collectionToItems = new Map<string, string[]>();
          for (const [id, prevCols] of options.previousCollectionsByItem.entries()) {
            for (const colId of prevCols) {
              if (!colId || colId === options.targetCollectionId) continue;
              const list = collectionToItems.get(colId) || [];
              list.push(id);
              collectionToItems.set(colId, list);
            }
          }
          await Promise.all(
            Array.from(collectionToItems.entries(), ([colId, ids]) =>
              options.assignMutation!.mutateAsync({
                collectionId: colId,
                itemIds: ids,
              }),
            ),
          );
        }
        options.onUndone?.();
        return;
      }

      if (options.targetCollectionId && options.detachMutation) {
        await options.detachMutation.mutateAsync({
          collectionId: options.targetCollectionId,
          itemIds: options.itemIds,
        });
        options.onUndone?.();
        return;
      }

      await options.moveMutation.mutateAsync({
        targetCollectionId: options.sourceCollectionId,
        itemIds: options.itemIds,
        sourceCollectionId: options.targetCollectionId,
        scopeId: options.scopeId,
      });
      options.onUndone?.();
    },
  };
}

export interface ToggleStarCommandOptions {
  itemId: string;
  itemTitle?: string;
  newStarred: boolean;
  toggleStarMutation: {
    mutateAsync: (args: { id: string; isStarred: boolean }) => Promise<unknown>;
  };
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createToggleStarCommand(options: ToggleStarCommandOptions): LibraryCommand {
  const actionText = options.newStarred ? 'Starred' : 'Unstarred';
  const description = options.itemTitle ? `${actionText} "${options.itemTitle}"` : actionText;

  return {
    id: `star-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: async () => {
      await options.toggleStarMutation.mutateAsync({
        id: options.itemId,
        isStarred: options.newStarred,
      });
      options.onExecuted?.();
    },
    undo: async () => {
      await options.toggleStarMutation.mutateAsync({
        id: options.itemId,
        isStarred: !options.newStarred,
      });
      options.onUndone?.();
    },
  };
}

// ---------------------------------------------------------------------------
// Reversible Metadata Patch Command & Snapshot Builder (Pattern FE-P1)
// ---------------------------------------------------------------------------

import {
  buildInverseMetadataPatch,
  PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS,
  buildPreConversionSnapshot as buildRawPreConversionSnapshot,
} from './library-command-snapshots.helpers';

export function buildPreConversionSnapshot(sourceItem: Partial<Item>): Partial<Item> {
  const raw = buildRawPreConversionSnapshot(sourceItem) as Record<string, unknown>;
  const srcRecord = sourceItem as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (key === 'extraFields' || key === 'creators' || key === 'contributors' || key === 'authors') {
      continue;
    }
    const orig = srcRecord[key];
    if (typeof orig === 'string' || typeof orig === 'number' || typeof orig === 'boolean') {
      raw[key] = orig;
    }
  }
  return raw as Partial<Item>;
}

export {
  buildInverseMetadataPatch,
  PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS,
};

export interface UpdateItemMetadataCommandParams {
  itemId: string;
  description?: string;
  forwardPatch: Partial<Item>;
  inversePatch: Partial<Item>;
  applyPatch: (itemId: string, patch: Partial<Item>) => Promise<unknown>;
}

export function createUpdateItemMetadataCommand(
  params: UpdateItemMetadataCommandParams,
): LibraryCommand {
  const description = params.description || 'Updated item metadata';
  return {
    id: `meta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: async () => {
      await params.applyPatch(params.itemId, params.forwardPatch);
    },
    undo: async () => {
      await params.applyPatch(params.itemId, params.inversePatch);
    },
    redo: async () => {
      await params.applyPatch(params.itemId, params.forwardPatch);
    },
  };
}

function extractResultItem(res: unknown): Item | undefined {
  if (!res || typeof res !== 'object') return undefined;
  if ('item' in res && res.item && typeof res.item === 'object') return res.item as Item;
  if ('id' in res && typeof (res as { id?: unknown }).id === 'string') return res as Item;
  return undefined;
}

export interface ConvertItemTypeCommandParams {
  itemId: string;
  itemTitle?: string;
  sourceItem: Partial<Item>;
  targetType: string;
  targetTypeLabel?: string;
  retainUnmappedInExtra?: boolean;
  convertType: (args: {
    itemId: string;
    targetType: string;
    retainUnmappedInExtra?: boolean;
    silent?: boolean;
  }) => Promise<{ item?: Item } | unknown>;
  applyMetadataPatch?: (itemId: string, patch: Partial<Item>) => Promise<unknown>;
  onStateSynced?: (updatedItem?: Item) => void;
}

export function createConvertItemTypeCommand(params: ConvertItemTypeCommandParams): LibraryCommand {
  const snapshot = buildPreConversionSnapshot(params.sourceItem);
  const previousItemType = snapshot.itemType || 'journalArticle';
  const targetLabel = params.targetTypeLabel || params.targetType;
  const description = params.itemTitle
    ? `Converted "${params.itemTitle}" to ${targetLabel}`
    : `Converted item type to ${targetLabel}`;
  const conversionAddedExtraKeys = new Set<string>();

  const trackConvertedExtraKeys = (convertedItem?: Item) => {
    if (!convertedItem) return;
    const preEf =
      snapshot.extraFields && typeof snapshot.extraFields === 'object'
        ? (snapshot.extraFields as Record<string, unknown>)
        : {};
    const postEf =
      convertedItem.extraFields && typeof convertedItem.extraFields === 'object'
        ? (convertedItem.extraFields as Record<string, unknown>)
        : {};
    const postMeta =
      convertedItem.metadata && typeof convertedItem.metadata === 'object'
        ? (convertedItem.metadata as Record<string, unknown>)
        : {};
    for (const k of [...Object.keys(postEf), ...Object.keys(postMeta)]) {
      if (k.startsWith('__unmapped_') || !(k in preEf)) {
        conversionAddedExtraKeys.add(k);
      }
    }
  };

  const runForward = async () => {
    const res = await params.convertType({
      itemId: params.itemId,
      targetType: params.targetType,
      retainUnmappedInExtra: params.retainUnmappedInExtra ?? true,
      silent: true,
    });
    const convertedItem = extractResultItem(res);
    trackConvertedExtraKeys(convertedItem);
    params.onStateSynced?.(convertedItem);
  };

  return {
    id: `convert-type-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: runForward,
    redo: runForward,
    undo: async () => {
      const res = await params.convertType({
        itemId: params.itemId,
        targetType: previousItemType,
        retainUnmappedInExtra: true,
        silent: true,
      });
      let restoredItem = extractResultItem(res);
      trackConvertedExtraKeys(restoredItem);
      if (params.applyMetadataPatch) {
        const { id: _id, ...restoreFields } = snapshot as Record<string, unknown>;
        const preEf =
          snapshot.extraFields && typeof snapshot.extraFields === 'object'
            ? { ...(snapshot.extraFields as Record<string, unknown>) }
            : {};
        for (const k of conversionAddedExtraKeys) {
          if (!(k in preEf)) {
            preEf[k] = null;
          }
        }
        const restorePatch: Partial<Item> = {
          ...(restoreFields as Partial<Item>),
          extra: typeof snapshot.extra === 'string' ? snapshot.extra : '',
          extraFields: preEf,
          itemType: previousItemType as Item['itemType'],
        };
        const patched = await params.applyMetadataPatch(params.itemId, restorePatch);
        restoredItem = extractResultItem(patched) ?? restoredItem;
      }
      params.onStateSynced?.(restoredItem);
    },
  };
}

export interface MergeDuplicatesCommandParams {
  primaryItem: Item;
  duplicateIdsToDelete: string[];
  mergedFields?: Record<string, unknown>;
  items?: readonly Item[];
  fieldOverrides?: Record<string, unknown>;
  mergeMutation: {
    mutateAsync: (args: {
      primaryItemId: string;
      duplicateItemIds: string[];
      overrides?: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  undoMergeMutation?: {
    mutateAsync: (primaryItemId: string) => Promise<unknown>;
  };
  restoreMutation?: { mutateAsync: (itemIds: string[]) => Promise<unknown> };
  updateItemMutation?: {
    mutateAsync: (args: { itemId: string; data: Partial<Item>; silent?: boolean }) => Promise<unknown>;
  };
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createMergeDuplicatesCommand(params: MergeDuplicatesCommandParams): LibraryCommand {
  const { primaryItem: p } = params;
  const preMergeSnapshot: Partial<Item> = {
    ...buildPreConversionSnapshot(p),
    ...(p.venue !== undefined ? { venue: p.venue } : {}),
    ...(p.openAccessPdfUrl !== undefined ? { openAccessPdfUrl: p.openAccessPdfUrl } : {}),
    ...(Array.isArray(p.collectionIds) ? { collectionIds: [...p.collectionIds] } : {}),
    ...(Array.isArray(p.tags) ? { tags: [...p.tags] } : {}),
  };
  const count = params.duplicateIdsToDelete.length;
  const description =
    count === 1
      ? `Merged 1 duplicate into "${p.title || 'master record'}"`
      : `Merged ${count} duplicates into "${p.title || 'master record'}"`;

  return {
    id: `merge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: async () => {
      const effectiveOverrides =
        params.items && params.items.length > 0
          ? extractExplicitUserMergeOverrides(
              params.items,
              p.id,
              params.fieldOverrides ?? params.mergedFields ?? {},
            )
          : params.mergedFields;
      await params.mergeMutation.mutateAsync({
        primaryItemId: p.id,
        duplicateItemIds: params.duplicateIdsToDelete,
        overrides:
          effectiveOverrides && Object.keys(effectiveOverrides).length > 0
            ? effectiveOverrides
            : undefined,
      });
      params.onExecuted?.();
    },
    undo: async () => {
      if (params.undoMergeMutation) {
        await params.undoMergeMutation.mutateAsync(p.id);
        params.onUndone?.();
        return;
      }
      if (params.duplicateIdsToDelete.length > 0 && params.restoreMutation) {
        await params.restoreMutation.mutateAsync(params.duplicateIdsToDelete);
      }
      if (params.updateItemMutation) {
        await params.updateItemMutation.mutateAsync({
          itemId: p.id,
          data: preMergeSnapshot,
          silent: true,
        });
      }
      params.onUndone?.();
    },
  };
}

export interface BatchDetachCommandOptions {
  collectionId: string;
  collectionName?: string;
  itemIds: string[];
  detachMutation: {
    mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown>;
  };
  assignMutation: {
    mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown>;
  };
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createBatchDetachCommand(options: BatchDetachCommandOptions): LibraryCommand {
  const count = options.itemIds.length;
  const colLabel = options.collectionName ? `"${options.collectionName}"` : 'collection';
  const description =
    count === 1
      ? `Removed 1 item from ${colLabel}`
      : `Removed ${count} items from ${colLabel}`;

  return {
    id: `detach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: async () => {
      await options.detachMutation.mutateAsync({
        collectionId: options.collectionId,
        itemIds: options.itemIds,
      });
      options.onExecuted?.();
    },
    undo: async () => {
      await options.assignMutation.mutateAsync({
        collectionId: options.collectionId,
        itemIds: options.itemIds,
      });
      options.onUndone?.();
    },
  };
}

export interface BatchTagToggleItemSnapshot {
  itemId: string;
  previousTags: string[];
  nextTags: string[];
}

export interface BatchTagToggleCommandOptions {
  tagName: string;
  action: 'add' | 'remove';
  snapshots: BatchTagToggleItemSnapshot[];
  updateItemMutation: {
    mutateAsync: (args: {
      itemId: string;
      data: { tags: string[] };
      silent?: boolean;
    }) => Promise<unknown>;
  };
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createBatchTagToggleCommand(
  options: BatchTagToggleCommandOptions,
): LibraryCommand {
  const description =
    options.action === 'remove'
      ? `Removed tag "${options.tagName}"`
      : `Applied tag "${options.tagName}"`;

  return {
    id: `tag-toggle-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: async () => {
      await Promise.all(
        options.snapshots.map((snap) =>
          options.updateItemMutation.mutateAsync({
            itemId: snap.itemId,
            data: { tags: snap.nextTags },
            silent: true,
          }),
        ),
      );
      options.onExecuted?.();
    },
    undo: async () => {
      await Promise.all(
        options.snapshots.map((snap) =>
          options.updateItemMutation.mutateAsync({
            itemId: snap.itemId,
            data: { tags: snap.previousTags },
            silent: true,
          }),
        ),
      );
      options.onUndone?.();
    },
  };
}

export interface AddNoteCommandOptions {
  itemId?: string | null;
  contentMd: string;
  title?: string;
  createNote: (dto: { itemId?: string | null; contentMd: string; title?: string }) => Promise<{ id?: string; version?: number } | null | undefined>;
  deleteNote: (id: string, version?: number) => Promise<unknown>;
  onExecuted?: (createdNoteId?: string) => void;
  onUndone?: () => void;
}

export function createAddNoteCommand(options: AddNoteCommandOptions): LibraryCommand {
  let activeNoteId: string | undefined;
  let activeNoteVersion: number | undefined;

  return {
    id: `note-add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: 'Added note',
    timestamp: Date.now(),
    execute: async () => {
      const created = await options.createNote({
        itemId: options.itemId,
        contentMd: options.contentMd,
        title: options.title,
      });
      activeNoteId = created?.id;
      activeNoteVersion = created?.version;
      options.onExecuted?.(activeNoteId);
    },
    undo: async () => {
      if (activeNoteId) {
        await options.deleteNote(activeNoteId, activeNoteVersion);
        options.onUndone?.();
      }
    },
  };
}

export interface UpdateNoteCommandOptions {
  noteId: string;
  initialVersion?: number;
  previousContentMd: string;
  nextContentMd: string;
  updateNote: (
    id: string,
    version: number,
    dto: { contentMd: string },
  ) => Promise<{ version?: number } | null | undefined>;
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createUpdateNoteCommand(options: UpdateNoteCommandOptions): LibraryCommand {
  let currentVersion = options.initialVersion || 1;

  return {
    id: `note-update-${options.noteId}-${Date.now()}`,
    description: 'Updated note',
    timestamp: Date.now(),
    execute: async () => {
      const updated = await options.updateNote(options.noteId, currentVersion, {
        contentMd: options.nextContentMd,
      });
      if (typeof updated?.version === 'number') {
        currentVersion = updated.version;
      } else {
        currentVersion += 1;
      }
      options.onExecuted?.();
    },
    undo: async () => {
      const reverted = await options.updateNote(options.noteId, currentVersion, {
        contentMd: options.previousContentMd,
      });
      if (typeof reverted?.version === 'number') {
        currentVersion = reverted.version;
      } else {
        currentVersion += 1;
      }
      options.onUndone?.();
    },
  };
}

export interface DeleteNoteCommandOptions {
  noteId: string;
  version?: number;
  itemId?: string | null;
  contentMd: string;
  title?: string;
  deleteNote: (id: string, version?: number) => Promise<unknown>;
  createNote: (dto: { itemId?: string | null; contentMd: string; title?: string }) => Promise<{ id?: string; version?: number } | null | undefined>;
  onExecuted?: () => void;
  onUndone?: (recreatedNoteId?: string) => void;
}

export function createDeleteNoteCommand(options: DeleteNoteCommandOptions): LibraryCommand {
  let currentNoteId = options.noteId;
  let currentVersion = options.version;

  return {
    id: `note-delete-${options.noteId}-${Date.now()}`,
    description: 'Deleted note',
    timestamp: Date.now(),
    execute: async () => {
      await options.deleteNote(currentNoteId, currentVersion);
      options.onExecuted?.();
    },
    undo: async () => {
      const recreated = await options.createNote({
        itemId: options.itemId,
        contentMd: options.contentMd,
        title: options.title,
      });
      if (recreated?.id) {
        currentNoteId = recreated.id;
        currentVersion = recreated.version;
      }
      options.onUndone?.(recreated?.id);
    },
  };
}

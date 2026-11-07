'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import type { Item } from '@/features/library/types/core.types';
import { extractExplicitUserMergeOverrides } from '@/features/library/domain/diff.domain';
import { notifyDraftCacheCleared } from '@/features/library/sdk/query-keys';
import { registerLibraryScopeChangeListener } from '@/features/library/core/store/library-ui.store';
import {
  cloneSnapshotValue,
  buildInverseMetadataPatch,
  PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS,
  buildPreConversionSnapshot,
} from '../../domain/item-field-schema.domain';

export { cloneSnapshotValue, buildInverseMetadataPatch, PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS, buildPreConversionSnapshot };

interface LibraryCommand<TResult = unknown> {
  readonly id: string;
  readonly description: string;
  readonly timestamp: number;
  execute(): Promise<TResult>;
  undo(): Promise<void>;
  redo?(): Promise<TResult>;
}

export type CommandEntry<TResult = unknown> = LibraryCommand<TResult>;

function defineLibraryCommand<TResult = void>(
  prefix: string,
  description: string,
  execute: () => Promise<TResult>,
  undo: () => Promise<void>,
  redo?: () => Promise<TResult>,
): LibraryCommand<TResult> {
  return {
    id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute,
    undo,
    ...(redo ? { redo } : {}),
  };
}

interface TrashCommandOptions {
  itemIds: string[]; itemTitle?: string;
  deleteMutation: { mutateAsync: (ids: string[]) => Promise<unknown> };
  restoreMutation: { mutateAsync: (ids: string[]) => Promise<unknown> };
  onExecuted?: () => void; onUndone?: () => void;
}

export function createTrashCommand(options: TrashCommandOptions): LibraryCommand {
  const count = options.itemIds.length;
  return defineLibraryCommand(
    'trash',
    count === 1 ? 'Item moved to trash' : `Moved ${count} items to trash`,
    async () => { await options.deleteMutation.mutateAsync(options.itemIds); options.onExecuted?.(); },
    async () => { await options.restoreMutation.mutateAsync(options.itemIds); options.onUndone?.(); },
  );
}

interface RestoreCommandOptions {
  itemIds: string[]; itemTitle?: string;
  restoreMutation: { mutateAsync: (ids: string[]) => Promise<unknown> };
  deleteMutation: { mutateAsync: (ids: string[]) => Promise<unknown> };
  onExecuted?: () => void; onUndone?: () => void;
}

export function createRestoreCommand(options: RestoreCommandOptions): LibraryCommand {
  const count = options.itemIds.length;
  const description = count === 1 && options.itemTitle ? `Restored "${options.itemTitle}"` : count === 1 ? 'Restored 1 item' : `Restored ${count} items`;
  return defineLibraryCommand(
    'restore',
    description,
    async () => { await options.restoreMutation.mutateAsync(options.itemIds); options.onExecuted?.(); },
    async () => { await options.deleteMutation.mutateAsync(options.itemIds); options.onUndone?.(); },
  );
}

interface MoveItemsCommandOptions {
  itemIds: string[]; sourceCollectionId: string | null; targetCollectionId: string | null;
  targetCollectionName?: string; previousCollectionsByItem?: Map<string, string[]>;
  onUndoMove?: () => Promise<void>;
  detachMutation?: { mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown> };
  assignMutation?: { mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown> };
  moveMutation: { mutateAsync: (args: { targetCollectionId: string | null; itemIds: string[]; sourceCollectionId?: string | null; scopeId?: string }) => Promise<unknown> };
  scopeId?: string; onExecuted?: () => void; onUndone?: () => void;
}

export function createMoveItemsCommand(options: MoveItemsCommandOptions): LibraryCommand {
  const count = options.itemIds.length;
  const destName = options.targetCollectionName || 'collection';
  return defineLibraryCommand(
    'move',
    `Moved ${count} ${count === 1 ? 'item' : 'items'} to ${destName}`,
    async () => {
      await options.moveMutation.mutateAsync({
        targetCollectionId: options.targetCollectionId,
        itemIds: options.itemIds,
        sourceCollectionId: options.sourceCollectionId,
        scopeId: options.scopeId,
      });
      options.onExecuted?.();
    },
    async () => {
      if (options.onUndoMove) { await options.onUndoMove(); options.onUndone?.(); return; }
      if (options.sourceCollectionId && options.sourceCollectionId !== 'unfiled') {
        await options.moveMutation.mutateAsync({
          targetCollectionId: options.sourceCollectionId, itemIds: options.itemIds, sourceCollectionId: options.targetCollectionId, scopeId: options.scopeId,
        });
        options.onUndone?.();
        return;
      }
      if (options.previousCollectionsByItem && options.previousCollectionsByItem.size > 0) {
        if (options.targetCollectionId && options.detachMutation) {
          const itemsNotPreviouslyInTarget = options.itemIds.filter(
            (id) => !(options.previousCollectionsByItem?.get(id) || []).includes(options.targetCollectionId!),
          );
          if (itemsNotPreviouslyInTarget.length > 0) {
            await options.detachMutation.mutateAsync({ collectionId: options.targetCollectionId, itemIds: itemsNotPreviouslyInTarget });
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
            Array.from(collectionToItems.entries(), ([colId, ids]) => options.assignMutation!.mutateAsync({ collectionId: colId, itemIds: ids })),
          );
        }
        options.onUndone?.();
        return;
      }
      if (options.targetCollectionId && options.detachMutation) {
        await options.detachMutation.mutateAsync({ collectionId: options.targetCollectionId, itemIds: options.itemIds });
        options.onUndone?.();
        return;
      }
      await options.moveMutation.mutateAsync({
        targetCollectionId: options.sourceCollectionId, itemIds: options.itemIds, sourceCollectionId: options.targetCollectionId, scopeId: options.scopeId,
      });
      options.onUndone?.();
    },
  );
}

interface ToggleStarCommandOptions {
  itemId: string; itemTitle?: string; newStarred: boolean;
  toggleStarMutation: { mutateAsync: (args: { id: string; isStarred: boolean }) => Promise<unknown> };
  onExecuted?: () => void; onUndone?: () => void;
}

export function createToggleStarCommand(options: ToggleStarCommandOptions): LibraryCommand {
  const actionText = options.newStarred ? 'Starred' : 'Unstarred';
  return defineLibraryCommand(
    'star',
    options.itemTitle ? `${actionText} "${options.itemTitle}"` : actionText,
    async () => { await options.toggleStarMutation.mutateAsync({ id: options.itemId, isStarred: options.newStarred }); options.onExecuted?.(); },
    async () => { await options.toggleStarMutation.mutateAsync({ id: options.itemId, isStarred: !options.newStarred }); options.onUndone?.(); },
  );
}

interface UpdateItemMetadataCommandParams {
  itemId: string; description?: string; forwardPatch: Partial<Item>; inversePatch: Partial<Item>;
  applyPatch: (itemId: string, patch: Partial<Item>) => Promise<unknown>;
}

export function createUpdateItemMetadataCommand(params: UpdateItemMetadataCommandParams): LibraryCommand {
  const runForward = async () => { await params.applyPatch(params.itemId, params.forwardPatch); };
  return defineLibraryCommand(
    'meta',
    params.description || 'Updated item metadata',
    runForward,
    async () => { await params.applyPatch(params.itemId, params.inversePatch); },
    runForward,
  );
}

function extractResultItem(res: unknown): Item | undefined {
  if (!res || typeof res !== 'object') return undefined;
  if ('item' in res && res.item && typeof res.item === 'object') return res.item as Item;
  if ('id' in res && typeof (res as { id?: unknown }).id === 'string') return res as Item;
  return undefined;
}

interface ConvertItemTypeCommandParams {
  itemId: string; itemTitle?: string; sourceItem: Partial<Item>; targetType: string; targetTypeLabel?: string; retainUnmappedInExtra?: boolean;
  convertType: (args: { itemId: string; targetType: string; retainUnmappedInExtra?: boolean; silent?: boolean }) => Promise<{ item?: Item } | unknown>;
  applyMetadataPatch?: (itemId: string, patch: Partial<Item>, expectedVersion?: number) => Promise<unknown>;
  onStateSynced?: (updatedItem?: Item) => void;
}

export function createConvertItemTypeCommand(params: ConvertItemTypeCommandParams): LibraryCommand {
  const snapshot = buildPreConversionSnapshot(params.sourceItem);
  const previousItemType = snapshot.itemType || 'journalArticle';
  const targetLabel = params.targetTypeLabel || params.targetType;
  const description = params.itemTitle ? `Converted "${params.itemTitle}" to ${targetLabel}` : `Converted item type to ${targetLabel}`;
  const conversionAddedExtraKeys = new Set<string>();

  const trackConvertedExtraKeys = (convertedItem?: Item) => {
    if (!convertedItem) return;
    const preEf = snapshot.extraFields && typeof snapshot.extraFields === 'object' ? (snapshot.extraFields as Record<string, unknown>) : {};
    const postEf = convertedItem.extraFields && typeof convertedItem.extraFields === 'object' ? (convertedItem.extraFields as Record<string, unknown>) : {};
    const postMeta = convertedItem.metadata && typeof convertedItem.metadata === 'object' ? (convertedItem.metadata as Record<string, unknown>) : {};
    for (const k of [...Object.keys(postEf), ...Object.keys(postMeta)]) {
      if (k.startsWith('__unmapped_') || !(k in preEf)) conversionAddedExtraKeys.add(k);
    }
  };

  const runForward = async () => {
    const res = await params.convertType({
      itemId: params.itemId, targetType: params.targetType, retainUnmappedInExtra: params.retainUnmappedInExtra ?? true, silent: true,
    });
    const convertedItem = extractResultItem(res);
    trackConvertedExtraKeys(convertedItem);
    params.onStateSynced?.(convertedItem);
  };

  return defineLibraryCommand(
    'convert-type',
    description,
    runForward,
    async () => {
      const res = await params.convertType({ itemId: params.itemId, targetType: previousItemType, retainUnmappedInExtra: true, silent: true });
      let restoredItem = extractResultItem(res);
      trackConvertedExtraKeys(restoredItem);
      if (params.applyMetadataPatch) {
        const { id: _id, ...restoreFields } = snapshot as Record<string, unknown>;
        const preEf = snapshot.extraFields && typeof snapshot.extraFields === 'object' ? { ...(snapshot.extraFields as Record<string, unknown>) } : {};
        for (const k of conversionAddedExtraKeys) if (!(k in preEf)) preEf[k] = null;
        const restorePatch: Partial<Item> = {
          ...(restoreFields as Partial<Item>),
          extra: typeof snapshot.extra === 'string' ? snapshot.extra : '',
          extraFields: preEf,
          itemType: previousItemType as Item['itemType'],
        };
        const currentVersion = typeof restoredItem?.version === 'number' ? restoredItem.version : undefined;
        const patched = await params.applyMetadataPatch(params.itemId, restorePatch, currentVersion);
        restoredItem = extractResultItem(patched) ?? restoredItem;
      }
      params.onStateSynced?.(restoredItem);
    },
    runForward,
  );
}

interface MergeDuplicatesCommandParams {
  primaryItem: Item; duplicateIdsToDelete: string[]; groupKey?: string;
  mergedFields?: Record<string, unknown>; items?: readonly Item[]; fieldOverrides?: Record<string, unknown>;
  mergeMutation: { mutateAsync: (args: { primaryItemId: string; duplicateItemIds: string[]; overrides?: Record<string, unknown> }) => Promise<unknown> };
  restoreMutation?: { mutateAsync: (itemIds: string[]) => Promise<unknown> };
  updateItemMutation?: { mutateAsync: (args: { itemId: string; data: Partial<Item>; silent?: boolean }) => Promise<unknown> };
  onExecuted?: () => void; onUndone?: () => void;
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
  return defineLibraryCommand(
    'merge',
    count === 1 ? `Merged 1 duplicate into "${p.title || 'master record'}"` : `Merged ${count} duplicates into "${p.title || 'master record'}"`,
    async () => {
      const effectiveOverrides =
        params.items && params.items.length > 0
          ? extractExplicitUserMergeOverrides(params.items, p.id, params.fieldOverrides ?? params.mergedFields ?? {})
          : params.mergedFields;
      await params.mergeMutation.mutateAsync({
        primaryItemId: p.id,
        duplicateItemIds: params.duplicateIdsToDelete,
        overrides: effectiveOverrides && Object.keys(effectiveOverrides).length > 0 ? effectiveOverrides : undefined,
      });
      if (params.groupKey) notifyDraftCacheCleared(params.groupKey);
      params.onExecuted?.();
    },
    async () => {
      await Promise.all([
        params.duplicateIdsToDelete.length > 0 && params.restoreMutation
          ? params.restoreMutation.mutateAsync(params.duplicateIdsToDelete)
          : Promise.resolve(),
        params.updateItemMutation
          ? params.updateItemMutation.mutateAsync({ itemId: p.id, data: preMergeSnapshot, silent: true })
          : Promise.resolve(),
      ]);
      params.onUndone?.();
    },
  );
}

interface BatchDetachCommandOptions {
  collectionId: string; collectionName?: string; itemIds: string[];
  detachMutation: { mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown> };
  assignMutation: { mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown> };
  onExecuted?: () => void; onUndone?: () => void;
}

export function createBatchDetachCommand(options: BatchDetachCommandOptions): LibraryCommand {
  const count = options.itemIds.length;
  const colLabel = options.collectionName ? `"${options.collectionName}"` : 'collection';
  return defineLibraryCommand(
    'detach',
    count === 1 ? `Removed 1 item from ${colLabel}` : `Removed ${count} items from ${colLabel}`,
    async () => {
      await options.detachMutation.mutateAsync({ collectionId: options.collectionId, itemIds: options.itemIds });
      options.onExecuted?.();
    },
    async () => {
      await options.assignMutation.mutateAsync({ collectionId: options.collectionId, itemIds: options.itemIds });
      options.onUndone?.();
    },
  );
}

interface BatchAssignCommandOptions {
  collectionId: string; collectionName?: string; itemIds: string[]; alreadyAssignedItemIds?: Set<string>;
  assignMutation: { mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown> };
  detachMutation: { mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown> };
  onExecuted?: () => void; onUndone?: () => void;
}

export function createBatchAssignCommand(options: BatchAssignCommandOptions): LibraryCommand {
  const count = options.itemIds.length;
  const colLabel = options.collectionName ? `"${options.collectionName}"` : 'collection';
  const idsToDetachOnUndo = options.alreadyAssignedItemIds
    ? options.itemIds.filter((id) => !options.alreadyAssignedItemIds!.has(id))
    : options.itemIds;
  return defineLibraryCommand(
    'assign',
    count === 1 ? `Added 1 item to ${colLabel}` : `Added ${count} items to ${colLabel}`,
    async () => {
      await options.assignMutation.mutateAsync({ collectionId: options.collectionId, itemIds: options.itemIds });
      options.onExecuted?.();
    },
    async () => {
      if (idsToDetachOnUndo.length > 0) {
        await options.detachMutation.mutateAsync({ collectionId: options.collectionId, itemIds: idsToDetachOnUndo });
      }
      options.onUndone?.();
    },
  );
}

interface BatchTagToggleItemSnapshot { itemId: string; previousTags: string[]; nextTags: string[]; }
interface BatchTagToggleCommandOptions {
  tagName: string; action: 'add' | 'remove'; snapshots: BatchTagToggleItemSnapshot[];
  updateItemMutation: { mutateAsync: (args: { itemId: string; data: { tags: string[] }; silent?: boolean }) => Promise<unknown> };
  onExecuted?: () => void; onUndone?: () => void;
}

export function createBatchTagToggleCommand(options: BatchTagToggleCommandOptions): LibraryCommand {
  return defineLibraryCommand(
    'tag-toggle',
    options.action === 'remove' ? `Removed tag "${options.tagName}"` : `Applied tag "${options.tagName}"`,
    async () => {
      for (let i = 0; i < options.snapshots.length; i += 6) {
        const batch = options.snapshots.slice(i, i + 6);
        await Promise.all(
          batch.map((snap) => options.updateItemMutation.mutateAsync({ itemId: snap.itemId, data: { tags: snap.nextTags }, silent: true })),
        );
      }
      options.onExecuted?.();
    },
    async () => {
      for (let i = 0; i < options.snapshots.length; i += 6) {
        const batch = options.snapshots.slice(i, i + 6);
        await Promise.all(
          batch.map((snap) => options.updateItemMutation.mutateAsync({ itemId: snap.itemId, data: { tags: snap.previousTags }, silent: true })),
        );
      }
      options.onUndone?.();
    },
  );
}

interface AddNoteCommandOptions {
  itemId?: string | null; contentMd: string; title?: string;
  createNote: (dto: { itemId?: string | null; contentMd: string; title?: string }) => Promise<{ id?: string; version?: number } | null | undefined>;
  deleteNote: (id: string, version?: number) => Promise<unknown>;
  onExecuted?: (createdNoteId?: string) => void; onUndone?: () => void;
}

export function createAddNoteCommand(options: AddNoteCommandOptions): LibraryCommand {
  let activeNoteId: string | undefined;
  let activeNoteVersion: number | undefined;
  return defineLibraryCommand(
    'note-add',
    'Added note',
    async () => {
      const created = await options.createNote({ itemId: options.itemId, contentMd: options.contentMd, title: options.title });
      activeNoteId = created?.id;
      activeNoteVersion = created?.version;
      options.onExecuted?.(activeNoteId);
    },
    async () => {
      if (activeNoteId) {
        await options.deleteNote(activeNoteId, activeNoteVersion);
        options.onUndone?.();
      }
    },
  );
}

const noteIdRemapRegistry = new Map<string, string>();
const noteVersionRemapRegistry = new Map<string, number>();

function resolveRemappedNoteId(noteId: string): string {
  let current = noteId;
  const visited = new Set<string>();
  while (noteIdRemapRegistry.has(current) && !visited.has(current)) {
    visited.add(current);
    current = noteIdRemapRegistry.get(current)!;
  }
  return current;
}

function registerRecreatedNoteIdRemap(oldNoteId: string, newNoteId: string, newVersion?: number): void {
  if (!oldNoteId || !newNoteId || oldNoteId === newNoteId) return;
  noteIdRemapRegistry.set(oldNoteId, newNoteId);
  if (typeof newVersion === 'number') noteVersionRemapRegistry.set(newNoteId, newVersion);
}

interface UpdateNoteCommandOptions {
  noteId: string; initialVersion?: number; previousContentMd: string; nextContentMd: string;
  updateNote: (id: string, version: number, dto: { contentMd: string }) => Promise<{ version?: number } | null | undefined>;
  onExecuted?: () => void; onUndone?: () => void;
}

export function createUpdateNoteCommand(options: UpdateNoteCommandOptions): LibraryCommand {
  let currentVersion = options.initialVersion || 1;
  return defineLibraryCommand(
    `note-update-${options.noteId}`,
    'Updated note',
    async () => {
      const targetId = resolveRemappedNoteId(options.noteId);
      const effectiveVersion = noteVersionRemapRegistry.get(targetId) ?? currentVersion;
      const updated = await options.updateNote(targetId, effectiveVersion, { contentMd: options.nextContentMd });
      currentVersion = typeof updated?.version === 'number' ? updated.version : effectiveVersion + 1;
      noteVersionRemapRegistry.set(targetId, currentVersion);
      options.onExecuted?.();
    },
    async () => {
      const targetId = resolveRemappedNoteId(options.noteId);
      const effectiveVersion = noteVersionRemapRegistry.get(targetId) ?? currentVersion;
      const reverted = await options.updateNote(targetId, effectiveVersion, { contentMd: options.previousContentMd });
      currentVersion = typeof reverted?.version === 'number' ? reverted.version : effectiveVersion + 1;
      noteVersionRemapRegistry.set(targetId, currentVersion);
      options.onUndone?.();
    },
  );
}

interface DeleteNoteCommandOptions {
  noteId: string; version?: number; itemId?: string | null; contentMd: string;
  contentJson?: Record<string, unknown> | null; title?: string; tags?: string[];
  deleteNote: (id: string, version?: number) => Promise<unknown>;
  createNote: (dto: { itemId?: string | null; contentMd: string; contentJson?: Record<string, unknown> | null; title?: string; tags?: string[] }) => Promise<{ id?: string; version?: number } | null | undefined>;
  onExecuted?: () => void; onUndone?: (recreatedNoteId?: string) => void;
}

export function createDeleteNoteCommand(options: DeleteNoteCommandOptions): LibraryCommand {
  let currentNoteId = options.noteId;
  let currentVersion = options.version;
  return defineLibraryCommand(
    `note-delete-${options.noteId}`,
    'Deleted note',
    async () => {
      const targetId = resolveRemappedNoteId(currentNoteId);
      const effectiveVersion = noteVersionRemapRegistry.get(targetId) ?? currentVersion;
      await options.deleteNote(targetId, effectiveVersion);
      options.onExecuted?.();
    },
    async () => {
      const previousNoteId = resolveRemappedNoteId(currentNoteId);
      const recreated = await options.createNote({
        itemId: options.itemId,
        contentMd: options.contentMd,
        ...(options.contentJson !== undefined ? { contentJson: options.contentJson } : {}),
        title: options.title,
        ...(options.tags !== undefined ? { tags: options.tags } : {}),
      });
      if (recreated?.id) {
        registerRecreatedNoteIdRemap(previousNoteId, recreated.id, recreated.version);
        registerRecreatedNoteIdRemap(options.noteId, recreated.id, recreated.version);
        currentNoteId = recreated.id;
        currentVersion = recreated.version;
      }
      options.onUndone?.(recreated?.id);
    },
  );
}

interface LibraryCommandState {
  undoStack: LibraryCommand[];
  redoStack: LibraryCommand[];
  isExecuting: boolean;
  isUndoing: boolean;
  lastCommand: LibraryCommand | null;
  epoch: number;
  currentScopeId: string | null;
}

interface LibraryCommandActions {
  executeCommand: <T>(command: LibraryCommand<T>, options?: { silentToast?: boolean }) => Promise<T>;
  pushExecutedCommand: <T>(command: LibraryCommand<T>, options?: { silentToast?: boolean }) => void;
  undo: (expectedCommandId?: string) => Promise<boolean>;
  undoById: (commandId: string) => Promise<boolean>;
  redo: (expectedCommandId?: string) => Promise<boolean>;
  clearHistory: () => void;
  clear: () => void;
  setScope: (scopeId?: string | null) => void;
}

const MAX_HISTORY_LENGTH = 30;
let activeExecutionsCount = 0;

function resolveCommandToastId(id: string): string {
  if (id.startsWith('trash-')) return 'item-delete';
  if (id.startsWith('restore-')) return 'item-restore';
  if (id.startsWith('star-')) return 'item-star-toggle';
  if (id.startsWith('detach-')) return 'batch-detach-items';
  if (id.startsWith('merge-')) return 'library-merge';
  if (id.startsWith('note-')) return 'note-mutation-toast';
  if (id.startsWith('convert-type-')) return 'type-conversion';
  if (id.startsWith('meta-')) return 'item-update';
  return `cmd-${id}`;
}

export const useLibraryCommandStore = create<LibraryCommandState & LibraryCommandActions>((set, get) => ({
  undoStack: [], redoStack: [], isExecuting: false, isUndoing: false, lastCommand: null, epoch: 0, currentScopeId: null,

  executeCommand: async <T>(command: LibraryCommand<T>, options: { silentToast?: boolean } = {}): Promise<T> => {
    const ensuredCommand: LibraryCommand<T> = {
      ...command,
      id: command.id || `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: command.timestamp || Date.now(),
    };
    activeExecutionsCount += 1;
    set({ isExecuting: true });
    const startEpoch = get().epoch;
    try {
      const result = await ensuredCommand.execute();
      activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
      const stillExecuting = activeExecutionsCount > 0;
      if (get().epoch !== startEpoch) {
        set({ isExecuting: stillExecuting });
        return result;
      }
      const executedWithNow: LibraryCommand<T> = { ...ensuredCommand, timestamp: Date.now() };
      set((s) => ({
        undoStack: [executedWithNow, ...s.undoStack.filter((c) => c.id !== executedWithNow.id).slice(0, MAX_HISTORY_LENGTH - 1)],
        redoStack: [], lastCommand: executedWithNow, isExecuting: stillExecuting,
      }));
      if (!options.silentToast) {
        toast.success(executedWithNow.description, {
          id: resolveCommandToastId(executedWithNow.id),
          action: { label: 'Undo', onClick: () => { void get().undo(executedWithNow.id); } },
        });
      }
      return result;
    } catch (err: unknown) {
      activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
      set({ isExecuting: activeExecutionsCount > 0 });
      toast.error(`Operation failed: ${err instanceof Error ? err.message : 'Operation failed'}`, { id: `cmd-err-${ensuredCommand.id}` });
      throw err;
    }
  },

  pushExecutedCommand: <T>(command: LibraryCommand<T>, options: { silentToast?: boolean } = {}): void => {
    const ensuredCommand: LibraryCommand<T> = {
      ...command,
      id: command.id || `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: command.timestamp || Date.now(),
    };
    const startEpoch = get().epoch;
    if (get().epoch !== startEpoch) return;
    set((s) => ({
      undoStack: [ensuredCommand, ...s.undoStack.filter((c) => c.id !== ensuredCommand.id).slice(0, MAX_HISTORY_LENGTH - 1)],
      redoStack: [], lastCommand: ensuredCommand,
    }));
    if (!options.silentToast) {
      toast.success(ensuredCommand.description, {
        id: resolveCommandToastId(ensuredCommand.id),
        action: { label: 'Undo', onClick: () => { void get().undo(ensuredCommand.id); } },
      });
    }
  },

  undo: async (expectedCommandId?: string): Promise<boolean> => {
    const { undoStack, isUndoing, isExecuting } = get();
    if (undoStack.length === 0 || isUndoing || isExecuting) return false;
    const commandToUndo = undoStack[0];
    if (!commandToUndo || (expectedCommandId && commandToUndo.id !== expectedCommandId)) return false;
    const startEpoch = get().epoch;
    set({ isUndoing: true });
    try {
      await commandToUndo.undo();
      if (get().epoch !== startEpoch) { set({ isUndoing: false }); return false; }
      const undoneEntry: LibraryCommand = { ...commandToUndo, timestamp: Date.now() };
      set((s) => ({
        undoStack: s.undoStack.filter((c) => c.id !== commandToUndo.id),
        redoStack: [undoneEntry, ...s.redoStack.slice(0, MAX_HISTORY_LENGTH - 1)],
        lastCommand: undoneEntry, isUndoing: false,
      }));
      toast.info(`Undone: ${commandToUndo.description}`, { id: resolveCommandToastId(commandToUndo.id) });
      return true;
    } catch (err: unknown) {
      set({ isUndoing: false });
      toast.error(`Undo failed: ${err instanceof Error ? err.message : 'Undo failed'}`);
      return false;
    }
  },

  undoById: async (commandId: string): Promise<boolean> => get().undo(commandId),

  redo: async (expectedCommandId?: string): Promise<boolean> => {
    const { redoStack, isExecuting, isUndoing } = get();
    if (redoStack.length === 0 || isExecuting || isUndoing) return false;
    const commandToRedo = redoStack[0];
    if (!commandToRedo || (expectedCommandId && commandToRedo.id !== expectedCommandId)) return false;
    const startEpoch = get().epoch;
    activeExecutionsCount += 1;
    set({ isExecuting: true });
    try {
      if (commandToRedo.redo) await commandToRedo.redo();
      else await commandToRedo.execute();
      if (get().epoch !== startEpoch) {
        activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
        set({ isExecuting: activeExecutionsCount > 0 });
        return false;
      }
      activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
      const redoneEntry: LibraryCommand = { ...commandToRedo, timestamp: Date.now() };
      set((s) => ({
        redoStack: s.redoStack.filter((c) => c.id !== commandToRedo.id),
        undoStack: [redoneEntry, ...s.undoStack.slice(0, MAX_HISTORY_LENGTH - 1)],
        lastCommand: redoneEntry,
        isExecuting: activeExecutionsCount > 0,
      }));
      toast.success(`Redone: ${commandToRedo.description}`, { id: resolveCommandToastId(commandToRedo.id) });
      return true;
    } catch (err: unknown) {
      activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
      set({ isExecuting: activeExecutionsCount > 0 });
      toast.error(`Redo failed: ${err instanceof Error ? err.message : 'Redo failed'}`);
      return false;
    }
  },

  clearHistory: () => {
    activeExecutionsCount = 0;
    noteIdRemapRegistry.clear();
    noteVersionRemapRegistry.clear();
    notifyDraftCacheCleared();
    set((s) => ({ undoStack: [], redoStack: [], lastCommand: null, isExecuting: false, isUndoing: false, epoch: s.epoch + 1 }));
  },

  clear: () => { get().clearHistory(); },

  setScope: (scopeId?: string | null) => {
    const normalized = scopeId || 'user';
    if (get().currentScopeId && get().currentScopeId !== normalized) {
      get().clearHistory();
      notifyDraftCacheCleared();
    }
    set({ currentScopeId: normalized });
  },
}));

registerLibraryScopeChangeListener(() => {
  useLibraryCommandStore.getState().clearHistory();
});

export interface ContextualUndoRedoSource {
  readonly latestUndoTimestamp: number;
  readonly latestRedoTimestamp: number;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
}

export function dispatchContextualOrCommandUndo(
  contextualSource?: ContextualUndoRedoSource | null,
): boolean {
  const cmdState = useLibraryCommandStore.getState();
  const topCmdUndo = cmdState.undoStack[0];
  const ctxTs = contextualSource?.latestUndoTimestamp ?? 0;
  const cmdTs = topCmdUndo?.timestamp ?? 0;
  if (ctxTs <= 0 && !topCmdUndo) return false;
  if (ctxTs > 0 && (!topCmdUndo || ctxTs >= cmdTs)) {
    void contextualSource!.undo();
    return true;
  }
  if (topCmdUndo) {
    void cmdState.undo();
    return true;
  }
  return false;
}

export function dispatchContextualOrCommandRedo(
  contextualSource?: ContextualUndoRedoSource | null,
): boolean {
  const cmdState = useLibraryCommandStore.getState();
  const topCmdRedo = cmdState.redoStack[0];
  const ctxTs = contextualSource?.latestRedoTimestamp ?? 0;
  const cmdTs = topCmdRedo?.timestamp ?? 0;
  if (ctxTs <= 0 && !topCmdRedo) return false;
  if (ctxTs > 0 && (!topCmdRedo || ctxTs >= cmdTs)) {
    void contextualSource!.redo();
    return true;
  }
  if (topCmdRedo) {
    void cmdState.redo();
    return true;
  }
  return false;
}

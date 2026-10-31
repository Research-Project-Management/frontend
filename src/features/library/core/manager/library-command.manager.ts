'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import type { Item } from '@/features/library/domain/types/core.types';
import { ALL_SCHEMA_PROMOTE_KEYS } from '@/features/library/domain/metadata-mapper';
import { CANONICAL_FIELD_ALIASES } from '@/features/library/domain/item-field-schema';
import { extractExplicitUserMergeOverrides } from '@/features/library/domain/diff';
import { clearGroupMergeDraft } from '@/features/library/core/coordinator/curation.coordinator';

export {
  type BatchTask, type BatchFlowOptions, type BatchFlowProgress, type BatchFlowEventListener, BatchFlowManager,
} from '@/features/library/core/coordinator/file-ingestion.strategies';

// ── Snapshot & Inverse Patch Helpers ─────────────────────────────────────────

export function cloneSnapshotValue<T>(val: T): T {
  if (Array.isArray(val)) {
    return val.map((item) => (item && typeof item === 'object' ? { ...(item as Record<string, unknown>) } : item)) as unknown as T;
  }
  if (Boolean(val) && typeof val === 'object') return { ...(val as Record<string, unknown>) } as unknown as T;
  return val;
}

const TRANSIENT_PATCH_KEYS = new Set<string>(['version', 'silent', 'expectedVersion']);

const MULTI_KEY_SIBLING_FALLBACKS: Record<string, readonly string[]> = {
  abstract: ['abstractNote', 'abstract'], abstractNote: ['abstractNote', 'abstract'],
  date: ['publicationDate', 'date', 'issueDate', 'dateDecided', 'dateEnacted', 'filingDate'],
  publicationDate: ['publicationDate', 'date', 'issueDate', 'dateDecided', 'dateEnacted', 'filingDate'],
  issueDate: ['issueDate', 'publicationDate', 'date'], dateDecided: ['dateDecided', 'publicationDate', 'date'],
  dateEnacted: ['dateEnacted', 'publicationDate', 'date'], filingDate: ['filingDate', 'date', 'publicationDate'],
  journal: ['publicationTitle', 'journal'], publicationTitle: ['publicationTitle', 'journal'],
  journalAbbr: ['journalAbbreviation', 'journalAbbr'], journalAbbreviation: ['journalAbbreviation', 'journalAbbr'],
  accessedAt: ['accessDate', 'accessedAt'], accessDate: ['accessDate', 'accessedAt'],
  rights: ['license', 'rights'], license: ['license', 'rights'],
  numPages: ['numberOfPages', 'numPages'], numberOfPages: ['numberOfPages', 'numPages'],
  archiveID: ['arxivId', 'archiveID', 'archiveId'], archiveId: ['arxivId', 'archiveID', 'archiveId'], arxivId: ['arxivId', 'archiveID', 'archiveId'],
};

function resolvePreviousScalarValue(itemRecord: Record<string, unknown>, key: string): unknown {
  if (itemRecord[key] !== undefined) return itemRecord[key];
  const currentEf =
    itemRecord.extraFields && typeof itemRecord.extraFields === 'object' && !Array.isArray(itemRecord.extraFields)
      ? (itemRecord.extraFields as Record<string, unknown>)
      : undefined;
  const siblingCandidates = MULTI_KEY_SIBLING_FALLBACKS[key] ?? CANONICAL_FIELD_ALIASES[key];
  if (siblingCandidates) {
    for (const sibling of siblingCandidates) {
      if (itemRecord[sibling] !== undefined) return itemRecord[sibling];
      if (currentEf && currentEf[sibling] !== undefined) return currentEf[sibling];
    }
  }
  return currentEf && currentEf[key] !== undefined ? currentEf[key] : undefined;
}

export function buildInverseMetadataPatch(currentItem: Item, forwardPatch: Partial<Item>): Partial<Item> {
  const itemRecord = currentItem as Record<string, unknown>;
  const patchRecord = forwardPatch as Record<string, unknown>;
  const inverse: Record<string, unknown> = {};

  for (const key of Object.keys(patchRecord)) {
    if (TRANSIENT_PATCH_KEYS.has(key)) continue;
    if (key === 'extraFields' || key === 'metadata') {
      const forwardNested = patchRecord[key];
      if (forwardNested && typeof forwardNested === 'object' && !Array.isArray(forwardNested)) {
        const currentNested =
          itemRecord[key] && typeof itemRecord[key] === 'object' && !Array.isArray(itemRecord[key])
            ? (itemRecord[key] as Record<string, unknown>)
            : {};
        const inverseNested: Record<string, unknown> = { ...currentNested };
        for (const subKey of Object.keys(forwardNested as Record<string, unknown>)) {
          inverseNested[subKey] =
            subKey in currentNested && currentNested[subKey] !== undefined ? cloneSnapshotValue(currentNested[subKey]) : null;
        }
        inverse[key] = inverseNested;
      }
      continue;
    }
    const prevVal = resolvePreviousScalarValue(itemRecord, key);
    inverse[key] = prevVal === undefined ? null : cloneSnapshotValue(prevVal);
  }
  return inverse as Partial<Item>;
}

const BASE_PRE_CONVERSION_SCALAR_KEYS = [
  'title', 'isbn', 'issn', 'doi', 'pmid', 'pmcid', 'arxivId', 'volume', 'issue', 'pages',
  'numberOfPages', 'edition', 'series', 'seriesTitle', 'seriesNumber', 'place', 'abstract',
  'abstractNote', 'url', 'openAccessPdfUrl', 'language', 'rights', 'license', 'archive',
  'archiveLocation', 'callNumber', 'shortTitle', 'year', 'publicationDate', 'date', 'accessDate',
  'journalAbbreviation', 'citationKey', 'itemType', 'extra', 'publicationTitle', 'venue', 'publisher',
] as const;

export const PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS: readonly string[] = Array.from(
  new Set<string>([...BASE_PRE_CONVERSION_SCALAR_KEYS, ...ALL_SCHEMA_PROMOTE_KEYS]),
);

export function buildPreConversionSnapshot(sourceItem: Partial<Item>): Partial<Item> {
  const srcRecord = sourceItem as Record<string, unknown>;
  const snap: Record<string, unknown> = {};
  if (typeof sourceItem.id === 'string' && sourceItem.id) snap.id = sourceItem.id;

  const allKeysToSnapshot = new Set<string>([...PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS, ...ALL_SCHEMA_PROMOTE_KEYS]);
  for (const key of allKeysToSnapshot) {
    if (srcRecord[key] !== undefined) {
      const orig = srcRecord[key];
      snap[key] =
        typeof orig === 'string' || typeof orig === 'number' || typeof orig === 'boolean'
          ? orig
          : cloneSnapshotValue(orig);
    }
  }
  snap.extra = typeof sourceItem.extra === 'string' ? sourceItem.extra : '';
  if (sourceItem.extraFields && typeof sourceItem.extraFields === 'object') {
    snap.extraFields = { ...(sourceItem.extraFields as Record<string, unknown>) };
  }
  if (Array.isArray(sourceItem.creators)) snap.creators = sourceItem.creators.map((c) => ({ ...c }));
  if (Array.isArray(sourceItem.contributors)) snap.contributors = sourceItem.contributors.map((c) => ({ ...c }));
  if (Array.isArray(sourceItem.authors)) snap.authors = [...sourceItem.authors];
  return snap as Partial<Item>;
}

// ── LibraryCommand & Concrete Command Factories ──────────────────────────────

export interface LibraryCommand<TResult = unknown> {
  readonly id: string;
  readonly description: string;
  readonly timestamp: number;
  execute(): Promise<TResult>;
  undo(): Promise<void>;
  redo?(): Promise<TResult>;
}

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
  return defineLibraryCommand(
    'trash',
    count === 1 ? 'Item moved to trash' : `Moved ${count} items to trash`,
    async () => { await options.deleteMutation.mutateAsync(options.itemIds); options.onExecuted?.(); },
    async () => { await options.restoreMutation.mutateAsync(options.itemIds); options.onUndone?.(); },
  );
}

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
  const description = count === 1 && options.itemTitle ? `Restored "${options.itemTitle}"` : count === 1 ? 'Restored 1 item' : `Restored ${count} items`;
  return defineLibraryCommand(
    'restore',
    description,
    async () => { await options.restoreMutation.mutateAsync(options.itemIds); options.onExecuted?.(); },
    async () => { await options.deleteMutation.mutateAsync(options.itemIds); options.onUndone?.(); },
  );
}

export interface MoveItemsCommandOptions {
  itemIds: string[];
  sourceCollectionId: string | null;
  targetCollectionId: string | null;
  targetCollectionName?: string;
  previousCollectionsByItem?: Map<string, string[]>;
  onUndoMove?: () => Promise<void>;
  detachMutation?: { mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown> };
  assignMutation?: { mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown> };
  moveMutation: {
    mutateAsync: (args: { targetCollectionId: string | null; itemIds: string[]; sourceCollectionId?: string | null; scopeId?: string }) => Promise<unknown>;
  };
  scopeId?: string;
  onExecuted?: () => void;
  onUndone?: () => void;
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

export interface ToggleStarCommandOptions {
  itemId: string;
  itemTitle?: string;
  newStarred: boolean;
  toggleStarMutation: { mutateAsync: (args: { id: string; isStarred: boolean }) => Promise<unknown> };
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createToggleStarCommand(options: ToggleStarCommandOptions): LibraryCommand {
  const actionText = options.newStarred ? 'Starred' : 'Unstarred';
  return defineLibraryCommand(
    'star',
    options.itemTitle ? `${actionText} "${options.itemTitle}"` : actionText,
    async () => {
      await options.toggleStarMutation.mutateAsync({ id: options.itemId, isStarred: options.newStarred });
      options.onExecuted?.();
    },
    async () => {
      await options.toggleStarMutation.mutateAsync({ id: options.itemId, isStarred: !options.newStarred });
      options.onUndone?.();
    },
  );
}

export interface UpdateItemMetadataCommandParams {
  itemId: string;
  description?: string;
  forwardPatch: Partial<Item>;
  inversePatch: Partial<Item>;
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

export interface ConvertItemTypeCommandParams {
  itemId: string;
  itemTitle?: string;
  sourceItem: Partial<Item>;
  targetType: string;
  targetTypeLabel?: string;
  retainUnmappedInExtra?: boolean;
  convertType: (args: { itemId: string; targetType: string; retainUnmappedInExtra?: boolean; silent?: boolean }) => Promise<{ item?: Item } | unknown>;
  applyMetadataPatch?: (itemId: string, patch: Partial<Item>) => Promise<unknown>;
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
        const patched = await params.applyMetadataPatch(params.itemId, restorePatch);
        restoredItem = extractResultItem(patched) ?? restoredItem;
      }
      params.onStateSynced?.(restoredItem);
    },
    runForward,
  );
}

export interface MergeDuplicatesCommandParams {
  primaryItem: Item;
  duplicateIdsToDelete: string[];
  mergedFields?: Record<string, unknown>;
  items?: readonly Item[];
  fieldOverrides?: Record<string, unknown>;
  mergeMutation: {
    mutateAsync: (args: { primaryItemId: string; duplicateItemIds: string[]; overrides?: Record<string, unknown> }) => Promise<unknown>;
  };
  restoreMutation?: { mutateAsync: (itemIds: string[]) => Promise<unknown> };
  updateItemMutation?: { mutateAsync: (args: { itemId: string; data: Partial<Item>; silent?: boolean }) => Promise<unknown> };
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
      params.onExecuted?.();
    },
    async () => {
      if (params.duplicateIdsToDelete.length > 0 && params.restoreMutation) {
        await params.restoreMutation.mutateAsync(params.duplicateIdsToDelete);
      }
      if (params.updateItemMutation) {
        await params.updateItemMutation.mutateAsync({ itemId: p.id, data: preMergeSnapshot, silent: true });
      }
      params.onUndone?.();
    },
  );
}

export interface BatchDetachCommandOptions {
  collectionId: string;
  collectionName?: string;
  itemIds: string[];
  detachMutation: { mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown> };
  assignMutation: { mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown> };
  onExecuted?: () => void;
  onUndone?: () => void;
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
    mutateAsync: (args: { itemId: string; data: { tags: string[] }; silent?: boolean }) => Promise<unknown>;
  };
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createBatchTagToggleCommand(options: BatchTagToggleCommandOptions): LibraryCommand {
  return defineLibraryCommand(
    'tag-toggle',
    options.action === 'remove' ? `Removed tag "${options.tagName}"` : `Applied tag "${options.tagName}"`,
    async () => {
      await Promise.all(
        options.snapshots.map((snap) =>
          options.updateItemMutation.mutateAsync({ itemId: snap.itemId, data: { tags: snap.nextTags }, silent: true }),
        ),
      );
      options.onExecuted?.();
    },
    async () => {
      await Promise.all(
        options.snapshots.map((snap) =>
          options.updateItemMutation.mutateAsync({ itemId: snap.itemId, data: { tags: snap.previousTags }, silent: true }),
        ),
      );
      options.onUndone?.();
    },
  );
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

export interface UpdateNoteCommandOptions {
  noteId: string;
  initialVersion?: number;
  previousContentMd: string;
  nextContentMd: string;
  updateNote: (id: string, version: number, dto: { contentMd: string }) => Promise<{ version?: number } | null | undefined>;
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createUpdateNoteCommand(options: UpdateNoteCommandOptions): LibraryCommand {
  let currentVersion = options.initialVersion || 1;
  return defineLibraryCommand(
    `note-update-${options.noteId}`,
    'Updated note',
    async () => {
      const updated = await options.updateNote(options.noteId, currentVersion, { contentMd: options.nextContentMd });
      currentVersion = typeof updated?.version === 'number' ? updated.version : currentVersion + 1;
      options.onExecuted?.();
    },
    async () => {
      const reverted = await options.updateNote(options.noteId, currentVersion, { contentMd: options.previousContentMd });
      currentVersion = typeof reverted?.version === 'number' ? reverted.version : currentVersion + 1;
      options.onUndone?.();
    },
  );
}

export interface DeleteNoteCommandOptions {
  noteId: string;
  version?: number;
  itemId?: string | null;
  contentMd: string;
  contentJson?: Record<string, unknown> | null;
  title?: string;
  tags?: string[];
  deleteNote: (id: string, version?: number) => Promise<unknown>;
  createNote: (dto: { itemId?: string | null; contentMd: string; contentJson?: Record<string, unknown> | null; title?: string; tags?: string[] }) => Promise<{ id?: string; version?: number } | null | undefined>;
  onExecuted?: () => void;
  onUndone?: (recreatedNoteId?: string) => void;
}

export function createDeleteNoteCommand(options: DeleteNoteCommandOptions): LibraryCommand {
  let currentNoteId = options.noteId;
  let currentVersion = options.version;
  return defineLibraryCommand(
    `note-delete-${options.noteId}`,
    'Deleted note',
    async () => { await options.deleteNote(currentNoteId, currentVersion); options.onExecuted?.(); },
    async () => {
      const recreated = await options.createNote({
        itemId: options.itemId,
        contentMd: options.contentMd,
        ...(options.contentJson !== undefined ? { contentJson: options.contentJson } : {}),
        title: options.title,
        ...(options.tags !== undefined ? { tags: options.tags } : {}),
      });
      if (recreated?.id) { currentNoteId = recreated.id; currentVersion = recreated.version; }
      options.onUndone?.(recreated?.id);
    },
  );
}

// ── LibraryCommandStore ──────────────────────────────────────────────────────

export interface LibraryCommandState {
  undoStack: LibraryCommand[];
  redoStack: LibraryCommand[];
  isExecuting: boolean;
  isUndoing: boolean;
  lastCommand: LibraryCommand | null;
  epoch: number;
  currentScopeId: string | null;
}

export interface LibraryCommandActions {
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

export const useLibraryCommandStore = create<LibraryCommandState & LibraryCommandActions>((set, get) => ({
  undoStack: [],
  redoStack: [],
  isExecuting: false,
  isUndoing: false,
  lastCommand: null,
  epoch: 0,
  currentScopeId: null,

  executeCommand: async <T>(command: LibraryCommand<T>, options: { silentToast?: boolean } = {}): Promise<T> => {
    const ensuredCommand: LibraryCommand<T> = command.id
      ? command
      : { ...command, id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
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
      set((s) => ({
        undoStack: [ensuredCommand, ...s.undoStack.filter((c) => c.id !== ensuredCommand.id).slice(0, MAX_HISTORY_LENGTH - 1)],
        redoStack: [],
        lastCommand: ensuredCommand,
        isExecuting: stillExecuting,
      }));
      if (!options.silentToast) {
        const toastId = ensuredCommand.id.startsWith('trash-') ? 'item-delete' : `cmd-${ensuredCommand.id}`;
        toast.success(ensuredCommand.description, { id: toastId });
      }
      return result;
    } catch (err: unknown) {
      activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
      set({ isExecuting: activeExecutionsCount > 0 });
      const message = err instanceof Error ? err.message : 'Operation failed';
      toast.error(`Operation failed: ${message}`, { id: `cmd-err-${ensuredCommand.id}` });
      throw err;
    }
  },

  pushExecutedCommand: <T>(command: LibraryCommand<T>, options: { silentToast?: boolean } = {}): void => {
    const ensuredCommand: LibraryCommand<T> = command.id
      ? command
      : { ...command, id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    const startEpoch = get().epoch;
    if (get().epoch !== startEpoch) return;
    set((s) => ({
      undoStack: [ensuredCommand, ...s.undoStack.filter((c) => c.id !== ensuredCommand.id).slice(0, MAX_HISTORY_LENGTH - 1)],
      redoStack: [],
      lastCommand: ensuredCommand,
    }));
    if (!options.silentToast) {
      const toastId = ensuredCommand.id.startsWith('trash-') ? 'item-delete' : `cmd-${ensuredCommand.id}`;
      toast.success(ensuredCommand.description, { id: toastId });
    }
  },

  undo: async (expectedCommandId?: string): Promise<boolean> => {
    const { undoStack, isUndoing, isExecuting } = get();
    if (undoStack.length === 0 || isUndoing || isExecuting) return false;
    const commandToUndo = expectedCommandId ? undoStack.find((c) => c.id === expectedCommandId) : undoStack[0];
    if (!commandToUndo) return false;

    const startEpoch = get().epoch;
    set({ isUndoing: true });
    try {
      await commandToUndo.undo();
      if (get().epoch !== startEpoch) {
        set({ isUndoing: false });
        return false;
      }
      set((s) => ({
        undoStack: s.undoStack.filter((c) => c.id !== commandToUndo.id),
        redoStack: [commandToUndo, ...s.redoStack.slice(0, MAX_HISTORY_LENGTH - 1)],
        lastCommand: commandToUndo,
        isUndoing: false,
      }));
      toast.info(`Undone: ${commandToUndo.description}`, { id: `undo-${commandToUndo.id}` });
      return true;
    } catch (err: unknown) {
      set({ isUndoing: false });
      const message = err instanceof Error ? err.message : 'Undo failed';
      toast.error(`Undo failed: ${message}`);
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
      set((s) => ({
        redoStack: s.redoStack.filter((c) => c.id !== commandToRedo.id),
        undoStack: [commandToRedo, ...s.undoStack.slice(0, MAX_HISTORY_LENGTH - 1)],
        lastCommand: commandToRedo,
        isExecuting: activeExecutionsCount > 0,
      }));
      toast.success(`Redone: ${commandToRedo.description}`, { id: `redo-${commandToRedo.id}` });
      return true;
    } catch (err: unknown) {
      activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
      set({ isExecuting: activeExecutionsCount > 0 });
      const message = err instanceof Error ? err.message : 'Redo failed';
      toast.error(`Redo failed: ${message}`);
      return false;
    }
  },

  clearHistory: () => {
    activeExecutionsCount = 0;
    clearGroupMergeDraft();
    set((s) => ({ undoStack: [], redoStack: [], lastCommand: null, isExecuting: false, isUndoing: false, epoch: s.epoch + 1 }));
  },

  clear: () => { get().clearHistory(); },

  setScope: (scopeId?: string | null) => {
    const normalized = scopeId || 'user';
    if (get().currentScopeId && get().currentScopeId !== normalized) {
      get().clearHistory();
      clearGroupMergeDraft();
    }
    set({ currentScopeId: normalized });
  },
}));

export function useLibraryCommandManager() {
  const s = useLibraryCommandStore();
  return {
    executeCommand: s.executeCommand,
    pushExecutedCommand: s.pushExecutedCommand,
    undo: s.undo,
    undoById: s.undoById,
    redo: s.redo,
    clearHistory: s.clearHistory,
    canUndo: s.undoStack.length > 0,
    canRedo: s.redoStack.length > 0,
    isExecuting: s.isExecuting,
    isUndoing: s.isUndoing,
  };
}

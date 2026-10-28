import type { Item } from '@/features/library/domain/types/library.types';

export interface DuplicateGroupMergeDraft {
  selectedMasterId: string;
  fieldOverrides: Record<string, unknown>;
  showConflictsOnly: boolean;
}

const MAX_DRAFT_GROUPS = 50;
export const groupMergeDraftCache = new Map<string, DuplicateGroupMergeDraft>();
const draftListeners = new Set<() => void>();

export function setGroupMergeDraft(
  key: string,
  draft: DuplicateGroupMergeDraft,
): void {
  if (!key || key === '__empty__') return;
  if (groupMergeDraftCache.has(key)) {
    groupMergeDraftCache.delete(key);
  } else if (groupMergeDraftCache.size >= MAX_DRAFT_GROUPS) {
    const oldestKey = groupMergeDraftCache.keys().next().value;
    if (oldestKey !== undefined) {
      groupMergeDraftCache.delete(oldestKey);
    }
  }
  groupMergeDraftCache.set(key, draft);
}

export function getGroupMergeDraft(
  key: string,
): DuplicateGroupMergeDraft | undefined {
  return groupMergeDraftCache.get(key);
}

export function notifyDraftListeners(): void {
  draftListeners.forEach((listener) => listener());
}

export function subscribeToDrafts(listener: () => void): () => void {
  draftListeners.add(listener);
  return () => {
    draftListeners.delete(listener);
  };
}

export function computeDuplicateSetKey(items: readonly Item[]): string {
  if (!items || items.length === 0) return '__empty__';
  return items
    .map((i) => i.id)
    .filter(Boolean)
    .sort()
    .join('::');
}

/**
 * Clears persisted duplicate merge drafts either for a specific groupKey / item set,
 * or clears all drafts when no key is provided (e.g., on merge/dismiss completion or scope change).
 */
export function clearGroupMergeDraft(groupKey?: string): void {
  if (!groupKey) {
    if (groupMergeDraftCache.size === 0) return;
    groupMergeDraftCache.clear();
    notifyDraftListeners();
    return;
  }
  let deleted = groupMergeDraftCache.delete(groupKey);
  for (const key of Array.from(groupMergeDraftCache.keys())) {
    const parts = key.split('::');
    if (parts.includes(groupKey)) {
      groupMergeDraftCache.delete(key);
      deleted = true;
    }
  }
  if (deleted) {
    notifyDraftListeners();
  }
}

export function getOrInitDraft(
  setKey: string,
  recommendedMasterId: string,
): DuplicateGroupMergeDraft {
  const existing = groupMergeDraftCache.get(setKey);
  if (existing) return existing;
  const initialDraft: DuplicateGroupMergeDraft = {
    selectedMasterId: recommendedMasterId,
    fieldOverrides: {},
    showConflictsOnly: false,
  };
  if (setKey && setKey !== '__empty__') {
    setGroupMergeDraft(setKey, initialDraft);
  }
  return initialDraft;
}

export function updateGroupDraft(
  setKey: string,
  updater: (prev: DuplicateGroupMergeDraft) => DuplicateGroupMergeDraft,
  fallbackMasterId: string,
): void {
  if (!setKey || setKey === '__empty__') return;
  const current = getOrInitDraft(setKey, fallbackMasterId);
  const next = updater(current);
  setGroupMergeDraft(setKey, next);
  notifyDraftListeners();
}

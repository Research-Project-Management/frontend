import type { Item } from '@/features/library/domain/types/library.types';

export interface DuplicateGroupMergeDraft {
  selectedMasterId: string;
  fieldOverrides: Record<string, unknown>;
  showConflictsOnly: boolean;
}

export function createInitialDuplicateGroupMergeDraft(
  recommendedMasterId: string,
): DuplicateGroupMergeDraft {
  return {
    selectedMasterId: recommendedMasterId,
    fieldOverrides: {},
    showConflictsOnly: false,
  };
}

export function computeDuplicateSetKey(items: readonly Item[]): string {
  if (!items || items.length === 0) return '__empty__';
  const sorted = items
    .map((i) => i.id)
    .filter((id): id is string => Boolean(id))
    .sort()
    .join('::');
  return sorted || '__empty__';
}

export function getDeterministicDuplicateGroupKey(group: {
  key?: string | null;
  items?: readonly Item[] | null;
}): string {
  if (group.items && group.items.length > 0) {
    const setKey = computeDuplicateSetKey(group.items);
    if (setKey !== '__empty__') return setKey;
  }
  return group.key || '__empty__';
}

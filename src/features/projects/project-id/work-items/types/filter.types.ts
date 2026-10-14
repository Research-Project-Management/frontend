import type React from 'react';
import type { Filters } from './work-item.types';

export type WorkItemFilterQuery = Partial<Filters>;

export interface FilterItemConfig {
  id: string;
  label: string;
  icon?: React.ElementType;
}

export interface FilterBitsetLike {
  words: Uint32Array;
  size: number;
  has(index: number): boolean;
  set(index: number): void;
  count(): number;
}

export interface InvertedIndexStore<TBitset = FilterBitsetLike> {
  stateMap: Map<string, TBitset>;
  stateGroupMap: Map<string, TBitset>;
  priorityMap: Map<string, TBitset>;
  assigneeMap: Map<string, TBitset>;
  unassignedBitset: TBitset;
  authorMap: Map<string, TBitset>;
  labelMap: Map<string, TBitset>;
  tokenMap: Map<string, TBitset>;
  sortedTokenKeys: string[];
  hasParentBitset: TBitset;
  noParentBitset: TBitset;
  parentMap: Map<string, TBitset>;
  hasAttachmentsBitset: TBitset;
  hasPagesBitset: TBitset;
  hasPapersBitset: TBitset;
  hasFilesBitset: TBitset;
  hasLinksBitset: TBitset;
  // Due date categories
  dueDateOverdueBitset: TBitset;
  dueDateTodayBitset: TBitset;
  dueDateThisWeekBitset: TBitset;
  dueDateThisMonthBitset: TBitset;
}

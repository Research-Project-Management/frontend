'use client';

import { useMemo } from 'react';
import type { Item, Column, DisplayOptions, ProjectMember, Label } from '../types/work-item.types';
import {
  resolveColumnId,
  getItemBucketKey,
  PRIORITY_THEME_COLORS,
  GROUP_DEFAULT_COLORS,
} from '../utils/work-item.utils';

import type { UseWorkItemGroupingOptions } from '../types/hook.types';

export type { UseWorkItemGroupingOptions };

export function useWorkItemGrouping({
  items,
  columns,
  members = [],
  labels = [],
  displayOptions,
}: UseWorkItemGroupingOptions) {
  // ── 1. Determine effective GroupBy ─────────────────────────────────────────
  const effectiveGroupBy = useMemo(() => {
    const gb = displayOptions?.groupBy;
    return gb && ['state', 'priority', 'assignee', 'labels', 'none', 'createdBy'].includes(gb)
      ? gb
      : 'state';
  }, [displayOptions?.groupBy]);

  // ── 2. Build Columns based on GroupBy ──────────────────────────────────────
  const activeColumns = useMemo<Column[]>(() => {
    const groupBy = effectiveGroupBy;
    if (groupBy === 'priority') {
      return [
        { id: 'urgent', name: 'Urgent', title: 'Urgent', color: PRIORITY_THEME_COLORS.urgent, accentColor: PRIORITY_THEME_COLORS.urgent, group: 'unstarted', sequence: 0, isDefault: false },
        { id: 'high', name: 'High', title: 'High', color: PRIORITY_THEME_COLORS.high, accentColor: PRIORITY_THEME_COLORS.high, group: 'unstarted', sequence: 1, isDefault: false },
        { id: 'medium', name: 'Medium', title: 'Medium', color: PRIORITY_THEME_COLORS.medium, accentColor: PRIORITY_THEME_COLORS.medium, group: 'unstarted', sequence: 2, isDefault: false },
        { id: 'low', name: 'Low', title: 'Low', color: PRIORITY_THEME_COLORS.low, accentColor: PRIORITY_THEME_COLORS.low, group: 'unstarted', sequence: 3, isDefault: false },
        { id: 'none', name: 'No Priority', title: 'No Priority', color: PRIORITY_THEME_COLORS.none, accentColor: PRIORITY_THEME_COLORS.none, group: 'unstarted', sequence: 4, isDefault: false },
      ];
    }
    if (groupBy === 'assignee') {
      const memberCols: Column[] = (members || []).map((m, idx) => {
        const mem = m as typeof m & { user?: { id?: string; name?: string } };
        const userId = mem.userId || mem.user?.id || mem.id || `member-${idx}`;
        const name = mem.name || mem.user?.name || 'Member';
        return {
          id: userId,
          name,
          title: name,
          color: GROUP_DEFAULT_COLORS.assignee,
          accentColor: GROUP_DEFAULT_COLORS.assignee,
          group: 'unstarted',
          sequence: idx,
          isDefault: false,
        };
      });
      return [
        ...memberCols,
        { id: '__unassigned__', name: 'Unassigned', title: 'Unassigned', color: GROUP_DEFAULT_COLORS.unassigned, accentColor: GROUP_DEFAULT_COLORS.unassigned, group: 'backlog', sequence: 999, isDefault: false },
      ];
    }
    if (groupBy === 'labels') {
      const labelCols: Column[] = (labels || []).map((l: { id?: string; name?: string; title?: string; color?: string }, idx: number) => {
        const id = l.id || l.name || `label-${idx}`;
        const name = l.name || l.title || 'Label';
        const color = l.color || GROUP_DEFAULT_COLORS.label;
        return {
          id,
          name,
          title: name,
          color,
          accentColor: color,
          group: 'unstarted',
          sequence: idx,
          isDefault: false,
        };
      });
      return [
        ...labelCols,
        { id: '__no_label__', name: 'No Label', title: 'No Label', color: GROUP_DEFAULT_COLORS.noLabel, accentColor: GROUP_DEFAULT_COLORS.noLabel, group: 'backlog', sequence: 999, isDefault: false },
      ];
    }
    if (groupBy === 'createdBy') {
      const authorCols: Column[] = (members || []).map((m: ProjectMember | { id?: string; userId?: string; name?: string; user?: { id?: string; name?: string } }, idx: number) => {
        const userId = m.userId || m.user?.id || m.id || `author-${idx}`;
        const name = m.name || m.user?.name || 'Member';
        return {
          id: userId,
          name,
          title: name,
          color: GROUP_DEFAULT_COLORS.createdBy,
          accentColor: GROUP_DEFAULT_COLORS.createdBy,
          group: 'unstarted',
          sequence: idx,
          isDefault: false,
        };
      });
      return [
        ...authorCols,
        { id: '__unknown__', name: 'Unknown Creator', title: 'Unknown Creator', color: GROUP_DEFAULT_COLORS.unknown, accentColor: GROUP_DEFAULT_COLORS.unknown, group: 'backlog', sequence: 999, isDefault: false },
      ];
    }
    if (groupBy === 'none') {
      return [
        { id: '__all__', name: 'All Work Items', title: 'All Work Items', color: GROUP_DEFAULT_COLORS.all, accentColor: GROUP_DEFAULT_COLORS.all, group: 'unstarted', sequence: 0, isDefault: true },
      ];
    }
    return columns;
  }, [effectiveGroupBy, columns, members, labels]);

  // ── 3. Bucket Items by Column ID ──────────────────────────────────────────
  const itemsByColumnId = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const column of activeColumns) {
      const colId = resolveColumnId(column);
      if (colId) map.set(colId, []);
    }

    const fallbackCol = activeColumns.find((c) => c.isDefault) || activeColumns[0];
    const fallbackColId = fallbackCol ? resolveColumnId(fallbackCol) : undefined;

    for (const item of items) {
      const bucketKey = getItemBucketKey(item, effectiveGroupBy);
      if (bucketKey && map.has(bucketKey)) {
        map.get(bucketKey)!.push(item);
      } else if (fallbackColId && map.has(fallbackColId)) {
        map.get(fallbackColId)!.push(item);
      } else if (bucketKey) {
        map.set(bucketKey, [item]);
      }
    }
    return map;
  }, [activeColumns, items, effectiveGroupBy]);

  // ── 4. Visible Columns Filtered by showEmptyGroups ────────────────────────
  const visibleColumns = useMemo(() => {
    if (displayOptions?.showEmptyGroups === false && effectiveGroupBy !== 'none') {
      const filtered = activeColumns.filter((col) => {
        const colId = resolveColumnId(col);
        const count = itemsByColumnId.get(colId)?.length ?? 0;
        return count > 0;
      });
      return filtered.length > 0 ? filtered : activeColumns;
    }
    return activeColumns;
  }, [activeColumns, itemsByColumnId, displayOptions?.showEmptyGroups, effectiveGroupBy]);

  return {
    effectiveGroupBy,
    activeColumns,
    itemsByColumnId,
    visibleColumns,
  };
}

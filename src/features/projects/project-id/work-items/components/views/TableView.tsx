'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Tag,
  User,
  Plus,
  FileText,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import {
  StatusIcon,
  UrgentPriorityBoxIcon,
  HighPriorityBoxIcon,
  MediumPriorityBoxIcon,
  LowPriorityBoxIcon,
  NonePriorityBoxIcon,
} from '@/shared/components/icons';
import { cn } from '@/shared/lib/utils';
import {
  ItemHelpers,
  MemberHelpers,
  resolveColumnId,
  buildItemTree,
  compareItems,
  formatTableDate,
  isDateOverdue,
} from '@/features/projects/project-id/work-items/utils/work-item.utils';
import type {
  Item,
  Priority,
} from '@/features/projects/project-id/work-items/types/work-item.types';

// Subcomponents, types, and constants
export * from '@/features/projects/project-id/work-items/types/work-item.types';
export { formatTableDate, isDateOverdue };
export * from './table/HeaderRow';
export * from './table/RowItem';
export * from './table/GroupRowList';
export * from './table/InlineAddRow';
export * from './table/HorizontalScrollbar';

import {
  type TablePropertyKey,
  type DisplayPropertyKey,
  type TableSortField,
  type TableSortOrder,
  DEFAULT_VISIBLE_PROPERTIES,
  DEFAULT_COLUMN_WIDTHS,
  type TableViewProps,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import { HeaderRow, GroupHeader } from './table/HeaderRow';
import { GroupRowList } from './table/GroupRowList';
import { InlineAddRow } from './table/InlineAddRow';

export function renderPriorityIcon(priority?: Priority, className?: string) {
  const p = priority || 'none';
  switch (p) {
    case 'urgent':
      return <UrgentPriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
    case 'high':
      return <HighPriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
    case 'medium':
      return <MediumPriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
    case 'low':
      return <LowPriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
    case 'none':
    default:
      return <NonePriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
  }
}

// ── Main TableView Component ──────────────────────────────────────────────────

export function TableView({
  items = [],
  itemsByColumnId,
  columns,
  projectStates,
  displayOptions,
  projectId = '',
  members = [],
  onAddItem,
  onEditItem,
  onDeleteItem,
  onDuplicateItem,
  onUpdateItem,
  isReadOnly = false,
  selectedIds: propSelectedIds,
  onToggleSelect: rawOnToggleSelect,
  onToggleDisplayProperty,
}: TableViewProps) {
  // ── A. Column Visibility (Synchronized with displayOptions.properties) ─────
  const visibleProperties = useMemo<Record<TablePropertyKey, boolean>>(() => {
    const p = (displayOptions?.properties || {}) as Record<string, unknown>;

    return {
      state: p.state !== undefined ? Boolean(p.state) : DEFAULT_VISIBLE_PROPERTIES.state,
      priority: p.priority !== undefined ? Boolean(p.priority) : DEFAULT_VISIBLE_PROPERTIES.priority,
      assignees:
        (p.assignees ?? p.assignee) !== undefined
          ? Boolean(p.assignees ?? p.assignee)
          : DEFAULT_VISIBLE_PROPERTIES.assignees,
      startDate:
        (p.startDate ?? p.start_date) !== undefined
          ? Boolean(p.startDate ?? p.start_date)
          : DEFAULT_VISIBLE_PROPERTIES.startDate,
      dueDate:
        (p.dueDate ?? p.due_date) !== undefined
          ? Boolean(p.dueDate ?? p.due_date)
          : DEFAULT_VISIBLE_PROPERTIES.dueDate,
      labels: p.labels !== undefined ? Boolean(p.labels) : DEFAULT_VISIBLE_PROPERTIES.labels,
      subItemCount:
        (p.subItemCount ?? p.sub_issue_count ?? p.childWorkItemCount) !== undefined
          ? Boolean(p.subItemCount ?? p.sub_issue_count ?? p.childWorkItemCount)
          : DEFAULT_VISIBLE_PROPERTIES.subItemCount,
      attachment:
        (p.attachment ?? p.attachment_count ?? p.attachmentCount ?? p.attach) !== undefined
          ? Boolean(p.attachment ?? p.attachment_count ?? p.attachmentCount ?? p.attach)
          : DEFAULT_VISIBLE_PROPERTIES.attachment,
      link: p.link !== undefined ? Boolean(p.link) : DEFAULT_VISIBLE_PROPERTIES.link,
      createdOn:
        (p.createdOn ?? p.created_on) !== undefined
          ? Boolean(p.createdOn ?? p.created_on)
          : DEFAULT_VISIBLE_PROPERTIES.createdOn,
      createdBy:
        (p.createdBy ?? p.created_by) !== undefined
          ? Boolean(p.createdBy ?? p.created_by)
          : DEFAULT_VISIBLE_PROPERTIES.createdBy,
      updatedOn:
        (p.updatedOn ?? p.updated_on) !== undefined
          ? Boolean(p.updatedOn ?? p.updated_on)
          : DEFAULT_VISIBLE_PROPERTIES.updatedOn,
    };
  }, [displayOptions?.properties]);

  const handleToggleProperty = useCallback(
    (key: TablePropertyKey) => {
      const nextVal = !visibleProperties[key];
      if (onToggleDisplayProperty) {
        const keyMap: Partial<Record<TablePropertyKey, DisplayPropertyKey>> = {
          state: 'state',
          priority: 'priority',
          assignees: 'assignee',
          startDate: 'startDate',
          dueDate: 'dueDate',
          labels: 'labels',
          subItemCount: 'childWorkItemCount',
          attachment: 'attachmentCount',
          link: 'link',
          createdOn: 'createdOn',
          createdBy: 'createdBy',
          updatedOn: 'updatedOn',
        };
        const displayKey = keyMap[key];
        if (displayKey) {
          onToggleDisplayProperty(displayKey, nextVal);
        }
      }
    },
    [visibleProperties, onToggleDisplayProperty]
  );

  // ── B. Multi-Select Handling ───────────────────────────────────────────────
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([]);
  const selectedIds = propSelectedIds ?? localSelectedIds;

  const handleToggleSelect = useCallback(
    (id: string) => {
      if (rawOnToggleSelect) {
        rawOnToggleSelect(id);
      } else {
        setLocalSelectedIds((prev) =>
          prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
      }
    },
    [rawOnToggleSelect]
  );

  // ── D. Sorting ─────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<TableSortField>('identifier');
  const [sortOrder, setSortOrder] = useState<TableSortOrder>('asc');

  const handleSort = useCallback(
    (field: TableSortField) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
    },
    [sortField]
  );

  const sortItemsList = useCallback(
    (list: Item[]) => {
      if (!sortField) return [...list];
      const copy = [...list];
      copy.sort((itemA, itemB) =>
        compareItems(itemA, itemB, sortField, sortOrder),
      );
      return copy;
    },
    [sortField, sortOrder]
  );

  // ── E. Grouping Logic ──────────────────────────────────────────────────────
  const effectiveGroupBy = displayOptions?.groupBy ?? 'none';
  const isGrouped = Boolean(effectiveGroupBy && effectiveGroupBy !== 'none');

  // Group expansion state
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const stateList = useMemo(
    () => (projectStates && projectStates.length > 0 ? projectStates : columns),
    [projectStates, columns]
  );

  // Dynamic Groups Generation based on effectiveGroupBy
  const groups = useMemo(() => {
    if (!isGrouped) return [];

    if (effectiveGroupBy === 'priority') {
      const priorityConfigs: Array<{ key: Priority; title: string }> = [
        { key: 'urgent', title: 'Urgent' },
        { key: 'high', title: 'High' },
        { key: 'medium', title: 'Medium' },
        { key: 'low', title: 'Low' },
        { key: 'none', title: 'No priority' },
      ];

      return priorityConfigs.map((p) => {
        const groupItems =
          itemsByColumnId instanceof Map && itemsByColumnId.has(p.key)
            ? itemsByColumnId.get(p.key) || []
            : items.filter((item) => (item.priority || 'none').toLowerCase() === p.key.toLowerCase());
        return {
          key: p.key,
          title: p.title,
          color: undefined,
          icon: renderPriorityIcon(p.key),
          items: sortItemsList(groupItems),
        };
      });
    }

    if (effectiveGroupBy === 'assignee') {
      const memberGroups = (members || []).map((m) => {
        const userId = MemberHelpers.resolveUserId(m);
        const name = MemberHelpers.resolveDisplayName(m, 'Member');
        const avatar = MemberHelpers.resolveAvatar(m);
        const groupItems =
          itemsByColumnId instanceof Map && itemsByColumnId.has(userId)
            ? itemsByColumnId.get(userId) || []
            : items.filter(
                (item) => ItemHelpers.resolveAssigneeId(item) === userId
              );
        return {
          key: userId,
          title: name,
          color: undefined,
          icon: (
            <Avatar className="size-4 shrink-0">
              <AvatarImage src={avatar} />
              <AvatarFallback className="text-9 font-medium bg-muted">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ),
          items: sortItemsList(groupItems),
        };
      });

      const unassignedItems =
        itemsByColumnId instanceof Map && itemsByColumnId.has('__unassigned__')
          ? itemsByColumnId.get('__unassigned__') || []
          : items.filter((item) => !ItemHelpers.resolveAssigneeId(item));
      memberGroups.push({
        key: '__unassigned__',
        title: 'Unassigned',
        color: undefined,
        icon: <User className="size-3.5 shrink-0 text-muted-foreground" />,
        items: sortItemsList(unassignedItems),
      });

      return memberGroups;
    }

    if (effectiveGroupBy === 'createdBy') {
      const authorGroups = (members || []).map((m) => {
        const userId = MemberHelpers.resolveUserId(m);
        const name = MemberHelpers.resolveDisplayName(m, 'Member');
        const avatar = MemberHelpers.resolveAvatar(m);
        const groupItems =
          itemsByColumnId instanceof Map && itemsByColumnId.has(userId)
            ? itemsByColumnId.get(userId) || []
            : items.filter((item) => (ItemHelpers.resolveAuthorId(item) || '') === userId);
        return {
          key: userId,
          title: name,
          color: undefined,
          icon: (
            <Avatar className="size-4 shrink-0">
              <AvatarImage src={avatar} />
              <AvatarFallback className="text-9 font-medium bg-muted">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ),
          items: sortItemsList(groupItems),
        };
      });

      const unknownAuthorItems =
        itemsByColumnId instanceof Map && itemsByColumnId.has('__unknown_author__')
          ? itemsByColumnId.get('__unknown_author__') || []
          : items.filter((item) => !ItemHelpers.resolveAuthorId(item));
      if (unknownAuthorItems.length > 0) {
        authorGroups.push({
          key: '__unknown_author__',
          title: 'Unknown Author',
          color: undefined,
          icon: <User className="size-3.5 shrink-0 text-muted-foreground" />,
          items: sortItemsList(unknownAuthorItems),
        });
      }

      return authorGroups;
    }

    if (effectiveGroupBy === 'labels') {
      const labelMap = new Map<string, { id: string; name: string; color?: string }>();
      items.forEach((item) => {
        if (Array.isArray(item.labels)) {
          item.labels.forEach((l: string | { id?: string; name?: string; title?: string; color?: string }) => {
            const id = typeof l === 'string' ? l : l.id || l.name;
            const name = (typeof l === 'string' ? l : l.name || l.title || l.id) || '';
            const color = typeof l === 'object' ? l.color : undefined;
            if (id && !labelMap.has(id)) {
              labelMap.set(id, { id, name, color });
            }
          });
        }
      });

      const labelGroups = Array.from(labelMap.values()).map((l) => {
        const groupItems = items.filter((item) => {
          if (!Array.isArray(item.labels)) return false;
          return item.labels.some((il: string | { id?: string; name?: string }) => (typeof il === 'string' ? il : il.id || il.name) === l.id);
        });
        return {
          key: l.id,
          title: l.name,
          color: l.color,
          icon: l.color ? (
            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
          ) : (
            <Tag className="size-3.5 shrink-0 text-muted-foreground" />
          ),
          items: sortItemsList(groupItems),
        };
      });

      const noLabelItems = items.filter((item) => !Array.isArray(item.labels) || item.labels.length === 0);
      labelGroups.push({
        key: '__no_label__',
        title: 'No label',
        color: undefined,
        icon: <Tag className="size-3.5 shrink-0 text-muted-foreground" />,
        items: sortItemsList(noLabelItems),
      });

      return labelGroups;
    }

    // Default: Group by State
    return stateList.map((col) => {
      const colId = resolveColumnId(col);
      const groupItems =
        itemsByColumnId instanceof Map
          ? itemsByColumnId.get(colId) || []
          : (itemsByColumnId as Record<string, Item[]>)?.[colId] ??
            items.filter((i) => {
              const itemCol = i.columnId || (i as { stateId?: string }).stateId || i.state?.id;
              return itemCol === colId;
            });
      const colColor = col.color || col.accentColor || '#6B7280';
      const colTitle = col.title || col.name || 'Group';

      return {
        key: colId,
        title: colTitle,
        color: colColor,
        icon: (
          <StatusIcon
            id={colId}
            title={colTitle}
            group={col.group || col.slug || colTitle}
            color={colColor}
            className="size-3.5 shrink-0"
          />
        ),
        items: sortItemsList(groupItems),
      };
    });
  }, [isGrouped, effectiveGroupBy, items, itemsByColumnId, stateList, members, sortItemsList]);

  // Flat sorted items when not grouped
  const flatSortedItems = useMemo(() => {
    if (isGrouped) return [];
    return sortItemsList(items);
  }, [isGrouped, items, sortItemsList]);

  // ── F. Sub-items Tree & Hierarchy (Plane.so style) ─────────────────────────
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(new Set());

  const toggleExpandChildren = useCallback((parentId: string) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

  const showChildWorkItems = displayOptions?.showChildWorkItems ?? true;

  const buildTreeRows = useCallback(
    (sortedList: Item[]) =>
      buildItemTree(sortedList, { showChildWorkItems, collapsedParentIds }),
    [showChildWorkItems, collapsedParentIds]
  );

  const flatTreeRows = useMemo(
    () => buildTreeRows(flatSortedItems),
    [buildTreeRows, flatSortedItems]
  );

  const defaultColId = useMemo(() => {
    const defaultCol = columns.find((c) => c.isDefault) || columns[0];
    return defaultCol ? resolveColumnId(defaultCol) : 'backlog';
  }, [columns]);

  const tableScrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden bg-background">
      <div
        ref={tableScrollRef}
        className="flex-1 overflow-auto select-none bg-background relative min-h-0 interactive-scrollbar"
      >
        <div role="table" aria-label="Work items table" className="w-full min-w-max flex flex-col">
          {/* Main Sticky Header */}
          <div role="rowgroup">
            <HeaderRow
              visibleProperties={visibleProperties}
              onToggleProperty={handleToggleProperty}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
          </div>

          {/* Zero items state */}
          {items.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="size-10 rounded-md bg-muted flex items-center justify-center mb-3">
                <FileText className="size-5 text-foreground" />
              </div>
              <h4 className="text-16 font-semibold text-foreground mb-1">No work items found</h4>
              <p className="text-13 text-muted-foreground mb-4">
                There are no items matching the current view filters.
              </p>
              {!isReadOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddItem(defaultColId)}
                  className="gap-1.5 text-xs rounded-md focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <Plus className="size-3.5" />
                  <span>Create work item</span>
                </Button>
              )}
            </div>
          )}

          {/* Grouped Mode */}
          {isGrouped && items.length > 0 && (
            <div role="rowgroup" className="flex flex-col">
              {groups.map((group) => {
                if (group.items.length === 0 && !displayOptions?.showEmptyGroups) {
                  return null;
                }
                const isExpanded = !collapsedGroupKeys.has(group.key);

                return (
                  <div key={group.key} className="flex flex-col">
                    <GroupHeader
                      title={group.title}
                      color={group.color}
                      icon={group.icon}
                      count={group.items.length}
                      isExpanded={isExpanded}
                      onToggle={() => toggleGroupCollapse(group.key)}
                    />

                    {isExpanded && (
                      <GroupRowList
                        rows={buildTreeRows(group.items)}
                        scrollRef={tableScrollRef}
                        columns={columns}
                        projectStates={projectStates || columns}
                        visibleProperties={visibleProperties}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                        onEditItem={onEditItem}
                        onDeleteItem={onDeleteItem}
                        onDuplicateItem={onDuplicateItem}
                        onUpdateItem={onUpdateItem}
                        members={members}
                        projectId={projectId}
                        isReadOnly={isReadOnly}
                        toggleExpandChildren={toggleExpandChildren}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Flat Mode */}
          {!isGrouped && items.length > 0 && (
            <div role="rowgroup" className="flex flex-col">
              <GroupRowList
                rows={flatTreeRows}
                scrollRef={tableScrollRef}
                columns={columns}
                projectStates={projectStates || columns}
                visibleProperties={visibleProperties}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onEditItem={onEditItem}
                onDeleteItem={onDeleteItem}
                onDuplicateItem={onDuplicateItem}
                onUpdateItem={onUpdateItem}
                members={members}
                projectId={projectId}
                isReadOnly={isReadOnly}
                toggleExpandChildren={toggleExpandChildren}
              />
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Footer: "+ New work item" Row (pinned at bottom, outside the scroll area) */}
      {items.length > 0 && !isReadOnly && (
        <div className="shrink-0 border-t border-border bg-background z-20">
          <InlineAddRow
            targetColumnId={defaultColId}
            titleWidth={DEFAULT_COLUMN_WIDTHS.title}
            onAddItem={onAddItem}
            isReadOnly={isReadOnly}
          />
        </div>
      )}
    </div>
  );
}

export default TableView;

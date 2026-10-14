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
import { StatusIcon } from '@/shared/components/icons';
import { ItemHelpers, resolveColumnId } from '../../utils/work-item.utils';
import type {
  Item,
  Priority,
} from '../../types/work-item.types';

// Subcomponents, types, and constants
export * from '../../types/table-view.types';
export * from '../../utils/table.utils';
export * from './table/TableColumnPropertiesPopover';
export * from './table/TableHeaderRow';
export * from './table/TableGroupHeader';
export * from './table/TableRowItem';
export * from './table/TableGroupRowList';
export * from './table/TableInlineAddRow';
export * from './table/TableHorizontalScrollbar';

import {
  type TablePropertyKey,
  type DisplayPropertyKey,
  type TableSortField,
  type TableSortOrder,
  DEFAULT_VISIBLE_PROPERTIES,
  DEFAULT_COLUMN_WIDTHS,
  type TableViewProps,
} from '../../types/table-view.types';
import { renderPriorityIcon } from '../../utils/table.utils';
import { TableHeaderRow } from './table/TableHeaderRow';
import { TableGroupHeader } from './table/TableGroupHeader';
import { TableGroupRowList } from './table/TableGroupRowList';
import { TableInlineAddRow } from './table/TableInlineAddRow';

// ── Main TableView Component ──────────────────────────────────────────────────

export function TableView({
  items = [],
  itemsByColumnId,
  columns,
  projectStates,
  displayOptions,
  projectId = '',
  members = [],
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onUpdateCard,
  isReadOnly = false,
  selectedIds: propSelectedIds,
  onToggleSelect: rawOnToggleSelect,
  onSelectAll: rawOnSelectAll,
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
        };
        const displayKey = keyMap[key];
        if (displayKey) {
          onToggleDisplayProperty(displayKey, nextVal);
        }
      }
    },
    [visibleProperties, onToggleDisplayProperty]
  );

  const handleResetProperties = useCallback(() => {
    // Reset properties to default
  }, []);

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

  const handleSelectAll = useCallback(() => {
    const allIds = items.map((i) => i.id);
    const isAll = items.length > 0 && selectedIds.length === items.length;

    if (rawOnSelectAll) {
      rawOnSelectAll(isAll ? [] : allIds);
    } else {
      setLocalSelectedIds(isAll ? [] : allIds);
    }
  }, [items, selectedIds, rawOnSelectAll]);

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
      const copy = [...list];
      copy.sort((itemA, itemB) => {
        let comparison = 0;

        switch (sortField) {
          case 'identifier': {
            const numA = itemA.sequenceNumber || 0;
            const numB = itemB.sequenceNumber || 0;
            comparison = numA - numB;
            break;
          }
          case 'title':
            comparison = (itemA.title || '').localeCompare(itemB.title || '');
            break;
          case 'dueDate': {
            const timeA = itemA.dueDate ? new Date(itemA.dueDate).getTime() : 0;
            const timeB = itemB.dueDate ? new Date(itemB.dueDate).getTime() : 0;
            comparison = timeA - timeB;
            break;
          }
          case 'startDate': {
            const timeA = itemA.startDate ? new Date(itemA.startDate).getTime() : 0;
            const timeB = itemB.startDate ? new Date(itemB.startDate).getTime() : 0;
            comparison = timeA - timeB;
            break;
          }
          case 'createdOn': {
            const timeA = itemA.createdAt ? new Date(itemA.createdAt).getTime() : 0;
            const timeB = itemB.createdAt ? new Date(itemB.createdAt).getTime() : 0;
            comparison = timeA - timeB;
            break;
          }
          case 'updatedOn': {
            const timeA = itemA.updatedAt ? new Date(itemA.updatedAt).getTime() : 0;
            const timeB = itemB.updatedAt ? new Date(itemB.updatedAt).getTime() : 0;
            comparison = timeA - timeB;
            break;
          }
          case 'priority': {
            const weights: Record<string, number> = {
              urgent: 4,
              high: 3,
              medium: 2,
              low: 1,
              none: 0,
            };
            const weightA = weights[itemA.priority || 'none'] || 0;
            const weightB = weights[itemB.priority || 'none'] || 0;
            comparison = weightA - weightB;
            break;
          }
          default:
            comparison = 0;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
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
        const mem = m as typeof m & { user?: { id?: string; name?: string } };
        const userId = mem.userId || mem.user?.id || mem.id || '';
        const name = mem.name || mem.user?.name || 'Member';
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
              <AvatarImage src={mem.avatar || mem.user?.avatar} />
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
    (sortedList: Item[]): Array<{
      item: Item;
      isSubItem: boolean;
      hasChildren: boolean;
      isChildrenExpanded: boolean;
    }> => {
      if (!showChildWorkItems) {
        return sortedList
          .filter((item) => !item.parentId && !item.parentItemId && !item.parentWorkItemId)
          .map((item) => ({
            item,
            isSubItem: false,
            hasChildren: false,
            isChildrenExpanded: true,
          }));
      }

      const itemMap = new Map<string, Item>();
      sortedList.forEach((it) => itemMap.set(it.id, it));

      const childrenByParentId = new Map<string, Item[]>();
      const rootItems: Item[] = [];

      sortedList.forEach((it) => {
        const pId = it.parentId || it.parentItemId || it.parentWorkItemId;
        if (pId && itemMap.has(pId)) {
          const arr = childrenByParentId.get(pId) || [];
          arr.push(it);
          childrenByParentId.set(pId, arr);
        } else {
          rootItems.push(it);
        }
      });

      const result: Array<{
        item: Item;
        isSubItem: boolean;
        hasChildren: boolean;
        isChildrenExpanded: boolean;
      }> = [];
      const visited = new Set<string>();

      const appendItemAndChildren = (it: Item, depth: number) => {
        if (visited.has(it.id)) return;
        visited.add(it.id);

        const children = childrenByParentId.get(it.id) || [];
        const hasChildren = children.length > 0;
        const isChildrenExpanded = !collapsedParentIds.has(it.id);

        result.push({
          item: it,
          isSubItem: depth > 0,
          hasChildren,
          isChildrenExpanded,
        });

        if (hasChildren && isChildrenExpanded) {
          children.forEach((child) => appendItemAndChildren(child, depth + 1));
        }
      };

      rootItems.forEach((root) => appendItemAndChildren(root, 0));

      return result;
    },
    [showChildWorkItems, collapsedParentIds]
  );

  const flatTreeRows = useMemo(
    () => buildTreeRows(flatSortedItems),
    [buildTreeRows, flatSortedItems]
  );

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < items.length;

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
        <div role="table" aria-label="Work items table" className="min-w-full w-max flex flex-col">
          {/* Main Sticky Header */}
          <div role="rowgroup">
            <TableHeaderRow
              visibleProperties={visibleProperties}
              onToggleProperty={handleToggleProperty}
              onResetProperties={handleResetProperties}
              isAllSelected={isAllSelected}
              isSomeSelected={isSomeSelected}
              onToggleSelectAll={handleSelectAll}
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
                  onClick={() => onAddCard(defaultColId)}
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
                    <TableGroupHeader
                      title={group.title}
                      color={group.color}
                      icon={group.icon}
                      count={group.items.length}
                      isExpanded={isExpanded}
                      onToggle={() => toggleGroupCollapse(group.key)}
                    />

                    {isExpanded && (
                      <TableGroupRowList
                        rows={buildTreeRows(group.items)}
                        scrollRef={tableScrollRef}
                        columns={columns}
                        projectStates={projectStates || columns}
                        visibleProperties={visibleProperties}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                        onEditCard={onEditCard}
                        onDeleteCard={onDeleteCard}
                        onDuplicateCard={onDuplicateCard}
                        onUpdateCard={onUpdateCard}
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
              <TableGroupRowList
                rows={flatTreeRows}
                scrollRef={tableScrollRef}
                columns={columns}
                projectStates={projectStates || columns}
                visibleProperties={visibleProperties}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onEditCard={onEditCard}
                onDeleteCard={onDeleteCard}
                onDuplicateCard={onDuplicateCard}
                onUpdateCard={onUpdateCard}
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
          <TableInlineAddRow
            targetColumnId={defaultColId}
            titleWidth={DEFAULT_COLUMN_WIDTHS.title}
            onAddCard={onAddCard}
            isReadOnly={isReadOnly}
          />
        </div>
      )}
    </div>
  );
}

export default TableView;

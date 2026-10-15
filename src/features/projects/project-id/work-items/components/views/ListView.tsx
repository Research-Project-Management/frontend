'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Plus,
  LayoutGrid,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';
import type { Item, SubItem } from '@/features/projects/project-id/work-items/types/work-item.types';
import { resolveColumnId } from '@/features/projects/project-id/work-items/utils/work-item.utils';
import {
  useCreateSubItem,
  useUpdateItem,
  useDeleteItem,
} from '@/features/projects/project-id/work-items/hooks/use-work-item-crud';

// Subcomponents, types, and constants
export * from '@/features/projects/project-id/work-items/types/list-view.types';
export * from './list/GroupCheckbox';
export * from './list/ChildItemRow';
export * from './list/ItemRow';
export * from './list/SortableItemRow';
export * from './list/ListViewGroup';

import { ItemRow } from './list/ItemRow';
import { SortableItemRow } from './list/SortableItemRow';
import { ListViewGroup } from './list/ListViewGroup';
import type { ListViewProps } from '@/features/projects/project-id/work-items/types/list-view.types';
import { EMPTY_ARRAY } from '@/features/projects/project-id/work-items/utils/list.utils';

export const ListView = React.memo(function ListView({
  projectId,
  itemsByColumnId: propItemsByColumnId,
  columns,
  projectStates,
  currentUserId,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onMoveCard,
  onReorderCard,
  onUpdateItem,
  isReadOnly = false,
  selectedIds = EMPTY_ARRAY,
  onToggleSelect,
  onSelectAll,
  displayOptions,
  members = EMPTY_ARRAY,
}: ListViewProps) {
  const createSubItemMutation = useCreateSubItem();
  const updateItemMutation = useUpdateItem();
  const deleteItemMutation = useDeleteItem();
  // ── Grouping definition (Guaranteed top-of-component scope) ─────────────────
  const effectiveGroupBy = displayOptions?.groupBy ?? 'state';

  // Groups with items are expanded by default (matching Plane.so behavior)
  const itemsByColumnId = useMemo(
    () => propItemsByColumnId || new Map(),
    [propItemsByColumnId]
  );
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    columns.forEach((col) => {
      const colId = resolveColumnId(col);
      const items =
        itemsByColumnId instanceof Map
          ? itemsByColumnId.get(colId) ?? []
          : (itemsByColumnId as Record<string, Item[]>)?.[colId] ?? [];
      if (items.length > 0) {
        initial.add(colId);
      }
    });
    // If all groups are empty, expand the first group
    if (initial.size === 0 && columns.length > 0) {
      initial.add(resolveColumnId(columns[0]));
    }
    return initial;
  });

  const [quickAddKey, setQuickAddKey] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [expandedChildParentIds, setExpandedChildParentIds] = useState<Set<string>>(new Set());

  const defaultUnstartedColumnId = useMemo(() => {
    if (!Array.isArray(columns) || columns.length === 0) return 'todo';
    const col =
      columns.find((c) => c.group === 'unstarted' && c.isDefault) ||
      columns.find((c) => c.group === 'unstarted') ||
      columns.find((c) => c.isDefault) ||
      columns[0];
    return col ? resolveColumnId(col) : 'todo';
  }, [columns]);

  const handleToggleExpandChildren = useCallback((itemId: string) => {
    setExpandedChildParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update expanded keys when columns or items change (auto-expand newly populated columns)
  useEffect(() => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      columns.forEach((col) => {
        const id = resolveColumnId(col);
        const items =
          itemsByColumnId instanceof Map
            ? itemsByColumnId.get(id) ?? []
            : (itemsByColumnId as Record<string, Item[]>)?.[id] ?? [];
        if (items.length > 0 && !prev.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [columns, itemsByColumnId]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const groups = useMemo(() => {
    if (!Array.isArray(columns)) return [];
    const rawGroups = columns.map((col) => {
      const colId = resolveColumnId(col);
      const colColor = col.color || col.accentColor || '#6B7280';

      return {
        key: colId,
        label: col.title || col.name || 'Backlog',
        color: colColor,
        column: {
          ...col,
          accentColor: colColor,
          color: colColor,
        },
        items:
          itemsByColumnId instanceof Map
            ? itemsByColumnId.get(colId) ?? []
            : (itemsByColumnId as Record<string, Item[]>)?.[colId] ?? [],
      };
    });

    if (displayOptions?.showEmptyGroups === false && displayOptions?.groupBy !== 'none') {
      const filtered = rawGroups.filter((g) => g.items.length > 0);
      return filtered.length > 0 ? filtered : rawGroups;
    }
    return rawGroups;
  }, [columns, itemsByColumnId, displayOptions?.showEmptyGroups, displayOptions?.groupBy]);

  const projectPrefix = useMemo(() => {
    for (const group of groups) {
      for (const item of group.items) {
        if (item.identifier && item.identifier.includes('-')) {
          return item.identifier.split('-')[0];
        }
      }
    }
    return '';
  }, [groups]);

  const isFlat = effectiveGroupBy === 'none' || (columns.length === 1 && resolveColumnId(columns[0]) === '__all__');
  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const flatItemIds = useMemo(() => flatItems.map((t) => t.id), [flatItems]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isFlatVirtualized = isFlat && flatItems.length > 30;
  const flatVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 36,
    overscan: 10,
    enabled: isFlatVirtualized,
  });

  const [flatQuickTitle, setFlatQuickTitle] = useState('');
  const flatInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (quickAddKey === '__flat__') {
      flatInputRef.current?.focus();
    }
  }, [quickAddKey]);

  const handleFlatQuickAdd = () => {
    const trimmed = flatQuickTitle.trim();
    if (!trimmed) {
      setQuickAddKey(null);
      return;
    }
    setFlatQuickTitle('');
    onAddCard(defaultUnstartedColumnId, trimmed);
  };

  const handleUpdateChildItem = useCallback(
    async (parentItem: Item, childItem: SubItem, subIndex: number, data: Partial<SubItem>) => {
      const childList: SubItem[] = (parentItem.subItems && parentItem.subItems.length > 0)
        ? [...parentItem.subItems]
        : [];

      const updated = childList.map((s, idx) => {
        if ((s.id && s.id === childItem.id) || idx === subIndex) {
          return { ...s, ...data };
        }
        return s;
      });

      onUpdateItem?.(parentItem.id, {
        subItems: updated,
      });

      if (childItem.id && !childItem.id.startsWith('sub_')) {
        if (onUpdateItem) {
          onUpdateItem(childItem.id, {
            ...(data.title !== undefined && { title: data.title }),
            ...(data.columnId !== undefined && { columnId: data.columnId }),
            ...(data.completed !== undefined && { completed: data.completed }),
          });
        } else {
          try {
            await updateItemMutation.mutateAsync({
              id: childItem.id,
              projectId,
              ...(data.title !== undefined && { title: data.title }),
              ...(data.columnId !== undefined && { columnId: data.columnId }),
              ...(data.completed !== undefined && { completed: data.completed }),
            });
          } catch {
            // Handled
          }
        }
      }
    },
    [onUpdateItem, updateItemMutation, projectId]
  );

  const handleDeleteChildItem = useCallback(
    async (parentItem: Item, childItemId: string, subIndex: number) => {
      const childList: SubItem[] = (parentItem.subItems && parentItem.subItems.length > 0)
        ? [...parentItem.subItems]
        : [];

      const updated = childList.filter((s, idx) => (s.id ? s.id !== childItemId : idx !== subIndex));

      onUpdateItem?.(parentItem.id, {
        subItems: updated,
      });

      if (childItemId && !childItemId.startsWith('sub_')) {
        if (onDeleteCard) {
          const targetChild = childList.find((s) => s.id === childItemId);
          onDeleteCard((targetChild || { id: childItemId }) as unknown as Item);
        } else {
          try {
            await deleteItemMutation.mutateAsync({ id: childItemId, projectId });
          } catch {
            // Handled
          }
        }
      }
    },
    [onUpdateItem, onDeleteCard, deleteItemMutation, projectId]
  );

  const handleAddChildItem = useCallback(
    async (parentItemId: string, title: string) => {
      if (!title.trim()) return;
      try {
        await createSubItemMutation.mutateAsync({
          id: parentItemId,
          projectId,
          title: title.trim(),
          columnId: defaultUnstartedColumnId,
        });
        setExpandedChildParentIds((prev) => new Set(prev).add(parentItemId));
      } catch {
        for (const group of groups) {
          const parent = group.items.find((t: Item) => t.id === parentItemId);
          if (parent) {
            const currentSubs = parent.subItems || [];
            const newSub: SubItem = {
              id: `sub_${Date.now()}`,
              title: title.trim(),
              columnId: defaultUnstartedColumnId,
              completed: false,
              rank: currentSubs.length,
            };
            onUpdateItem?.(parentItemId, {
              subItems: [...currentSubs, newSub],
            });
            break;
          }
        }
      }
    },
    [groups, onUpdateItem, defaultUnstartedColumnId, createSubItemMutation, projectId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current?.item as Item | undefined;
    if (item) setActiveItem(item);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (isFlat) {
      const sourceIndex = flatItems.findIndex((t) => t.id === activeId);
      const targetIndex = flatItems.findIndex((t) => t.id === overId);
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

      const draggedItem = flatItems[sourceIndex];
      const targetColId = draggedItem?.columnId || defaultUnstartedColumnId;
      onReorderCard?.(activeId, targetColId, targetIndex);
      return;
    }

    // Grouped mode:
    let sourceGroupKey = '';
    for (const g of groups) {
      if (g.items.some((item: Item) => item.id === activeId)) {
        sourceGroupKey = g.key;
        break;
      }
    }
    if (!sourceGroupKey) return;

    // Find target group and index
    let targetGroupKey = '';
    let targetIndex = 0;

    const isOverGroup = groups.some((g) => g.key === overId);
    if (isOverGroup) {
      targetGroupKey = overId;
      const targetGroup = groups.find((g) => g.key === overId);
      targetIndex = targetGroup ? targetGroup.items.length : 0;
    } else {
      for (const g of groups) {
        const idx = g.items.findIndex((item: Item) => item.id === overId);
        if (idx !== -1) {
          targetGroupKey = g.key;
          targetIndex = idx;
          break;
        }
      }
    }

    if (!targetGroupKey) return;

    // Same group reordering:
    if (sourceGroupKey === targetGroupKey) {
      const group = groups.find((g) => g.key === sourceGroupKey);
      if (!group) return;
      const sourceIndex = group.items.findIndex((item: Item) => item.id === activeId);
      if (sourceIndex === -1 || sourceIndex === targetIndex) return;

      onReorderCard?.(activeId, targetGroupKey, targetIndex);
      return;
    }

    // Cross group move:
    if (onReorderCard) {
      onReorderCard(activeId, targetGroupKey, targetIndex);
    } else {
      onMoveCard(activeId, targetGroupKey);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div ref={scrollContainerRef} className="w-full flex-1 overflow-y-auto interactive-scrollbar bg-background pb-16">
        {groups.length === 0 ? (
          <div className="w-full py-16 flex flex-col items-center justify-center text-center px-4">
            <div className="size-10 rounded-md bg-muted flex items-center justify-center text-foreground mb-3">
              <LayoutGrid className="size-5 shrink-0" />
            </div>
            <h3 className="text-16 font-semibold text-foreground mb-1">No columns configured</h3>
            <p className="text-13 text-muted-foreground max-w-xs">
              This project does not have any status columns set up yet.
            </p>
          </div>
        ) : isFlat ? (
          <div className="w-full">
            <SortableContext items={flatItemIds} strategy={verticalListSortingStrategy}>
              {isFlatVirtualized ? (
                <div
                  style={{
                    height: `${flatVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {flatVirtualizer.getVirtualItems().map((virtualRow) => {
                    const item = flatItems[virtualRow.index];
                    if (!item) return null;
                    return (
                      <div
                        key={item.id}
                        ref={flatVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <SortableItemRow
                          item={item}
                          columns={columns}
                          projectStates={projectStates}
                          isSelected={selectedIds.includes(item.id)}
                          onToggleSelect={onToggleSelect}
                          onEditCard={onEditCard}
                          onDuplicateCard={onDuplicateCard}
                          onJoinCard={onJoinCard}
                          onLeaveCard={onLeaveCard}
                          onMoveCard={onMoveCard}
                          onDeleteCard={onDeleteCard}
                          onUpdateItem={onUpdateItem}
                          displayOptions={displayOptions}
                          members={members}
                          currentUserId={currentUserId}
                          isReadOnly={isReadOnly}
                          isChildrenExpanded={expandedChildParentIds?.has(item.id)}
                          onToggleExpandChildren={handleToggleExpandChildren}
                          onUpdateChildItem={handleUpdateChildItem}
                          onDeleteChildItem={handleDeleteChildItem}
                          onAddChildItem={handleAddChildItem}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                flatItems.map((item) => (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    columns={columns}
                    projectStates={projectStates}
                    isSelected={selectedIds.includes(item.id)}
                    onToggleSelect={onToggleSelect}
                    onEditCard={onEditCard}
                    onDuplicateCard={onDuplicateCard}
                    onJoinCard={onJoinCard}
                    onLeaveCard={onLeaveCard}
                    onMoveCard={onMoveCard}
                    onDeleteCard={onDeleteCard}
                    onUpdateItem={onUpdateItem}
                    displayOptions={displayOptions}
                    members={members}
                    currentUserId={currentUserId}
                    isReadOnly={isReadOnly}
                    isChildrenExpanded={expandedChildParentIds?.has(item.id)}
                    onToggleExpandChildren={handleToggleExpandChildren}
                    onUpdateChildItem={handleUpdateChildItem}
                    onDeleteChildItem={handleDeleteChildItem}
                    onAddChildItem={handleAddChildItem}
                  />
                ))
              )}
            </SortableContext>

            {/* Quick Add at the bottom of the flat list */}
            {!isReadOnly && (
              <div>
                {quickAddKey === '__flat__' ? (
                  <div className="border-b border-border bg-background pl-6 pr-2 sm:pr-2.5 py-2">
                    <div className="h-9 flex items-center gap-2.5">
                      <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                      {projectPrefix && (
                        <span className="font-mono text-12 font-medium text-muted-foreground shrink-0 select-none tracking-tight tabular-nums">
                          {projectPrefix}
                        </span>
                      )}
                      <input
                        ref={flatInputRef}
                        type="text"
                        value={flatQuickTitle}
                        onChange={(e) => setFlatQuickTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleFlatQuickAdd();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setQuickAddKey(null);
                            setFlatQuickTitle('');
                          }
                        }}
                        onBlur={() => {
                          if (!flatQuickTitle.trim()) setQuickAddKey(null);
                        }}
                        placeholder="New work item"
                        aria-label="New work item title"
                        className="w-full bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none font-normal"
                      />
                    </div>
                    <div className="pl-6 text-11 text-muted-foreground select-none">
                      Press <kbd className="font-mono px-1 py-0.5 rounded-md bg-muted text-foreground text-10">Enter</kbd> to add another, <kbd className="font-mono px-1 py-0.5 rounded-md bg-muted text-foreground text-10">Esc</kbd> to cancel
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setQuickAddKey('__flat__')}
                    className="h-9 pl-6 pr-2 sm:pr-2.5 w-full flex items-center gap-2.5 text-13 text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer border-b border-border text-left font-normal transition-colors duration-0 focus-visible:outline-none"
                  >
                    <Plus className="size-3.5 shrink-0" />
                    <span>New work item</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          groups.map((group) => (
            <ListViewGroup
              key={group.key}
              group={group}
              columns={columns}
              projectStates={projectStates}
              isExpanded={expandedKeys.has(group.key)}
              onToggleExpand={toggleExpand}
              quickAddKey={quickAddKey}
              setQuickAddKey={setQuickAddKey}
              onAddCard={onAddCard}
              onEditCard={onEditCard}
              onDuplicateCard={onDuplicateCard}
              onJoinCard={onJoinCard}
              onLeaveCard={onLeaveCard}
              onDeleteCard={onDeleteCard}
              onMoveCard={onMoveCard}
              onUpdateItem={onUpdateItem}
              displayOptions={displayOptions}
              members={members}
              currentUserId={currentUserId}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onSelectAll={onSelectAll as (ids: string[]) => void}
              isReadOnly={isReadOnly}
              projectPrefix={projectPrefix}
              expandedChildParentIds={expandedChildParentIds}
              onToggleExpandChildren={handleToggleExpandChildren}
              onUpdateChildItem={handleUpdateChildItem}
              onDeleteChildItem={handleDeleteChildItem}
              onAddChildItem={handleAddChildItem}
            />
          ))
        )}
      </div>

      {isMounted &&
        activeItem &&
        createPortal(
          <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div className="w-[calc(100vw-32px)] max-w-3xl bg-background text-foreground border border-border rounded-md overflow-hidden opacity-95 ring-1 ring-ring">
              <ItemRow
                item={activeItem}
                columns={columns}
                projectStates={projectStates}
                currentColumn={columns.find((c) => resolveColumnId(c) === activeItem.columnId)}
                onEditCard={() => {}}
                onDuplicateCard={() => {}}
                onJoinCard={() => {}}
                onLeaveCard={() => {}}
                onDeleteCard={() => {}}
                onMoveCard={() => {}}
                displayOptions={displayOptions}
                members={members}
                isDragging={true}
              />
            </div>
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
});

export default ListView;

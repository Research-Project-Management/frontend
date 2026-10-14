'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { StatusIcon } from '@/shared/components/icons';
import { GroupCheckbox } from './GroupCheckbox';
import { SortableItemRow } from './SortableItemRow';
import type { ListViewGroupProps } from '../../../types/list-view.types';
import { EMPTY_ARRAY } from '../../../utils/list.utils';

export const ListViewGroup = ({
  group,
  columns,
  projectStates,
  isExpanded,
  onToggleExpand,
  quickAddKey,
  setQuickAddKey,
  onAddCard,
  onEditCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onDeleteCard,
  onMoveCard,
  onUpdateItem,
  displayOptions,
  members = EMPTY_ARRAY,
  currentUserId,
  currentUserAvatar,
  selectedIds = EMPTY_ARRAY,
  onToggleSelect,
  onSelectAll,
  isReadOnly = false,
  projectPrefix,
  expandedChildParentIds,
  onToggleExpandChildren,
  onUpdateChildItem,
  onDeleteChildItem,
  onAddChildItem,
}: ListViewGroupProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: group.key });
  const [quickTitle, setQuickTitle] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isAdding = quickAddKey === group.key;

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleQuickAdd = () => {
    const trimmed = quickTitle.trim();
    if (!trimmed) {
      setQuickAddKey(null);
      return;
    }
    setQuickTitle('');
    onAddCard(group.key, trimmed);
    // Keep focus for rapid sequential creation
  };

  const itemIds = useMemo(() => group.items.map((t) => t.id), [group.items]);
  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const groupItemIdsSet = useMemo(() => new Set(itemIds), [itemIds]);

  // Group Selection Checkbox Calculation
  const selectedInGroup = useMemo(() => {
    return group.items.filter((t) => selectedIdsSet.has(t.id));
  }, [group.items, selectedIdsSet]);

  const isAllGroupSelected = group.items.length > 0 && selectedInGroup.length === group.items.length;
  const isGroupIndeterminate = selectedInGroup.length > 0 && !isAllGroupSelected;

  const handleToggleGroupSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectAll) return;

    if (isAllGroupSelected) {
      // Deselect all in this group
      const remainingIds = selectedIds.filter((id: string) => !groupItemIdsSet.has(id));
      onSelectAll(remainingIds);
    } else {
      // Select all in this group
      const allIds = Array.from(new Set([...selectedIds, ...itemIds]));
      onSelectAll(allIds);
    }
  };

  return (
    <div ref={setNodeRef} className={cn('w-full', isOver && 'bg-muted')}>
      {/* Sticky Group Header Row (Keyboard Navigable & Accordion Affordance) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Group ${group.label}, ${group.items.length} work items`}
        onClick={() => onToggleExpand(group.key)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand(group.key);
          }
        }}
        className="group/header relative h-9 pl-6 pr-2 sm:pr-2.5 flex items-center justify-between border-b border-border bg-muted/50 hover:bg-muted/70 select-none cursor-pointer transition-colors duration-0 focus-visible:outline-none"
      >
        {/* Group Multi-select Checkbox (Aligned with item checkboxes at left-1.5) */}
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="absolute left-1.5 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center z-10"
        >
          <GroupCheckbox
            checked={isAllGroupSelected}
            indeterminate={isGroupIndeterminate}
            onChange={handleToggleGroupSelection}
            disabled={group.items.length === 0}
            ariaLabel={`Select all items in ${group.label}`}
          />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          {/* State Status Icon */}
          <StatusIcon
            title={group.label}
            group={group.column?.group || group.column?.slug || group.label}
            color={group.color}
            className="size-3.5 shrink-0"
          />

          {/* Group Name */}
          <span className="text-13 font-semibold text-foreground tracking-tight truncate">
            {group.label}
          </span>

          {/* Item Count (Tabular Numbers, mono pill badge) */}
          <span className="font-mono text-11 text-muted-foreground font-medium tabular-nums ml-1 px-1.5 py-0.2 rounded-md bg-background border border-border shrink-0">
            {group.items.length}
          </span>
        </div>

        {/* Quick Add Button on Header (+) */}
        {!isReadOnly && (
          <div
            className="flex items-center"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                if (!isExpanded) onToggleExpand(group.key);
                setQuickAddKey(group.key);
              }}
              className="size-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors cursor-pointer relative before:absolute before:-inset-2 md:before:hidden"
              aria-label={`Add work item to ${group.label}`}
            >
              <Plus className="size-3.5 shrink-0" />
            </button>
          </div>
        )}
      </div>

      {/* Group Items */}
      {isExpanded && (
        <div className="w-full">
          {group.items.length > 0 && (
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              {group.items.map((item) => (
                <SortableItemRow
                  key={item.id}
                  item={item}
                  columns={columns}
                  projectStates={projectStates}
                  currentColumn={group.column}
                  isSelected={selectedIdsSet.has(item.id)}
                  onToggleSelect={onToggleSelect}
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
                  currentUserAvatar={currentUserAvatar}
                  isReadOnly={isReadOnly}
                  isChildrenExpanded={expandedChildParentIds?.has(item.id)}
                  onToggleExpandChildren={onToggleExpandChildren}
                  onUpdateChildItem={onUpdateChildItem}
                  onDeleteChildItem={onDeleteChildItem}
                  onAddChildItem={onAddChildItem}
                />
              ))}
            </SortableContext>
          )}

          {/* Quick Add Form or Trigger Row */}
          {!isReadOnly && (
            <div>
              {isAdding ? (
                <div className="border-b border-border bg-background pl-6 pr-2 sm:pr-2.5 py-2">
                  <div className="h-9 flex items-center gap-2.5">
                    <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                    {projectPrefix && (
                      <span className="font-mono text-12 font-medium text-muted-foreground shrink-0 select-none tracking-tight tabular-nums">
                        {projectPrefix}
                      </span>
                    )}
                    <input
                      ref={inputRef}
                      type="text"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAdd();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setQuickAddKey(null);
                          setQuickTitle('');
                        }
                      }}
                      onBlur={() => {
                        if (!quickTitle.trim()) {
                          setQuickAddKey(null);
                        }
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
                  onClick={() => setQuickAddKey(group.key)}
                  className="h-9 pl-6 pr-2 sm:pr-2.5 w-full flex items-center gap-2.5 text-13 text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer border-b border-border text-left font-normal transition-colors duration-0 focus-visible:outline-none"
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span>New work item</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

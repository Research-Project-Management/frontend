'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Archive } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '../views/EmptyState';
import type {
  Item,
  Column,
  ProjectMember,
  DisplayOptions,
  DisplayPropertyKey,
  ItemMutationInput,
} from '../../types/work-item.types';

const BoardView = dynamic(
  () => import('../views/BoardView').then((m) => m.BoardView),
  { ssr: false }
);
const ListView = dynamic(
  () => import('../views/ListView').then((m) => m.ListView),
  { ssr: false }
);
const CalendarView = dynamic(
  () => import('../views/CalendarView').then((m) => m.CalendarView),
  { ssr: false }
);
const TableView = dynamic(
  () => import('../views/TableView').then((m) => m.TableView),
  { ssr: false }
);
const TimelineView = dynamic(
  () => import('../views/TimelineView').then((m) => m.TimelineView),
  { ssr: false }
);

import type { WorkItemViewContainerProps } from '../../types/layout.types';

export type { WorkItemViewContainerProps };

export function WorkItemViewContainer({
  viewMode,
  isArchivedEmpty,
  isProjectEmpty,
  onDisableArchived,
  onCreateItemFromEmpty,
  isReadOnly,
  projectId,
  activeFilteredItems,
  itemsByColumnId,
  visibleColumns,
  columns,
  displayOptions,
  currentUserId,
  currentUserAvatar,
  members,
  labelMap,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onOpenAddDialog,
  onOpenEditDialog,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onMoveCard,
  onReorderCard,
  onQuickUpdateItem,
  onQuickUpdateItemFromCard,
  onAssignExistingItemsToDate,
  updateDisplayProperty,
}: WorkItemViewContainerProps) {
  if (isArchivedEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center mb-4">
          <Archive className="w-8 h-8 text-foreground shrink-0" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          No archived work items
        </h3>
        <p className="text-sm text-foreground/70 max-w-sm mb-6">
          When work items are archived, they will appear here safely stored away from active views.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onDisableArchived}
          className="gap-2 rounded-md h-8 px-3 text-13 font-medium bg-background border border-border text-foreground hover:bg-muted shadow-none cursor-pointer"
        >
          <span>Back to active items</span>
        </Button>
      </div>
    );
  }

  if (isProjectEmpty && viewMode !== 'calendar') {
    return (
      <EmptyState
        onCreateItem={onCreateItemFromEmpty}
        isReadOnly={isReadOnly}
      />
    );
  }

  return (
    <>
      {viewMode === 'list' && (
        <ListView
          projectId={projectId}
          itemsByColumnId={itemsByColumnId}
          columns={visibleColumns}
          projectStates={columns}
          currentUserId={currentUserId}
          currentUserAvatar={currentUserAvatar}
          onAddCard={onOpenAddDialog}
          onEditCard={onOpenEditDialog}
          onDeleteCard={onDeleteCard}
          onDuplicateCard={onDuplicateCard}
          onJoinCard={onJoinCard}
          onLeaveCard={onLeaveCard}
          onMoveCard={onMoveCard}
          onReorderCard={onReorderCard}
          onUpdateItem={onQuickUpdateItem}
          isReadOnly={isReadOnly}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onSelectAll={onSelectAll}
          displayOptions={displayOptions}
          members={members}
        />
      )}
      {viewMode === 'calendar' && (
        <CalendarView
          items={activeFilteredItems}
          columns={columns}
          projectId={projectId}
          onAddCard={onOpenAddDialog}
          onOpenCardDetail={onOpenEditDialog}
          onAssignExistingItems={onAssignExistingItemsToDate}
          isReadOnly={isReadOnly}
        />
      )}
      {viewMode === 'table' && (
        <TableView
          items={activeFilteredItems}
          itemsByColumnId={itemsByColumnId}
          columns={visibleColumns}
          projectStates={columns}
          displayOptions={displayOptions}
          currentUserId={currentUserId}
          currentUserAvatar={currentUserAvatar}
          projectId={projectId}
          members={members}
          onAddCard={onOpenAddDialog}
          onEditCard={onOpenEditDialog}
          onDeleteCard={onDeleteCard}
          onDuplicateCard={onDuplicateCard}
          onJoinCard={onJoinCard}
          onLeaveCard={onLeaveCard}
          onMoveCard={onMoveCard}
          onUpdateCard={onQuickUpdateItemFromCard}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onSelectAll={onSelectAll}
          isReadOnly={isReadOnly}
          onToggleDisplayProperty={updateDisplayProperty}
        />
      )}
      {viewMode === 'timeline' && (
        <TimelineView
          items={activeFilteredItems}
          columns={columns}
          projectStates={columns}
          displayOptions={displayOptions}
          currentUserId={currentUserId}
          currentUserAvatar={currentUserAvatar}
          projectId={projectId}
          members={members}
          onAddCard={onOpenAddDialog}
          onEditCard={onOpenEditDialog}
          onDeleteCard={onDeleteCard}
          onDuplicateCard={onDuplicateCard}
          onJoinCard={onJoinCard}
          onLeaveCard={onLeaveCard}
          onMoveCard={onMoveCard}
          onUpdateCard={onQuickUpdateItemFromCard}
          isReadOnly={isReadOnly}
        />
      )}
      {(viewMode === 'board' || !['list', 'calendar', 'table', 'timeline'].includes(viewMode)) && (
        <BoardView
          items={activeFilteredItems}
          itemsByColumnId={itemsByColumnId}
          columns={visibleColumns}
          projectStates={columns}
          labelMap={labelMap}
          currentUserId={currentUserId}
          currentUserAvatar={currentUserAvatar}
          members={members}
          onAddCard={onOpenAddDialog}
          onEditCard={onOpenEditDialog}
          onDeleteCard={onDeleteCard}
          onDuplicateCard={onDuplicateCard}
          onJoinCard={onJoinCard}
          onLeaveCard={onLeaveCard}
          onMoveCard={onMoveCard}
          onReorderCard={onReorderCard}
          isReadOnly={isReadOnly}
          displayOptions={displayOptions}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onUpdateItem={onQuickUpdateItem}
        />
      )}
    </>
  );
}

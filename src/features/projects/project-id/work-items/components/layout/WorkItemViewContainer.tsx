'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Archive } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/features/projects/project-id/work-items/components/views/EmptyState';
import { BoardView } from '@/features/projects/project-id/work-items/components/views/BoardView';
import { ListView } from '@/features/projects/project-id/work-items/components/views/ListView';
import { TableView } from '@/features/projects/project-id/work-items/components/views/TableView';
import {
  WorkspaceRowListSkeleton,
  WorkspaceViewTransition,
} from '@/shared/components/layout/WorkspaceSkeleton';

const ViewFallback = () => <WorkspaceRowListSkeleton variant="work-items" rows={10} />;

const CalendarView = dynamic(
  () => import('@/features/projects/project-id/work-items/components/views/CalendarView').then((m) => m.CalendarView),
  { ssr: false, loading: ViewFallback }
);
const TimelineView = dynamic(
  () => import('@/features/projects/project-id/work-items/components/views/TimelineView').then((m) => m.TimelineView),
  { ssr: false, loading: ViewFallback }
);

import type { WorkItemViewContainerProps } from '@/features/projects/project-id/work-items/types/layout.types';

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
    <WorkspaceViewTransition className="flex-1 flex flex-col min-h-0">
      {viewMode === 'list' && (
        <ListView
          projectId={projectId}
          itemsByColumnId={itemsByColumnId}
          columns={visibleColumns}
          projectStates={columns}
          currentUserId={currentUserId}
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
    </WorkspaceViewTransition>
  );
}

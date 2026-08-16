'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Minimize2, Maximize2 } from 'lucide-react';
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui';
import { Card, type TaskCardLabel } from './Card';
import type { Task, Column as ColumnType } from '../../types/task.types';
import { resolveTaskColumnColor, resolveTaskColumnId } from '../../types/task.types';

export interface ColumnProps {
  column: ColumnType;
  cards: Task[];
  labelMap?: Map<string, TaskCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onAdd: (columnId: string, title?: string) => void;
  onEditCard?: (card: Task) => void;
  onDeleteCard?: (card: Task) => void;
  onDuplicateCard?: (card: Task) => void;
  onJoinCard?: (card: Task) => void;
  onLeaveCard?: (card: Task) => void;
  onRemoveFromCycle?: (card: Task) => void;
  onAddDisabled?: boolean;
  isReadOnly?: boolean;
}

export function Column({
  column,
  cards,
  labelMap,
  currentUserId,
  currentUserAvatar,
  onAdd,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onRemoveFromCycle,
  onAddDisabled,
  isReadOnly = false,
}: ColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);

  const columnId = resolveTaskColumnId(column);
  const columnColor = resolveTaskColumnColor(columnId, column.accentColor);
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  const cardIds = useMemo(() => cards.map((card) => card._id), [cards]);

  useEffect(() => {
    if (isQuickAddOpen) {
      quickAddInputRef.current?.focus();
    }
  }, [isQuickAddOpen]);

  const handleOpenQuickAdd = () => {
    setIsQuickAddOpen(true);
  };

  const handleCloseQuickAdd = () => {
    setIsQuickAddOpen(false);
    setQuickAddTitle('');
  };

  const handleQuickAddSubmit = () => {
    const trimmedTitle = quickAddTitle.trim();
    if (!trimmedTitle) return;
    setQuickAddTitle('');
    setIsQuickAddOpen(false);
    onAdd(columnId, trimmedTitle);
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center w-10 shrink-0 bg-muted/40 border border-border/50 rounded-lg py-3 gap-2.5">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: columnColor }}
        />
        <span
          className="text-[13px] font-semibold text-foreground max-h-36 overflow-hidden"
          style={{ writingMode: 'vertical-lr' }}
        >
          {column.title}
        </span>
        <span
          className="text-[12px] text-muted-foreground"
          style={{ writingMode: 'vertical-lr', textOrientation: 'upright' }}
        >
          {cards.length}
        </span>

        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-foreground hover:bg-muted shrink-0 cursor-pointer"
                onClick={() => setIsCollapsed(false)}
                aria-label="Expand column"
              >
                <Maximize2 className="h-3.5 w-3.5 text-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              Expand column
            </TooltipContent>
          </Tooltip>

          {!isReadOnly && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-foreground hover:bg-muted shrink-0 cursor-pointer"
                  onClick={() => {
                    setIsCollapsed(false);
                    handleOpenQuickAdd();
                  }}
                  aria-label="Add card"
                >
                  <Plus className="h-4 w-4 text-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                Add card
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 shrink-0 bg-muted/40 border border-border/50 rounded-lg p-2.5 transition-colors h-full max-h-full ${
        isOver ? 'bg-primary/5 ring-2 ring-primary/30 border-primary/40' : ''
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: columnColor }}
          />
          <h3 className="font-semibold text-[14px] text-foreground tracking-tight truncate">
            {column.title}
          </h3>
          <span className="text-[12px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
            {cards.length}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isReadOnly && !onAddDisabled && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-foreground hover:bg-muted cursor-pointer"
                    onClick={handleOpenQuickAdd}
                    aria-label="Add card"
                  >
                    <Plus className="h-4 w-4 text-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Add card
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-foreground hover:bg-muted cursor-pointer"
                  onClick={() => setIsCollapsed(true)}
                  aria-label="Collapse column"
                >
                  <Minimize2 className="h-3.5 w-3.5 text-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                Collapse column
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Quick Add Inline Card Form */}
      {isQuickAddOpen && (
        <div className="mb-2 bg-card p-2.5 rounded-lg border border-border/80">
          <input
            ref={quickAddInputRef}
            type="text"
            value={quickAddTitle}
            onChange={(e) => setQuickAddTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickAddSubmit();
              if (e.key === 'Escape') handleCloseQuickAdd();
            }}
            placeholder="Enter a title for this card..."
            className="w-full text-xs border-none bg-transparent outline-none p-0 text-foreground placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-1.5 mt-2">
            <Button
              size="sm"
              className="h-7 px-3 text-xs bg-[#0070f3] hover:bg-[#0060df] text-white rounded-md cursor-pointer"
              onClick={handleQuickAddSubmit}
            >
              Add Card
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs rounded-md cursor-pointer"
              onClick={handleCloseQuickAdd}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Draggable Cards List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <Card
              key={card._id}
              card={card}
              labelMap={labelMap}
              currentUserId={currentUserId}
              currentUserAvatar={currentUserAvatar}
              onEdit={onEditCard}
              onDelete={onDeleteCard}
              onDuplicate={onDuplicateCard}
              onJoin={onJoinCard}
              onLeave={onLeaveCard}
              onRemoveFromCycle={onRemoveFromCycle}
              isReadOnly={isReadOnly}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default Column;

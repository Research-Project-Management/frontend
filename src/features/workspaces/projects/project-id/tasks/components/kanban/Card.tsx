'use client';

import React from 'react';
import {
  MoreHorizontal,
  Copy,
  UserPlus,
  UserMinus,
  RotateCcw,
  Trash2,
  Check,
} from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/shared/lib/utils';
import type { Task } from '../../types/task.types';

import { useCard, type TaskCardLabel } from '../../hooks/use-kanban';

export type { TaskCardLabel };

export interface CardProps {
  card: Task;
  labelMap?: Map<string, TaskCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onEdit?: (card: Task) => void;
  onDuplicate?: (card: Task) => void;
  onDelete?: (card: Task) => void;
  onJoin?: (card: Task) => void;
  onLeave?: (card: Task) => void;
  onRemoveFromCycle?: (card: Task) => void;
  isReadOnly?: boolean;
  isDragging?: boolean;
}

export function CardUI({
  card,
  labelMap,
  currentUserId,
  currentUserAvatar,
  onEdit,
  onDuplicate,
  onDelete,
  onJoin,
  onLeave,
  onRemoveFromCycle,
  isReadOnly = false,
  isDragging = false,
}: CardProps) {
  const { state, actions } = useCard({
    card,
    labelMap,
    currentUserId,
    currentUserAvatar,
    onEdit,
    onDuplicate,
    onDelete,
    onJoin,
    onLeave,
    onRemoveFromCycle,
    isReadOnly,
  });

  const {
    dates,
    labels,
    assignee,
    metadataItems,
    showLabelDetails,
  } = state;

  const {
    toggleLabelDetails,
    duplicate,
    remove,
    join,
    leave,
    removeFromCycle,
    edit,
  } = actions;

  const isDone = card.columnId === 'done';

  return (
    <div
      onClick={() => edit()}
      className={cn(
        "group relative min-w-0 rounded-lg border border-border/70 bg-card px-3.5 py-3 transition-colors hover:border-border cursor-pointer",
        isDragging && "opacity-40 border-primary"
      )}
    >
      {!isReadOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2.5 top-2.5 z-10 h-6 w-6 shrink-0 text-foreground opacity-0 transition-all hover:bg-muted focus-visible:opacity-100 data-[state=open]:opacity-100 group-hover:opacity-100 cursor-pointer outline-none"
              aria-label="More task actions"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4 text-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-40"
            onCloseAutoFocus={(event) => event.preventDefault()}
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenuItem
              disabled={card.permissions?.canDuplicate === false}
              onClick={(event) => {
                event.stopPropagation();
                duplicate();
              }}
            >
              <Copy className="mr-2 h-4 w-4 text-foreground" />
              <span className="text-foreground">Duplicate</span>
            </DropdownMenuItem>

            {currentUserId && onJoin && onLeave && (
              <DropdownMenuItem
                disabled={card.permissions?.canEdit === false}
                onClick={(event) => {
                  event.stopPropagation();
                  if (assignee.isCurrentUser) {
                    leave();
                  } else {
                    join();
                  }
                }}
              >
                {assignee.isCurrentUser ? (
                  <UserMinus className="mr-3 h-4 w-4 text-foreground" />
                ) : (
                  <UserPlus className="mr-3 h-4 w-4 text-foreground" />
                )}
                <span className="text-foreground">{assignee.isCurrentUser ? 'Leave' : 'Join'}</span>
              </DropdownMenuItem>
            )}

            {onRemoveFromCycle && (
              <DropdownMenuItem
                disabled={card.permissions?.canEdit === false}
                onClick={(event) => {
                  event.stopPropagation();
                  removeFromCycle();
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4 text-foreground" />
                <span className="text-foreground">Remove from cycle</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              disabled={card.permissions?.canDelete === false}
              onClick={(event) => {
                event.stopPropagation();
                remove();
              }}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {labels.length > 0 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleLabelDetails();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          className="mb-2 flex w-full flex-wrap items-center gap-1.5 pl-0.5 pr-8 text-left cursor-pointer"
          aria-label="Toggle label details display"
        >
          {labels.map((label) => {
            const hasTitle = label.title.trim().length > 0;
            return showLabelDetails ? (
              <span
                key={label.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.title}
              </span>
            ) : (
              <span
                key={label.id}
                className="inline-flex h-2.5 w-11 rounded-full transition-all duration-200"
                style={{ backgroundColor: label.color }}
                title={hasTitle ? label.title : 'Label'}
              />
            );
          })}
        </button>
      ) : null}

      {/* Task Title */}
      <div className="flex items-start gap-1.5">
        {isDone && (
          <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="size-2.5 stroke-3" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {card.identifier && (
            <span className="mb-0.5 block text-[11px] font-semibold text-muted-foreground tracking-tight">
              {card.identifier}
            </span>
          )}
          <h4
            className={`min-w-0 flex-1 wrap-break-word text-[14px] font-medium leading-5 tracking-tight pr-6 ${
              isDone ? 'text-muted-foreground line-through' : 'text-foreground'
            }`}
          >
            {card.title}
          </h4>
        </div>
      </div>

      {/* Metadata Footers */}
      {(metadataItems.length > 0 || assignee.user) && (
        <div className="mt-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            {metadataItems.map((item) => {
              const Icon = item.icon;
              const hoverText = item.text ? `${item.label}: ${item.text}` : item.label;
              const hasText = item.text.trim().length > 0;
              const isOverdueBadge = item.key === 'due-date' && dates.isOverdue && hasText;

              if (isOverdueBadge) {
                return (
                  <div
                    key={item.key}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-sm bg-[#c9372c] px-2 py-1 text-[12px] font-semibold text-white"
                    title={hoverText}
                    aria-label={hoverText}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="max-w-32 truncate whitespace-nowrap">{item.text}</span>
                  </div>
                );
              }

              return (
                <div
                  key={item.key}
                  className={
                    hasText
                      ? 'inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground'
                      : 'inline-flex size-5 items-center justify-center text-foreground'
                  }
                  title={hoverText}
                  aria-label={hoverText}
                >
                  <Icon className="size-3.5 shrink-0 text-foreground" />
                  {hasText && (
                    <span className="max-w-32 truncate whitespace-nowrap text-foreground">{item.text}</span>
                  )}
                </div>
              );
            })}
          </div>

          {assignee.user && (
            <div className="shrink-0" title={assignee.user.name}>
              <Avatar className="size-5 border border-border/80 bg-background text-[10px] font-bold text-foreground">
                {assignee.avatar ? (
                  <AvatarImage src={assignee.avatar} alt={assignee.user.name} />
                ) : null}
                <AvatarFallback>{assignee.initials || 'U'}</AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Card({
  card,
  labelMap,
  currentUserId,
  currentUserAvatar,
  onEdit,
  onDuplicate,
  onDelete,
  onJoin,
  onLeave,
  onRemoveFromCycle,
  isReadOnly = false,
}: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card._id,
    disabled: isReadOnly,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    cursor: isReadOnly ? 'default' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onEdit?.(card)}
      className="outline-none"
    >
      <CardUI
        card={card}
        labelMap={labelMap}
        currentUserId={currentUserId}
        currentUserAvatar={currentUserAvatar}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onJoin={onJoin}
        onLeave={onLeave}
        onRemoveFromCycle={onRemoveFromCycle}
        isReadOnly={isReadOnly}
        isDragging={isDragging}
      />
    </div>
  );
}

export default Card;

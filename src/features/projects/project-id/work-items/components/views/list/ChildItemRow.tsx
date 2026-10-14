'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { CornerDownRight, Check, Trash2, Plus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { StatusIcon } from '@/shared/components/icons';
import { resolveColumnId } from '../../../utils/work-item.utils';
import type { Item, Column } from '../../../types/work-item.types';
import type { ChildItemRowProps } from '../../../types/list-view.types';

export const ChildItemRow = ({
  childItem,
  parentItem,
  index,
  columns,
  projectStates,
  members = [],
  isReadOnly = false,
  onEditCard,
  onUpdateChildItem,
  onDeleteChildItem,
}: ChildItemRowProps) => {
  const child = childItem as typeof childItem & { stateGroup?: string; state?: { group?: string } };
  const isDone = Boolean(child.completed || child.stateGroup === 'completed' || child.state?.group === 'completed' || child.columnId === 'done' || child.columnId === 'completed');
  const isCancelled = Boolean(child.stateGroup === 'cancelled' || child.state?.group === 'cancelled' || child.columnId === 'cancelled');
  const stateList = projectStates && projectStates.length > 0 ? projectStates : columns;
  const currentCol = stateList.find((c) => resolveColumnId(c) === childItem.columnId);
  const colTitle = currentCol?.title || currentCol?.name || childItem.columnId || 'Todo';
  const colColor = currentCol?.accentColor || currentCol?.color || (isDone ? '#1A7F37' : '#6B7280');

  const defaultUnstartedId = useMemo(() => {
    if (!Array.isArray(stateList) || stateList.length === 0) return 'todo';
    const col =
      stateList.find((c) => c.group === 'unstarted' && c.isDefault) ||
      stateList.find((c) => c.group === 'unstarted') ||
      stateList.find((c) => c.isDefault) ||
      stateList[0];
    return col ? resolveColumnId(col) : 'todo';
  }, [stateList]);

  const defaultCompletedId = useMemo(() => {
    if (!Array.isArray(stateList) || stateList.length === 0) return 'done';
    const col =
      stateList.find((c) => c.group === 'completed') ||
      stateList[stateList.length - 1];
    return col ? resolveColumnId(col) : 'done';
  }, [stateList]);

  const subAssignee = useMemo(() => {
    if (childItem.assignee) return childItem.assignee;
    if (childItem.assigneeId && Array.isArray(members)) {
      const found = members.find((m: { id?: string; userId?: string; user?: { id?: string } }) => (m.userId || m.user?.id || m.id) === childItem.assigneeId);
      if (found) {
        return {
          id: childItem.assigneeId,
          name: found.name || found.user?.name || 'Assignee',
          avatar: found.avatar || found.user?.avatar || undefined,
        };
      }
    }
    return null;
  }, [childItem.assignee, childItem.assigneeId, members]);

  return (
    <div className="group/sub relative h-7.5 pl-12 sm:pl-14 pr-2 sm:pr-2.5 flex items-center justify-between hover:bg-muted/50 select-none text-12 transition-colors duration-0 border-b border-border">
      {/* Left Tree Branch & Checkbox & Title */}
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
        <CornerDownRight className="size-3 text-foreground shrink-0 -ml-5" />

        <button
          type="button"
          disabled={isReadOnly}
          onClick={(e) => {
            e.stopPropagation();
            onUpdateChildItem?.(parentItem, childItem, index, {
              completed: !isDone,
              columnId: !isDone ? defaultCompletedId : defaultUnstartedId,
            });
          }}
          aria-label={`Mark sub-item as ${isDone ? 'incomplete' : 'complete'}`}
          className={cn(
            'size-3.5 rounded-sm border flex items-center justify-center transition-colors cursor-pointer shrink-0',
            isDone
              ? 'bg-foreground border-foreground text-background'
              : 'border-border hover:border-foreground'
          )}
        >
          {isDone && <Check className="size-2.5 shrink-0 stroke-[3]" />}
        </button>

        {childItem.identifier && (
          <span className="font-mono text-11 font-medium text-muted-foreground shrink-0 tabular-nums">
            {childItem.identifier}
          </span>
        )}

        <span
          role="button"
          tabIndex={0}
          onClick={() => {
            onEditCard({
              ...parentItem,
              id: childItem.id,
              title: childItem.title,
              columnId: childItem.columnId || defaultUnstartedId,
              completed: isDone,
              parentId: parentItem.id,
            } as Item);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onEditCard({
                ...parentItem,
                id: childItem.id,
                title: childItem.title,
                columnId: childItem.columnId || defaultUnstartedId,
                completed: isDone,
                parentId: parentItem.id,
              } as Item);
            }
          }}
          className={cn(
            'truncate cursor-pointer transition-colors text-12 font-normal',
            isCancelled ? 'line-through text-muted-foreground' : isDone ? 'text-muted-foreground' : 'text-foreground'
          )}
          title={childItem.title}
        >
          {childItem.title}
        </span>
      </div>

      {/* Right Properties: Status dropdown + Delete action */}
      <div className="flex items-center gap-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={isReadOnly}>
            <button
              type="button"
              className="h-5 px-2 text-11 font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1 shrink-0 transition-colors cursor-pointer outline-none"
            >
              <StatusIcon
                title={colTitle}
                group={currentCol?.group || currentCol?.slug || colTitle}
                color={colColor}
                className="size-2.5 shrink-0"
              />
              <span className="truncate max-w-[65px]">{colTitle}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 p-1 text-xs z-100 rounded-md shadow-overlay">
            {stateList.map((col) => {
              const cId = resolveColumnId(col);
              const cTitle = col.title || col.name || 'Column';
              const cColor = col.color || col.accentColor || '#6B7280';
              const isCurr = cId === childItem.columnId;
              return (
                <DropdownMenuItem
                  key={cId}
                  onClick={() => {
                    const completed = col.group === 'completed' || cId === 'done' || cId === 'completed';
                    onUpdateChildItem?.(parentItem, childItem, index, { columnId: cId, completed });
                  }}
                  className={cn('gap-2 py-1 cursor-pointer text-11 rounded-md', isCurr && 'font-medium bg-muted')}
                >
                  <StatusIcon
                    id={cId}
                    title={cTitle}
                    group={col.group || col.slug || cTitle}
                    color={cColor}
                    className="size-3 shrink-0"
                  />
                  <span>{cTitle}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {subAssignee && (
          <div
            className="size-4.5 rounded-full overflow-hidden border border-border flex items-center justify-center shrink-0"
            title={subAssignee.name || 'Assignee'}
          >
            <Avatar className="size-full">
              <AvatarImage src={subAssignee.avatar || undefined} alt={subAssignee.name || 'Assignee'} />
              <AvatarFallback className="text-9 font-medium bg-muted text-foreground">
                {(subAssignee.name || 'U').slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        {!isReadOnly && onDeleteChildItem && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteChildItem(parentItem, childItem.id, index);
            }}
            aria-label="Delete sub-item"
            className="opacity-0 group-hover/sub:opacity-100 size-5 rounded-md flex items-center justify-center text-foreground hover:bg-muted transition-all cursor-pointer"
          >
            <Trash2 className="size-3 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
};

export const ChildItemQuickAdd = ({
  parentItem,
  onAddChildItem,
}: {
  parentItem: Item;
  onAddChildItem: (parentItemId: string, title: string) => void;
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleSubmit = () => {
    if (title.trim()) {
      onAddChildItem(parentItem.id, title.trim());
      setTitle('');
    }
  };

  return (
    <div className="pl-12 sm:pl-14 pr-2 sm:pr-2.5 h-8 flex items-center border-b border-border bg-background/50">
      {isAdding ? (
        <div className="flex items-center gap-2 w-full">
          <CornerDownRight className="size-3 text-foreground shrink-0 -ml-5" />
          <input
            ref={inputRef}
            type="text"
            value={title}
            aria-label="Sub-item title"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              } else if (e.key === 'Escape') {
                setIsAdding(false);
                setTitle('');
              }
            }}
            onBlur={() => {
              if (!title.trim()) setIsAdding(false);
            }}
            placeholder="Sub-item title... (Enter to save, Esc to cancel)"
            className="w-full bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none font-normal"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 text-11 text-foreground hover:bg-muted px-1.5 py-0.5 rounded transition-colors cursor-pointer -ml-5"
        >
          <Plus className="size-3" />
          <span>Add sub-item</span>
        </button>
      )}
    </div>
  );
};

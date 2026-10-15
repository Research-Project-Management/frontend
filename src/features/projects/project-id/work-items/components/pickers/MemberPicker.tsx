'use client';

import React, { useState, useMemo } from 'react';
import { Users, Search, Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import { ItemHelpers } from '@/features/projects/project-id/work-items/utils/work-item.utils';
import type { ProjectMember } from '@/features/projects/project-id/work-items/types/work-item.types';

export function AssigneeUserIcon({ className }: { className?: string }) {
  return <Users className={cn('size-3.5 shrink-0 text-foreground', className)} />;
}

export function AvatarStack({
  users,
  max = 3,
  size = 'sm',
  className,
}: {
  users: Array<{ id?: string; name?: string | null; avatar?: string | null }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  if (!users || users.length === 0) return null;

  const sizeClass = size === 'xs' ? 'size-4 text-9' : size === 'md' ? 'size-6 text-11' : 'size-5 text-10';
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className={cn('flex items-center -space-x-1.5 overflow-hidden', className)}>
      {visible.map((u, i) => {
        const name = u.name || 'Member';
        const initials = ItemHelpers.getInitials(name);
        return (
          <Avatar
            key={u.id || i}
            className={cn(sizeClass, 'ring-1.5 ring-background shrink-0 select-none')}
            title={name}
          >
            <AvatarImage src={u.avatar || undefined} alt={name} />
            <AvatarFallback className="bg-muted font-medium text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        );
      })}
      {remaining > 0 && (
        <span
          className={cn(
            sizeClass,
            'flex items-center justify-center rounded-full bg-muted text-foreground font-mono font-medium ring-1.5 ring-background shrink-0 select-none'
          )}
          title={`${remaining} more members`}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}

import type { MemberPopoverProps } from '@/features/projects/project-id/work-items/types/picker.types';

export type { MemberPopoverProps };

export function MemberPopover({
  open,
  onOpenChange,
  assigneeId,
  setAssigneeId,
  assigneeIds,
  setAssigneeIds,
  members,
  actionBtnClass,
  triggerLabel = 'Assignees',
  isMulti = false,
  disabled = false,
  isReadOnly = false,
}: MemberPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const activeIds = useMemo<string[]>(() => {
    if (assigneeIds && Array.isArray(assigneeIds)) return assigneeIds;
    if (assigneeId) return [assigneeId];
    return [];
  }, [assigneeIds, assigneeId]);

  const selectedMembers = useMemo(() => {
    return activeIds
      .map((id) => {
        const m = (members || []).find((mem: unknown) => {
          const item = mem as { user?: { id?: string; name?: string; avatar?: string }; userId?: string; id?: string; name?: string; avatar?: string };
          return (item.user?.id || item.userId || item.id) === id;
        }) as { user?: { id?: string; name?: string; avatar?: string }; userId?: string; id?: string; name?: string; avatar?: string } | undefined;
        return m
          ? {
              id,
              name: m.user?.name || m.name || 'Member',
              avatar: m.user?.avatar || m.avatar,
            }
          : null;
      })
      .filter(Boolean) as Array<{ id: string; name: string; avatar?: string | null }>;
  }, [activeIds, members]);

  const filteredMembers = useMemo(() => {
    return members.filter((member: ProjectMember) => {
      const name = member.user?.name || member.name || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [members, searchQuery]);

  const handleToggleMember = (memberUserId: string) => {
    const isCurrentlySelected = activeIds.includes(memberUserId);
    if (isMulti || setAssigneeIds) {
      const nextIds = isCurrentlySelected
        ? activeIds.filter((id) => id !== memberUserId)
        : [...activeIds, memberUserId];
      setAssigneeIds?.(nextIds);
      if (setAssigneeId) {
        setAssigneeId(nextIds[0] ?? null);
      }
    } else {
      setAssigneeId?.(isCurrentlySelected ? null : memberUserId);
      onOpenChange(false);
    }
  };

  const handleClearAll = () => {
    setAssigneeIds?.([]);
    setAssigneeId?.(null);
    if (!isMulti && !setAssigneeIds) {
      onOpenChange(false);
    }
  };

  const isDisabled = disabled || isReadOnly;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isDisabled}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-medium rounded-md border border-border bg-muted hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0 relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring',
            actionBtnClass,
            open && 'bg-muted border-border',
            selectedMembers.length > 0 && 'font-medium'
          )}
        >
          {selectedMembers.length > 1 ? (
            <div className="flex items-center gap-1.5">
              <AvatarStack users={selectedMembers} size="xs" max={3} />
              <span className="text-11 text-foreground">{selectedMembers.length} assignees</span>
            </div>
          ) : selectedMembers.length === 1 ? (
            <>
              <Avatar className="size-3.5 shrink-0">
                <AvatarImage src={selectedMembers[0].avatar || undefined} />
                <AvatarFallback className="text-9">
                  {selectedMembers[0].name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[100px]">{selectedMembers[0].name}</span>
            </>
          ) : (
            <>
              <AssigneeUserIcon />
              <span>{triggerLabel}</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-64 p-1.5 rounded-md border border-border bg-popover shadow-overlay z-100 flex flex-col"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search members..."
            aria-label="Search members"
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            autoFocus
          />
        </div>
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {activeIds.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left text-foreground"
            >
              <span>Unassign all</span>
            </button>
          )}
          {filteredMembers.length === 0 ? (
            <div className="py-2.5 text-center text-xs text-muted-foreground">
              No members found
            </div>
          ) : (
            filteredMembers.map((member: ProjectMember, idx: number) => {
              const memberUserId = member.user?.id || member.userId || member.id || `member-${idx}`;
              const userName = member.user?.name || member.name || 'Member';
              const userAvatar = member.user?.avatar || member.avatar;
              const fallbackInitials = userName.charAt(0).toUpperCase();
              const isSelected = activeIds.includes(memberUserId);

              return (
                <button
                  key={memberUserId}
                  type="button"
                  onClick={() => handleToggleMember(memberUserId)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left',
                    isSelected && 'bg-muted text-foreground font-medium'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Avatar className="size-5 shrink-0">
                      <AvatarImage src={userAvatar || undefined} />
                      <AvatarFallback className="text-10 font-medium">{fallbackInitials}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{userName}</span>
                  </div>
                  {isSelected && <Check className="size-4 shrink-0 text-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const MemberPicker = MemberPopover;
export const AssigneePicker = MemberPopover;

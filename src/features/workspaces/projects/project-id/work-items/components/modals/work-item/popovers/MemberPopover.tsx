'use client';

import React, { useState, useMemo } from 'react';
import { UserPlus, X, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';

export interface MemberPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigneeId: string | null;
  setAssigneeId: (id: string | null) => void;
  members: any[];
  actionBtnClass?: string;
}

export function MemberPopover({
  open,
  onOpenChange,
  assigneeId,
  setAssigneeId,
  members,
  actionBtnClass,
}: MemberPopoverProps) {
  const [search, setSearch] = useState('');

  const filteredMembers = useMemo(() => {
    return members.filter((m: any) => {
      const name = m.user?.name || m.name || '';
      return name.toLowerCase().includes(search.toLowerCase());
    });
  }, [members, search]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-medium rounded-md border border-border bg-muted hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0',
            actionBtnClass,
            open && 'bg-muted border-border'
          )}
        >
          <UserPlus className="size-3.5 shrink-0 text-muted-foreground" />
          <span>Members</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={16}
        className="w-72 rounded-md p-0 shadow-sm border border-border flex flex-col z-100 bg-popover max-h-[min(480px,calc(100vh-80px))] overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-center flex-1 text-foreground">Members</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-foreground hover:bg-muted cursor-pointer rounded-md"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4 shrink-0 text-foreground" />
          </Button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Input
              placeholder="Search members"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs pr-8 rounded-md border-border"
            />
          </div>
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">
              Board members
            </h4>
            <div className="space-y-1">
              {filteredMembers.map((m: any) => {
                const memberUserId = m.user?.id || m.userId || m.id;
                const uName = m.user?.name || m.name || 'Member';
                const uAvatar = m.user?.avatar || m.avatar;
                const fallback = uName.charAt(0).toUpperCase();

                return (
                  <button
                    key={memberUserId}
                    onClick={() => {
                      setAssigneeId(memberUserId === assigneeId ? null : memberUserId);
                      onOpenChange(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-2 py-1.5 rounded-sm transition-colors hover:bg-muted text-left cursor-pointer',
                      assigneeId === memberUserId && 'bg-muted font-medium text-foreground',
                    )}
                  >
                    <Avatar className="size-6 shrink-0">
                      <AvatarImage src={uAvatar} />
                      <AvatarFallback className="text-xs font-medium">{fallback}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{uName}</span>
                    {assigneeId === memberUserId && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MemberPopover;

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
          className={
            open
              ? 'h-10 rounded-sm border border-border bg-muted px-4 text-base font-medium text-foreground shadow-none'
              : actionBtnClass
          }
        >
          <UserPlus className="mr-2 h-4 w-4 text-foreground shrink-0" />
          <span>Members</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={-14}
        className="w-72 rounded-sm p-0 border-border flex flex-col z-100"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-center flex-1 text-foreground">Members</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-foreground hover:bg-muted cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 text-foreground shrink-0" />
          </Button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Input
              placeholder="Search members"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pr-8"
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
                      'w-full flex items-center gap-3 px-2 py-1.5 rounded-md transition-colors hover:bg-muted text-left cursor-pointer',
                      assigneeId === memberUserId && 'bg-muted ring-1 ring-border',
                    )}
                  >
                    <Avatar className="size-6">
                      <AvatarImage src={uAvatar} />
                      <AvatarFallback className="text-xs font-medium">{fallback}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{uName}</span>
                    {assigneeId === memberUserId && <Check className="size-4 text-foreground shrink-0" />}
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

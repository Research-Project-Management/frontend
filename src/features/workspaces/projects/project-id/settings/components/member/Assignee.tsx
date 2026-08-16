'use client';

import React, { useState } from 'react';
import { User as UserIcon, ChevronDown, Check, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Input,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { ProjectMemberItem } from '../../types/member.types';

interface AssigneeProps {
  members: ProjectMemberItem[];
  defaultAssigneeId: string | null;
  onSelect: (userId: string | null) => void;
  disabled?: boolean;
}

export function Assignee({
  members,
  defaultAssigneeId,
  onSelect,
  disabled,
}: AssigneeProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = members.find((m) => m.userId === defaultAssigneeId);

  const filtered = members.filter((m) =>
    m.user.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.user.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Default assignee</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select the default assignee for the project.
        </p>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'w-full sm:w-72 h-9 flex items-center justify-between px-3 rounded-lg border border-border/80 bg-background hover:bg-muted/40 text-xs transition-colors cursor-pointer outline-none focus:ring-0 focus:outline-none shrink-0',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              {selected ? (
                <>
                  <Avatar className="size-5 shrink-0 rounded-full border border-border/80">
                    {selected.user.avatar && (
                      <AvatarImage src={selected.user.avatar} className="object-cover" />
                    )}
                    <AvatarFallback className="text-[9px] bg-muted font-medium">
                      {selected.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate font-medium text-foreground">
                    {selected.user.name}
                  </span>
                </>
              ) : (
                <>
                  <UserIcon className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Select default assignee</span>
                </>
              )}
            </div>
            <ChevronDown className="size-3.5 text-muted-foreground shrink-0 ml-2" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-72 p-1.5 rounded-lg">
          <div className="p-1 pb-1.5">
            <Input
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs border-border/80 focus:ring-0 focus:outline-none"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5 pt-1">
            {selected && (
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <X className="size-3.5 shrink-0 text-muted-foreground" />
                <span>None (Clear default assignee)</span>
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No members found
              </div>
            ) : (
              filtered.map((m) => {
                const isSelected = m.userId === defaultAssigneeId;
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => {
                      onSelect(m.userId);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-accent text-foreground font-medium'
                        : 'text-foreground/90 hover:bg-muted/60'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="size-5 shrink-0 rounded-full border border-border/80">
                        {m.user.avatar && (
                          <AvatarImage src={m.user.avatar} className="object-cover" />
                        )}
                        <AvatarFallback className="text-[9px] bg-muted font-medium">
                          {m.user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{m.user.name}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

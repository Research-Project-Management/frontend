'use client';

import React, { useState } from 'react';
import { Users as UsersIcon, ChevronDown, Check } from 'lucide-react';
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

interface SubscribersProps {
  members: ProjectMemberItem[];
  subscriberIds: string[];
  onToggle: (userId: string) => void;
  disabled?: boolean;
}

export function Subscribers({
  members,
  subscriberIds,
  onToggle,
  disabled,
}: SubscribersProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = members.filter((m) =>
    m.user.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.user.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const count = subscriberIds.length;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Project subscribers</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select members who will receive notifications for this project.
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
              <UsersIcon className="size-4 text-muted-foreground shrink-0" />
              <span className={cn('truncate', count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                {count > 0 ? `${count} ${count === 1 ? 'member' : 'members'} selected` : 'Add members'}
              </span>
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
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No members found
              </div>
            ) : (
              filtered.map((m) => {
                const isSelected = subscriberIds.includes(m.userId);
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => onToggle(m.userId)}
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-accent/70 text-foreground font-medium'
                        : 'text-foreground/90 hover:bg-muted/60'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          'size-3.5 rounded border flex items-center justify-center transition-colors',
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/40'
                        )}
                      >
                        {isSelected && <Check className="size-2.5 stroke-[3]" />}
                      </div>
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

'use client';

import React, { useState } from 'react';
import { Users as UsersIcon, Check, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Input,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

interface WorklogUserItem {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

interface UsersProps {
  members: WorklogUserItem[];
  selectedUserIds: string[];
  onToggle: (userId: string) => void;
  onClear: () => void;
}

export function WorklogUsers({
  members,
  selectedUserIds,
  onToggle,
  onClear,
}: UsersProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const count = selectedUserIds.length;

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'h-8 px-2.5 rounded-md border border-border/80 bg-background hover:bg-muted/40 text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer outline-none shrink-0',
            count > 0 && 'border-primary/50 text-primary bg-primary/5'
          )}
        >
          <UsersIcon className="size-3.5 text-muted-foreground shrink-0" />
          <span>{count > 0 ? `Users (${count})` : 'Users'}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-1.5 rounded-lg">
        <div className="p-1 pb-1.5">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7.5 text-xs border-border/80 focus:ring-0 focus:outline-none"
          />
        </div>

        <div className="max-h-48 overflow-y-auto space-y-0.5 pt-1">
          {count > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <X className="size-3 shrink-0" />
              <span>Clear filter</span>
            </button>
          )}

          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No users found
            </div>
          ) : (
            filtered.map((m) => {
              const isSelected = selectedUserIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onToggle(m.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-left',
                    isSelected ? 'bg-accent/70 font-medium text-foreground' : 'text-foreground/90 hover:bg-muted/60'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        'size-3.5 rounded border flex items-center justify-center transition-colors shrink-0',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-muted-foreground/40'
                      )}
                    >
                      {isSelected && <Check className="size-2.5 stroke-[3]" />}
                    </div>

                    <Avatar className="size-5 rounded-full border border-border/80 shrink-0">
                      {m.avatar && <AvatarImage src={m.avatar} className="object-cover" />}
                      <AvatarFallback className="text-[9px] bg-muted font-medium">
                        {m.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <span className="truncate">{m.name}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

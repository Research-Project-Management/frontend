'use client';

import React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

interface FilterProps {
  currentRole: string | null;
  onSelectRole: (role: string | null) => void;
}

const ROLES = [
  { id: null, label: 'All roles' },
  { id: 'admin', label: 'Admin' },
  { id: 'contributor', label: 'Contributor' },
  { id: 'commenter', label: 'Commenter' },
  { id: 'viewer', label: 'Viewer' },
];

export function Filter({ currentRole, onSelectRole }: FilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'h-8 px-3 rounded-md border border-border/80 bg-background hover:bg-muted/50 text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer outline-none shrink-0',
            currentRole && 'border-primary/50 text-primary'
          )}
        >
          <span>{currentRole ? `Role: ${currentRole}` : 'Filters'}</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-36 p-1 rounded-lg">
        {ROLES.map((r) => {
          const isSelected = currentRole === r.id;
          return (
            <DropdownMenuItem
              key={r.label}
              onClick={() => onSelectRole(r.id)}
              className={cn(
                'flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer',
                isSelected && 'bg-accent font-medium text-foreground'
              )}
            >
              <span>{r.label}</span>
              {isSelected && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

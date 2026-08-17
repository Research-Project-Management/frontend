'use client';

import React, { useState } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { Input, Button } from '@/shared/components/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

const WORKSPACE_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
] as const;

interface MemberFilterProps {
  search: string;
  roleFilter: string[];
  canManage: boolean;
  onSearchChange: (val: string) => void;
  onRoleFilterChange: (val: string[]) => void;
  onOpenImport: () => void;
  onAddMember: () => void;
}

export function MemberFilter({
  search,
  roleFilter,
  canManage,
  onSearchChange,
  onRoleFilterChange,
  onOpenImport,
  onAddMember,
}: MemberFilterProps) {
  const [open, setOpen] = useState(false);
  const hasActiveFilters = roleFilter.length > 0;

  const toggleRole = (role: string) => {
    if (roleFilter.includes(role)) {
      onRoleFilterChange(roleFilter.filter((r) => r !== role));
    } else {
      onRoleFilterChange([...roleFilter, role]);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
      {/* ── Search Input ── */}
      <div className="relative w-48 sm:w-56">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 pl-8 text-xs rounded-lg border-border/80 bg-background focus:ring-0 focus:outline-none"
        />
      </div>

      {/* ── Role Filter (controlled open, checkbox multi-select) ── */}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'h-8 px-2.5 rounded-lg border border-border/80 bg-background',
              'text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer outline-none shrink-0',
              hasActiveFilters
                ? 'border-foreground/30 text-foreground bg-muted/30'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
            )}
          >
            <span>Filters</span>
            {/* Active badge */}
            {hasActiveFilters && (
              <span className="size-4 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center leading-none">
                {roleFilter.length}
              </span>
            )}
            <ChevronDown className="size-3 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-44 p-1.5 rounded-lg text-xs"
          onInteractOutside={() => setOpen(false)}
          onEscapeKeyDown={() => setOpen(false)}
        >
          {/* Title */}
          <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground tracking-wide">
            Roles
          </p>

          {/* Checkboxes — plain buttons so dropdown stays open on click */}
          {WORKSPACE_ROLES.map(({ value, label }) => {
            const checked = roleFilter.includes(value);
            return (
              <button
                key={value}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => toggleRole(value)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs transition-colors text-left',
                  checked ? 'text-foreground' : 'text-muted-foreground',
                  'hover:bg-accent hover:text-foreground cursor-pointer',
                )}
              >
                {/* Checkbox */}
                <span
                  className={cn(
                    'size-3.5 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors',
                    checked ? 'bg-[#09090b] border-[#09090b]' : 'border-border bg-background',
                  )}
                >
                  {checked && <Check className="size-2.5 text-white stroke-[3]" />}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Import CSV ── */}
      {canManage && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenImport}
          className="h-8 px-3 text-xs font-medium rounded-lg border-border/80 hover:bg-muted/50 cursor-pointer shrink-0"
        >
          Import
        </Button>
      )}

      {/* ── Add Member ── */}
      {canManage && (
        <Button
          size="sm"
          onClick={onAddMember}
          className="h-8 px-3.5 text-xs font-medium bg-[#0070f3] hover:bg-[#0060df] text-white rounded-md cursor-pointer shadow-2xs shrink-0"
        >
          Add member
        </Button>
      )}
    </div>
  );
}

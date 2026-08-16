'use client';

import React from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import {
  Input,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

interface MemberFilterProps {
  search: string;
  roleFilter: string;
  authFilter: string;
  canManage: boolean;
  onSearchChange: (val: string) => void;
  onRoleFilterChange: (val: string) => void;
  onAuthFilterChange: (val: string) => void;
  onOpenImport: () => void;
  onAddMember: () => void;
}

export function MemberFilter({
  search,
  roleFilter,
  authFilter,
  canManage,
  onSearchChange,
  onRoleFilterChange,
  onAuthFilterChange,
  onOpenImport,
  onAddMember,
}: MemberFilterProps) {
  const hasActiveFilters = roleFilter !== 'all' || authFilter !== 'all';

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

      {/* ── Filters Dropdown ── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'h-8 px-2.5 rounded-lg border border-border/80 bg-background hover:bg-muted/40 text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer outline-none shrink-0',
              hasActiveFilters && 'border-primary/50 text-primary bg-primary/5'
            )}
          >
            <span>Filters</span>
            <ChevronDown className="size-3 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-lg text-xs">
          <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground px-2 py-1">
            Role
          </DropdownMenuLabel>
          {['all', 'admin', 'member', 'guest'].map((r) => (
            <DropdownMenuItem
              key={r}
              onClick={() => onRoleFilterChange(r)}
              className="flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer capitalize text-xs"
            >
              <span>{r === 'all' ? 'All roles' : r}</span>
              {roleFilter === r && <Check className="size-3 text-primary stroke-[3]" />}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground px-2 py-1">
            Authentication
          </DropdownMenuLabel>
          {['all', 'google', 'email'].map((a) => (
            <DropdownMenuItem
              key={a}
              onClick={() => onAuthFilterChange(a)}
              className="flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer capitalize text-xs"
            >
              <span>{a === 'all' ? 'All providers' : a}</span>
              {authFilter === a && <Check className="size-3 text-primary stroke-[3]" />}
            </DropdownMenuItem>
          ))}

          {hasActiveFilters && (
            <>
              <DropdownMenuSeparator className="my-1" />
              <button
                type="button"
                onClick={() => {
                  onRoleFilterChange('all');
                  onAuthFilterChange('all');
                }}
                className="w-full text-center py-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer font-medium"
              >
                Reset filters
              </button>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Import CSV Button ── */}
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

      {/* ── Add Member Button ── */}
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

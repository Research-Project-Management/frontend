'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ListFilter, RotateCcw, Folder, FileText, Table2, Image as ImageIcon, Video, Music, Archive, Files, Briefcase } from 'lucide-react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import {
  useStorageFilterStore,
  type StorageTypeFilter,
  type StorageSortBy,
} from '../../store/use-filter-store';
import { useProjects } from '@/features/workspaces/projects/shell/hooks/use-project';

const TYPE_OPTIONS: { label: string; value: StorageTypeFilter; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'All Types', value: 'all', icon: Files },
  { label: 'Folders', value: 'folder', icon: Folder },
  { label: 'Documents', value: 'document', icon: FileText },
  { label: 'Spreadsheets', value: 'spreadsheet', icon: Table2 },
  { label: 'Images', value: 'image', icon: ImageIcon },
  { label: 'Videos', value: 'video', icon: Video },
  { label: 'Audio', value: 'audio', icon: Music },
  { label: 'Archives', value: 'archive', icon: Archive },
];

const SORT_OPTIONS: { label: string; value: StorageSortBy }[] = [
  { label: 'Last modified (Newest)', value: 'date-desc' },
  { label: 'Last modified (Oldest)', value: 'date-asc' },
  { label: 'Name (A to Z)', value: 'name-asc' },
  { label: 'Name (Z to A)', value: 'name-desc' },
  { label: 'File size (Largest)', value: 'size-desc' },
  { label: 'File size (Smallest)', value: 'size-asc' },
];

export function StorageFilterPopover() {
  const params = useParams() as { workspaceId?: string; projectId?: string };
  const workspaceId = params.workspaceId;
  const { projects = [] } = useProjects(workspaceId);

  const {
    typeFilter,
    projectFilter,
    sortBy,
    setTypeFilter,
    setProjectFilter,
    setSortBy,
    resetFilters,
  } = useStorageFilterStore();

  const isActive = typeFilter !== 'all' || projectFilter !== 'all' || sortBy !== 'date-desc';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "relative size-8 rounded-lg bg-transparent border-border/60 cursor-pointer outline-none transition-colors",
            isActive && "bg-accent/80 border-primary/50 text-primary"
          )}
          aria-label="Filter & Sort"
        >
          <ListFilter className="size-4" strokeWidth={2.5} />
          {isActive && (
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-3.5 space-y-3.5 shadow-lg border border-border/60 bg-popover text-popover-foreground rounded-xl z-50"
      >
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-1.5">
            <ListFilter className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Filter & Sort</span>
          </div>
          {isActive && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          )}
        </div>

        {/* 1. File Type Dropdown */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            File Type
          </label>
          <Select
            value={typeFilter}
            onValueChange={(val) => setTypeFilter(val as StorageTypeFilter)}
          >
            <SelectTrigger className="w-full h-8 text-xs bg-background/50 border-border/60">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-60">
              {TYPE_OPTIONS.map((opt) => {
                const IconComponent = opt.icon;
                return (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    <div className="flex items-center gap-2">
                      <IconComponent className="size-3.5 text-muted-foreground" />
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Project Dropdown (if workspace contains projects) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Project
          </label>
          <Select
            value={projectFilter}
            onValueChange={(val) => setProjectFilter(val)}
          >
            <SelectTrigger className="w-full h-8 text-xs bg-background/50 border-border/60">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-60 max-h-56">
              <SelectItem value="all" className="text-xs">
                <div className="flex items-center gap-2">
                  <Briefcase className="size-3.5 text-muted-foreground" />
                  <span>All Projects</span>
                </div>
              </SelectItem>
              <SelectItem value="workspace-only" className="text-xs">
                <div className="flex items-center gap-2">
                  <Files className="size-3.5 text-muted-foreground" />
                  <span>Workspace Only (No Project)</span>
                </div>
              </SelectItem>
              {projects.map((proj) => (
                <SelectItem key={proj.id} value={proj.id} className="text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <div className="size-2 rounded-full bg-primary/70 shrink-0" />
                    <span className="truncate">{proj.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 3. Sort By Dropdown */}
        <div className="space-y-1.5 pt-1 border-t border-border/30">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Sort by
          </label>
          <Select
            value={sortBy}
            onValueChange={(val) => setSortBy(val as StorageSortBy)}
          >
            <SelectTrigger className="w-full h-8 text-xs bg-background/50 border-border/60">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-60">
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}

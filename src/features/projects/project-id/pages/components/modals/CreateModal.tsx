'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Loader2, Tag, Search, X, Check, ChevronDown } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

export type PageStatus = 'published' | 'draft' | 'archived';

export const STATUS_CONFIG: Record<
  PageStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  published: {
    label: 'Published',
    color: '#10b981',
    bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/20',
  },
  draft: {
    label: 'Draft',
    color: '#f59e0b',
    bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/20',
  },
  archived: {
    label: 'Archived',
    color: '#64748b',
    bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
    border: 'border-slate-500/20',
  },
};

export interface ProjectLabelItem {
  id: string;
  name: string;
  color?: string;
  [key: string]: any;
}

interface CreateModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  title: string;
  setTitle: (title: string) => void;
  status?: PageStatus;
  setStatus?: (status: PageStatus) => void;
  handleCreate: () => void;
  isCreating: boolean;
  projectLabels?: ProjectLabelItem[];
  selectedLabelIds: string[];
  onToggleLabel: (labelId: string) => void;
  onClearLabels?: () => void;
  templateType?: 'blank' | 'example';
  setTemplateType?: (type: 'blank' | 'example') => void;
}

export function CreateModal({
  isOpen,
  setIsOpen,
  title,
  setTitle,
  status = 'published',
  setStatus,
  handleCreate,
  isCreating,
  projectLabels = [],
  selectedLabelIds = [],
  onToggleLabel,
  onClearLabels,
  templateType = 'blank',
  setTemplateType,
}: CreateModalProps) {
  const [labelSearch, setLabelSearch] = useState('');
  const [isLabelPopoverOpen, setIsLabelPopoverOpen] = useState(false);
  const [internalStatus, setInternalStatus] = useState<PageStatus>('published');
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);

  const currentStatus = status ?? internalStatus;
  const handleSetStatus = setStatus ?? setInternalStatus;
  const currentStatusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.published;

  useEffect(() => {
    if (!isOpen) {
      setLabelSearch('');
      setIsLabelPopoverOpen(false);
      setIsStatusPopoverOpen(false);
    }
  }, [isOpen]);

  const filteredLabels = useMemo(() => {
    if (!labelSearch.trim()) return projectLabels;
    const q = labelSearch.toLowerCase().trim();
    return projectLabels.filter((l) => l.name.toLowerCase().includes(q));
  }, [projectLabels, labelSearch]);

  const selectedLabels = useMemo(() => {
    return projectLabels.filter((l) => selectedLabelIds.includes(l.id));
  }, [projectLabels, selectedLabelIds]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[440px] rounded-md p-5 gap-4">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
            Create page
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Page Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title" className="text-xs font-medium text-foreground">
              Page title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Page title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="h-8 text-xs rounded-md shadow-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim() && !isCreating) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>

          {/* Status & Labels Row: Button with dropdown/popover + selected chips */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground">
              Status & Labels
            </Label>
            <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
              <Popover open={isLabelPopoverOpen} onOpenChange={setIsLabelPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-7 px-2 text-xs font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0',
                      selectedLabelIds.length > 0 && 'border-border/80 bg-muted/30 font-medium'
                    )}
                  >
                    <Tag className="size-3.5 text-muted-foreground shrink-0" />
                    <span>Labels</span>
                    {selectedLabelIds.length > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted text-foreground text-11 font-mono font-medium px-1">
                        {selectedLabelIds.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  className="w-56 p-0 py-1.5 rounded-md border border-border bg-popover z-50 flex flex-col shadow-md text-foreground overflow-hidden"
                >
                  {/* Search inside Dropdown */}
                  <div className="px-1.5 pb-1">
                    <div className="relative flex items-center border border-border rounded-md px-2 py-1 bg-background">
                      <Search className="size-3.5 text-muted-foreground shrink-0 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search labels..."
                        value={labelSearch}
                        onChange={(e) => setLabelSearch(e.target.value)}
                        className="w-full pl-2 pr-5 text-xs bg-transparent border-none outline-none focus:outline-none focus:ring-0 shadow-none text-foreground placeholder:text-muted-foreground"
                        autoFocus
                      />
                      {labelSearch && (
                        <button
                          type="button"
                          onClick={() => setLabelSearch('')}
                          className="absolute right-1.5 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-sm"
                          aria-label="Clear search"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dropdown items with dot and checkmark */}
                  <div
                    className="space-y-0.5 max-h-52 overflow-y-auto pl-1.5 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 [&::-webkit-scrollbar-button]:hidden"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}
                  >
                    {filteredLabels.length === 0 ? (
                      <div className="py-2.5 text-center text-xs text-muted-foreground">
                        {projectLabels.length === 0 ? 'No labels in this project' : 'No labels found'}
                      </div>
                    ) : (
                      filteredLabels.map((label) => {
                        const isSelected = selectedLabelIds.includes(label.id);
                        const color = label.color || '#3b82f6';
                        return (
                          <div
                            key={label.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onToggleLabel(label.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onToggleLabel(label.id);
                              }
                            }}
                            className={cn(
                              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted/60 cursor-pointer select-none text-left',
                              isSelected && 'bg-muted/60 font-medium'
                            )}
                          >
                            <div className="flex items-center gap-2 truncate min-w-0">
                              <span
                                className="size-2 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span className="truncate text-foreground">{label.name}</span>
                            </div>
                            {isSelected && (
                              <Check className="size-3.5 text-foreground shrink-0 ml-auto" strokeWidth={1.75} />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Status Popover Button (kế bên button label) */}
              <Popover open={isStatusPopoverOpen} onOpenChange={setIsStatusPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0"
                  >
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: currentStatusConfig.color }}
                    />
                    <span>{currentStatusConfig.label}</span>
                    <ChevronDown className="size-3 text-foreground/50 shrink-0 ml-0.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  className="w-40 p-1 rounded-md border border-border bg-popover z-50 flex flex-col shadow-md text-foreground overflow-hidden"
                >
                  {(Object.keys(STATUS_CONFIG) as PageStatus[]).map((st) => {
                    const cfg = STATUS_CONFIG[st];
                    const isSelected = currentStatus === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          handleSetStatus(st);
                          setIsStatusPopoverOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted/60 cursor-pointer select-none text-left',
                          isSelected && 'bg-muted/60 font-medium'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: cfg.color }}
                          />
                          <span className="text-foreground">{cfg.label}</span>
                        </div>
                        {isSelected && (
                          <Check className="size-3.5 text-foreground shrink-0" strokeWidth={1.75} />
                        )}
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>

              {/* Selected Label Chips displayed inline next to the button */}
              {selectedLabels.map((label) => {
                const color = label.color || '#3b82f6';
                return (
                  <span
                    key={label.id}
                    className="inline-flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-md text-xs font-medium border shrink-0 transition-colors"
                    style={{
                      backgroundColor: `${color}12`,
                      borderColor: `${color}30`,
                      color: color,
                    }}
                  >
                    <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate max-w-[130px]">{label.name}</span>
                    <button
                      type="button"
                      onClick={() => onToggleLabel(label.id)}
                      className="size-3.5 rounded-sm flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer ml-0.5"
                      title={`Remove ${label.name}`}
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={isCreating}
            className="h-8 px-3 text-12 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={!title.trim() || isCreating}
            className="h-8 px-3 text-12 font-medium cursor-pointer rounded-md shadow-none"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              'Create page'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Loader2,
  Tag,
  Search,
  X,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { PageService, replacePageLabels } from '../../services/page.service';
import { pageKeys } from '../../hooks/use-page';
import type { Page } from '../../types/page.types';
import type { ProjectLabelItem } from './CreateModal';

interface EditModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  page: Page | null;
  projectId: string;
  projectLabels?: ProjectLabelItem[];
}

type PageStatus = 'published' | 'draft' | 'archived';

const STATUS_CONFIG: Record<
  PageStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  published: {
    label: 'Published',
    color: 'var(--color-success, #1A7F37)',
    bg: 'bg-success/10 text-success',
    border: 'border-success/20',
  },
  draft: {
    label: 'Draft',
    color: 'var(--color-warning, #9A6700)',
    bg: 'bg-warning/10 text-warning',
    border: 'border-warning/20',
  },
  archived: {
    label: 'Archived',
    color: 'var(--color-muted-foreground, #6E6E6E)',
    bg: 'bg-muted text-muted-foreground',
    border: 'border-border',
  },
};

export function EditModal({
  isOpen,
  setIsOpen,
  page,
  projectId,
  projectLabels = [],
}: EditModalProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<PageStatus>('published');
  const [description, setDescription] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [labelSearch, setLabelSearch] = useState('');
  const [isLabelPopoverOpen, setIsLabelPopoverOpen] = useState(false);
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (page && isOpen) {
      setTitle(page.title || '');
      setStatus((page.status as PageStatus) || 'published');
      setDescription(page.description || '');
      const existingLabelIds = (page.labels || [])
        .map((l: any) => (typeof l === 'string' ? l : l.id))
        .filter(Boolean);
      setSelectedLabelIds(existingLabelIds);
      setLabelSearch('');
      setIsLabelPopoverOpen(false);
      setIsStatusPopoverOpen(false);
    }
  }, [page, isOpen]);

  const filteredLabels = useMemo(() => {
    if (!labelSearch.trim()) return projectLabels;
    const q = labelSearch.toLowerCase().trim();
    return projectLabels.filter((l) => l.name.toLowerCase().includes(q));
  }, [projectLabels, labelSearch]);

  const selectedLabels = useMemo(() => {
    return projectLabels.filter((l) => selectedLabelIds.includes(l.id));
  }, [projectLabels, selectedLabelIds]);

  const handleToggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  const handleSave = async () => {
    if (!page || !title.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const cleanTitle = title.trim();

      // Update title, status, and description
      await PageService.updatePage(page.id, {
        title: cleanTitle,
        status,
        description: description.trim(),
      });

      // Always sync labels
      if (projectId) {
        await replacePageLabels(projectId, page.id, selectedLabelIds);
      }

      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: pageKeys.project(projectId) });
      }
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(page.id) });

      toast.success('Page updated', { id: 'project-page-action' });
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update page', { id: 'project-page-action' });
    } finally {
      setIsSaving(false);
    }
  };

  const currentStatusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.published;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px] rounded-md p-5 gap-4 shadow-raised-200 border-border/80">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-16 font-semibold tracking-tight text-foreground">
            Edit page
          </DialogTitle>
          <DialogDescription className="sr-only">
            Edit page properties, status, and labels.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Page Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-page-title" className="text-12 font-medium text-foreground">
              Page title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-page-title"
              placeholder="Page title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="h-8 text-13 rounded-md shadow-none focus-visible:ring-1 focus-visible:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim() && !isSaving) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-page-desc" className="text-12 font-medium text-foreground">
              Description
            </Label>
            <textarea
              id="edit-page-desc"
              rows={3}
              placeholder="Add a brief description or abstract notes for this page..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-13 rounded-md border border-border bg-background p-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
            />
          </div>

          {/* Property Pills Toolbar (Status & Labels) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap py-0.5">
            {/* Status Popover */}
            <Popover open={isStatusPopoverOpen} onOpenChange={setIsStatusPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-7 px-2.5 text-12 font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0 relative before:absolute before:-inset-1.5 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring',
                    isStatusPopoverOpen && 'bg-muted border-border'
                  )}
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
                className="w-44 p-1 rounded-md border border-border bg-popover flex flex-col shadow-overlay"
              >
                {(Object.keys(STATUS_CONFIG) as PageStatus[]).map((st) => {
                  const cfg = STATUS_CONFIG[st];
                  const isSelected = status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setStatus(st);
                        setIsStatusPopoverOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-12 transition-colors hover:bg-muted/60 cursor-pointer select-none text-left relative before:absolute before:-inset-0.5 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                        isSelected && 'bg-muted font-medium'
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

            {/* Labels Popover */}
            <Popover open={isLabelPopoverOpen} onOpenChange={setIsLabelPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-7 px-2.5 text-12 font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0 relative before:absolute before:-inset-1.5 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring',
                    (isLabelPopoverOpen || selectedLabelIds.length > 0) && 'bg-muted border-border',
                    selectedLabelIds.length > 0 && 'font-medium'
                  )}
                  title={selectedLabelIds.length > 0 ? `Labels (${selectedLabelIds.length})` : 'Labels'}
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
                className="w-56 p-1.5 rounded-md border border-border bg-popover flex flex-col shadow-overlay text-foreground overflow-hidden"
              >
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1">
                  <Search className="size-3.5 text-muted-foreground shrink-0 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search labels..."
                    value={labelSearch}
                    onChange={(e) => setLabelSearch(e.target.value)}
                    className="w-full bg-transparent text-12 outline-none focus-visible:ring-0 focus-visible:outline-none placeholder:text-muted-foreground text-foreground"
                    autoFocus
                  />
                  {labelSearch && (
                    <button
                      type="button"
                      onClick={() => setLabelSearch('')}
                      className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-sm relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label="Clear search"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                <div
                  className="space-y-0.5 max-h-52 overflow-y-auto pl-0.5 pr-0.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 [&::-webkit-scrollbar-button]:hidden"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}
                >
                  {filteredLabels.length === 0 ? (
                    <div className="py-2.5 text-center text-12 text-muted-foreground">
                      {projectLabels.length === 0 ? 'No labels in this project' : 'No labels found'}
                    </div>
                  ) : (
                    filteredLabels.map((label) => {
                      const isSelected = selectedLabelIds.includes(label.id);
                      const color = label.color || '#0969DA';
                      return (
                        <button
                          key={label.id}
                          type="button"
                          onClick={() => handleToggleLabel(label.id)}
                          className={cn(
                            'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-12 transition-colors hover:bg-muted/60 cursor-pointer select-none text-left relative before:absolute before:-inset-0.5 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
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
                        </button>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Selected Label Chips inline */}
            {selectedLabels.map((label) => {
              const color = label.color || '#0969DA';
              return (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-md text-12 font-medium border shrink-0 transition-colors"
                  style={{
                    backgroundColor: `${color}12`,
                    borderColor: `${color}30`,
                    color: color,
                  }}
                >
                  <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="truncate max-w-[140px]">{label.name}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleLabel(label.id)}
                    className="size-3.5 rounded-sm flex items-center justify-center hover:bg-foreground/10 transition-colors cursor-pointer ml-0.5 relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                    title={`Remove ${label.name}`}
                    aria-label={`Remove ${label.name}`}
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>

        <DialogFooter className="mt-2 flex flex-row items-center justify-end gap-2.5 sm:gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(false)}
            disabled={isSaving}
            className="h-8 text-12 px-3 rounded-md shadow-none cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="h-8 text-12 px-3 rounded-md shadow-none cursor-pointer font-medium relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none" />
                Saving...
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditModal;

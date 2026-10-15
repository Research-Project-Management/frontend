'use client';

import React, { useState, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useParams } from 'next/navigation';
import { Tag, Search, Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import { useLabelsQuery } from '@/features/projects/project-id/work-items/hooks/use-label';
import type { Label } from '@/features/projects/project-id/work-items/types/work-item.types';

export function LabelTagIcon({ className }: { className?: string }) {
  return <Tag className={cn('size-3.5 shrink-0 text-foreground', className)} />;
}

import type { LabelPopoverProps } from '@/features/projects/project-id/work-items/types/picker.types';

export type { LabelPopoverProps };

export function LabelPopover({
  labels = [],
  setLabels,
  actionBtnClass,
  open,
  onOpenChange,
  disabled = false,
  isReadOnly = false,
  iconOnly = false,
  children,
}: LabelPopoverProps) {
  const params = useParams() as { projectId?: string } | null;
  const projectId = params?.projectId;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;
  const [labelSearch, setLabelSearch] = useState('');

  const { data: rawLabels } = useLabelsQuery(projectId, 'work-item', {
    enabled: Boolean(projectId) && isOpen,
  });

  const labelList: Label[] = useMemo(() => {
    if (Array.isArray(rawLabels)) return rawLabels;
    const labelsRecord = rawLabels as { labels?: Label[] } | undefined;
    if (Array.isArray(labelsRecord?.labels)) return labelsRecord.labels;
    return [];
  }, [rawLabels]);

  const filteredLabels = useMemo(() => {
    const q = labelSearch.trim().toLowerCase();
    if (!q) return labelList;
    return labelList.filter((l) => (l.name || '').toLowerCase().includes(q));
  }, [labelList, labelSearch]);

  const toggleLabel = (labelId: string) => {
    setLabels?.((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  const isDisabled = disabled || isReadOnly;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild disabled={isDisabled}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring',
            iconOnly && 'size-6 p-0 justify-center gap-0',
            actionBtnClass,
            isOpen && 'bg-muted border-border',
            labels.length > 0 && 'font-medium'
          )}
          title={labels.length > 0 ? `Labels (${labels.length})` : 'Labels'}
        >
          {children ? children : <LabelTagIcon className="size-3.5 shrink-0" />}
          {!iconOnly && <span>{labels.length > 0 ? `Labels (${labels.length})` : 'Labels'}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-56 p-1.5 rounded-md border border-border bg-popover shadow-overlay z-100 flex flex-col"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            placeholder="Search labels..."
            aria-label="Search labels"
            value={labelSearch}
            onChange={(e) => setLabelSearch(e.target.value)}
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            autoFocus
          />
        </div>
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {filteredLabels.length === 0 ? (
            <div className="py-2.5 text-center text-xs text-muted-foreground">
              No labels found
            </div>
          ) : (
            filteredLabels.map((label) => {
              const isSelected = labels.includes(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggleLabel(label.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left',
                    isSelected && 'bg-muted text-foreground font-medium'
                  )}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: label.color || '#0969DA' }}
                    />
                    <span className="truncate text-foreground">{label.name}</span>
                  </div>
                  {isSelected && <Check className="size-4 shrink-0 text-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const LabelPicker = LabelPopover;

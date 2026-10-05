'use client';

import React, { useState, useMemo } from 'react';
import { Loader2, Tag, Check, Search, X } from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

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
  handleCreate: () => void;
  isCreating: boolean;
  projectLabels?: ProjectLabelItem[];
  selectedLabelIds: string[];
  onToggleLabel: (labelId: string) => void;
  onClearLabels?: () => void;
}

export function CreateModal({
  isOpen,
  setIsOpen,
  title,
  setTitle,
  handleCreate,
  isCreating,
  projectLabels = [],
  selectedLabelIds = [],
  onToggleLabel,
  onClearLabels,
}: CreateModalProps) {
  const [labelSearch, setLabelSearch] = useState('');

  const filteredLabels = useMemo(() => {
    if (!labelSearch.trim()) return projectLabels;
    const q = labelSearch.toLowerCase().trim();
    return projectLabels.filter((l) => l.name.toLowerCase().includes(q));
  }, [projectLabels, labelSearch]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[460px] rounded-md p-5 gap-4">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
            Create Document
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Document Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title" className="text-xs font-medium text-foreground">
              Document Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g. Research Proposal, main.tex..."
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

          {/* Project Labels Section */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Tag className="size-3.5 text-muted-foreground shrink-0" />
                <span>Project Labels</span>
              </Label>
              {selectedLabelIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-11 font-mono tabular-nums text-muted-foreground">
                    {selectedLabelIds.length} selected
                  </span>
                  {onClearLabels && (
                    <button
                      type="button"
                      onClick={onClearLabels}
                      className="text-11 text-muted-foreground hover:text-foreground underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {projectLabels.length > 6 && (
              <div className="relative flex items-center mb-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground shrink-0 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter labels..."
                  value={labelSearch}
                  onChange={(e) => setLabelSearch(e.target.value)}
                  className="h-7 w-full pl-7 pr-6 text-xs bg-muted/30 border border-border/60 rounded-md outline-none focus:border-border text-foreground placeholder:text-muted-foreground/60"
                />
                {labelSearch && (
                  <button
                    type="button"
                    onClick={() => setLabelSearch('')}
                    className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )}

            {projectLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 rounded-md border border-border/60 bg-muted/20">
                {filteredLabels.length > 0 ? (
                  filteredLabels.map((label) => {
                    const isSelected = selectedLabelIds.includes(label.id);
                    const color = label.color || '#3b82f6';
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => onToggleLabel(label.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer select-none',
                          isSelected
                            ? 'border-transparent font-medium'
                            : 'border-border/60 bg-background text-foreground/80 hover:bg-muted/80'
                        )}
                        style={{
                          backgroundColor: isSelected ? `${color}20` : undefined,
                          borderColor: isSelected ? `${color}55` : undefined,
                          color: isSelected ? color : undefined,
                        }}
                      >
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate max-w-[150px]">{label.name}</span>
                        {isSelected && (
                          <Check className="size-3 shrink-0 stroke-[2.5]" style={{ color }} />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-11 text-muted-foreground py-1 px-1">
                    No labels match &quot;{labelSearch}&quot;
                  </p>
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-md border border-border/40 bg-muted/10 text-xs text-muted-foreground">
                No labels configured for this project. You can add common labels in Project Settings.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-8 rounded-md text-xs cursor-pointer shadow-none"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleCreate}
            disabled={isCreating || !title.trim()}
            className="h-8 rounded-md text-xs font-medium cursor-pointer shadow-none"
          >
            {isCreating && <Loader2 className="mr-2 size-3.5 animate-spin shrink-0" />}
            Create Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateModal;

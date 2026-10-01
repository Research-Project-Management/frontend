'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  Input,
  Button,
} from '@/shared/components/ui';
import { Search, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { useSearchCslStyles } from '../../data';
import type { CslStyleMetadata } from '../../types/library.types';
import { getCleanStyleLabel } from '../../domain';

export interface CslStyleSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectStyle: (style: { id: string; label: string }) => void;
  currentStyleId?: string;
}

export default function CslStyleSearchModal({
  open,
  onOpenChange,
  onSelectStyle,
  currentStyleId,
}: CslStyleSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<{ id: string; label: string } | null>(null);

  // Sync initial selected style when modal opens or currentStyleId changes
  useEffect(() => {
    if (open) {
      if (currentStyleId) {
        setSelectedStyle({ id: currentStyleId, label: getCleanStyleLabel(currentStyleId) });
      } else {
        setSelectedStyle(null);
      }
    }
  }, [open, currentStyleId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset search when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setDebouncedQuery('');
    }
  }, [open]);

  const { data: searchData, isLoading } = useSearchCslStyles(debouncedQuery, 50);

  const handleItemClick = (item: CslStyleMetadata) => {
    const rawLabel = item.titleShort || item.title;
    const label = getCleanStyleLabel(item.id, rawLabel);
    setSelectedStyle({ id: item.id, label });
  };

  const handleConfirm = () => {
    if (!selectedStyle) return;
    onSelectStyle(selectedStyle);
    onOpenChange(false);
    toast.success(`Selected style: ${selectedStyle.label}`, { id: 'csl-style-select' });
  };

  const styles = searchData?.styles || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md w-full p-0 overflow-hidden rounded-lg border border-border bg-background shadow-raised-300 gap-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1.5 bg-background">
          <DialogTitle className="text-13 font-semibold text-foreground">
            Citation Styles
          </DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-hidden transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          </DialogClose>
        </div>

        {/* Fixed Search Bar */}
        <div className="px-2 pb-1.5 bg-background">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
              strokeWidth={1.5}
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by journal name or keyword..."
              className="h-8 pl-8 pr-8 text-12 bg-background border-border rounded-md shadow-2xs font-normal text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
              autoFocus
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="size-3" />
              </button>
            ) : isLoading ? (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground animate-spin shrink-0" />
            ) : null}
          </div>
        </div>

        {/* Scrollable Styles Results List */}
        <div className="h-72 overflow-y-auto px-2 pb-1.5 space-y-0.5 thin-scrollbar select-none border-b">
          {isLoading && styles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-muted-foreground text-12 py-12">
              <Loader2 className="size-4 animate-spin text-foreground shrink-0" />
              <span>Searching citation styles...</span>
            </div>
          ) : styles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-1 text-center text-muted-foreground text-12 px-3 py-12">
              <p className="font-medium text-foreground">No citation styles found</p>
              <p className="text-11 text-muted-foreground">
                No matches found for &quot;{searchQuery}&quot;. Try another journal name or keyword.
              </p>
            </div>
          ) : (
            styles.map((item) => {
              const isSelected = selectedStyle?.id === item.id;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => {
                    handleItemClick(item);
                    const rawLabel = item.titleShort || item.title;
                    const label = getCleanStyleLabel(item.id, rawLabel);
                    onSelectStyle({ id: item.id, label });
                    onOpenChange(false);
                    toast.success(`Selected style: ${label}`, { id: 'csl-style-select' });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleItemClick(item);
                    }
                  }}
                  className={cn(
                    'group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors outline-none',
                    isSelected
                      ? 'bg-muted text-foreground'
                      : 'hover:bg-muted/60 text-foreground focus-visible:bg-muted/60',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-12 font-medium text-foreground truncate leading-snug" title={item.title}>
                      {item.title}
                    </p>
                    <p className="text-11 text-muted-foreground font-mono truncate">
                      {item.id}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center pr-0.5">
                    {isSelected && (
                      <Check className="size-4 text-foreground shrink-0" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-2 py-1.5 bg-background flex items-center justify-end sm:justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 px-2.5 text-12 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selectedStyle}
            onClick={handleConfirm}
            className="h-7 px-3 text-12 font-medium cursor-pointer rounded-md shadow-none"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

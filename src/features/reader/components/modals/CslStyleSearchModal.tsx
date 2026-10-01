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
import { cn } from '@/shared/lib/utils';
import { useSearchCslStyles } from '../../data';
import type { CslStyleMetadata } from '../../types/reader.types';
import { getCleanStyleLabel } from '../../utils/reader.util';

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

  const { data: styles = [], isLoading, isError } = useSearchCslStyles(debouncedQuery);

  const handleSelect = (item: CslStyleMetadata) => {
    const label = getCleanStyleLabel(item.id, item.title);
    setSelectedStyle({ id: item.id, label });
  };

  const handleConfirm = () => {
    if (selectedStyle) {
      onSelectStyle(selectedStyle);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-200">
        <DialogHeader className="p-4 border-b border-border bg-muted/20">
          <DialogTitle className="text-14 font-semibold text-foreground flex items-center gap-2">
            Search Citation Styles
          </DialogTitle>
          <p className="text-12 text-muted-foreground mt-0.5">
            Search over 10,000+ official CSL academic citation formats.
          </p>
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. IEEE, Harvard, ACM, Lancet, Chicago..."
              className="pl-9 pr-8 h-9 text-13 bg-background"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Style list */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[260px] max-h-[380px] divide-y divide-border/40">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-12">Searching styles...</span>
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-12 text-destructive">
              Failed to load citation styles. Please try again.
            </div>
          ) : styles.length === 0 ? (
            <div className="text-center py-8 text-12 text-muted-foreground">
              {debouncedQuery
                ? `No styles found matching "${debouncedQuery}"`
                : 'Type to search or choose from popular styles below.'}
            </div>
          ) : (
            styles.map((style) => {
              const isSelected = selectedStyle?.id === style.id;
              const cleanLabel = getCleanStyleLabel(style.id, style.title);

              return (
                <div
                  key={style.id}
                  onClick={() => handleSelect(style)}
                  className={cn(
                    'flex items-start justify-between p-2.5 rounded cursor-pointer transition-colors text-left group',
                    isSelected
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'hover:bg-muted/60 text-foreground',
                  )}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-13 truncate">{style.title}</span>
                      {cleanLabel && cleanLabel !== style.title && (
                        <span className="px-1.5 py-0.5 rounded text-10 font-mono bg-muted text-muted-foreground shrink-0">
                          {cleanLabel}
                        </span>
                      )}
                    </div>
                    {style.summary && (
                      <p className="text-11 text-muted-foreground line-clamp-1 mt-0.5">
                        {style.summary}
                      </p>
                    )}
                    <span className="text-10 text-muted-foreground/70 font-mono block mt-0.5">
                      {style.id}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="size-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0 mt-0.5">
                      <Check className="size-3" strokeWidth={2.5} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-border bg-muted/10 flex items-center justify-between sm:justify-between gap-2">
          <div className="text-11 text-muted-foreground truncate max-w-[260px]">
            {selectedStyle ? (
              <span>
                Selected: <strong className="text-foreground">{selectedStyle.label}</strong>
              </span>
            ) : (
              'Select a style from the list'
            )}
          </div>
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="h-8 text-12">
                Cancel
              </Button>
            </DialogClose>
            <Button
              size="sm"
              className="h-8 text-12 gap-1.5"
              disabled={!selectedStyle}
              onClick={handleConfirm}
            >
              <Check className="size-3.5" />
              Apply Style
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

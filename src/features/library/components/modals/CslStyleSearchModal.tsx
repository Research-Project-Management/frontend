'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
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

const POPULAR_STYLES_FALLBACK: CslStyleMetadata[] = [
  { id: 'ieee', name: 'IEEE (Institute of Electrical and Electronics Engineers)', title: 'IEEE (Institute of Electrical and Electronics Engineers)', titleShort: 'IEEE', category: 'numeric' },
  { id: 'apa-7th', name: 'American Psychological Association 7th edition (APA)', title: 'American Psychological Association 7th edition (APA)', titleShort: 'APA', category: 'author-date' },
  { id: 'chicago', name: 'Chicago Manual of Style 17th edition (Author-Date)', title: 'Chicago Manual of Style 17th edition (Author-Date)', titleShort: 'Chicago', category: 'author-date' },
  { id: 'harvard', name: 'Harvard Reference Format 1 (Author-Date)', title: 'Harvard Reference Format 1 (Author-Date)', titleShort: 'Harvard', category: 'author-date' },
  { id: 'nature', name: 'Nature', title: 'Nature', titleShort: 'Nature', category: 'numeric' },
  { id: 'science', name: 'Science', title: 'Science', titleShort: 'Science', category: 'numeric' },
  { id: 'vancouver', name: 'Vancouver (ICMJE)', title: 'Vancouver (ICMJE)', titleShort: 'Vancouver', category: 'numeric' },
  { id: 'mla-9th', name: 'Modern Language Association 9th edition (MLA)', title: 'Modern Language Association 9th edition (MLA)', titleShort: 'MLA', category: 'author-date' },
  { id: 'cell', name: 'Cell', title: 'Cell', titleShort: 'Cell', category: 'author-date' },
  { id: 'the-lancet', name: 'The Lancet', title: 'The Lancet', titleShort: 'Lancet', category: 'numeric' },
  { id: 'american-chemical-society', name: 'American Chemical Society (ACS)', title: 'American Chemical Society (ACS)', titleShort: 'ACS', category: 'numeric' },
  { id: 'association-for-computing-machinery', name: 'ACM (Association for Computing Machinery)', title: 'ACM (Association for Computing Machinery)', titleShort: 'ACM', category: 'numeric' },
  { id: 'springer-lecture-notes-in-computer-science', name: 'Springer LNCS (Lecture Notes in Computer Science)', title: 'Springer LNCS (Lecture Notes in Computer Science)', titleShort: 'Springer LNCS', category: 'numeric' },
  { id: 'plos-one', name: 'PLOS ONE', title: 'PLOS ONE', titleShort: 'PLOS ONE', category: 'numeric' },
  { id: 'pnas', name: 'Proceedings of the National Academy of Sciences (PNAS)', title: 'Proceedings of the National Academy of Sciences (PNAS)', titleShort: 'PNAS', category: 'numeric' },
  { id: 'bibtex', name: 'BibTeX (LaTeX Standard)', title: 'BibTeX (LaTeX Standard)', titleShort: 'BibTeX', category: 'raw' },
  { id: 'ris', name: 'Research Information Systems (RIS)', title: 'Research Information Systems (RIS)', titleShort: 'RIS', category: 'raw' },
];

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
      const isCoreStyle = ['bibtex', 'apa-7th', 'ieee', 'mla-9th', 'apa', 'mla'].includes(
        currentStyleId?.toLowerCase() || '',
      );
      if (currentStyleId && !isCoreStyle) {
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

  const { data: searchData, isLoading, isError } = useSearchCslStyles(debouncedQuery, 50, {
    enabled: open,
  });

  const styles = useMemo(() => {
    // 1. Authoritative: Use server results when available (handles empty array correctly)
    if (searchData?.styles) {
      return searchData.styles;
    }
    // 2. Offline / network error fallback only:
    if (isError || !searchData) {
      if (!debouncedQuery) return POPULAR_STYLES_FALLBACK;
      const q = debouncedQuery.toLowerCase();
      return POPULAR_STYLES_FALLBACK.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.titleShort?.toLowerCase().includes(q),
      );
    }
    return [];
  }, [searchData, isError, debouncedQuery]);

  const handleItemClick = (item: CslStyleMetadata) => {
    const rawLabel = item.titleShort || item.title;
    const label = getCleanStyleLabel(item.id, rawLabel);
    setSelectedStyle({ id: item.id, label });
  };

  const handleConfirm = () => {
    if (!selectedStyle || selectedStyle.id === currentStyleId) return;
    onSelectStyle(selectedStyle);
    onOpenChange(false);
    toast.success(`Selected style: ${selectedStyle.label}`, { id: 'csl-style-select' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[540px] w-full p-0 overflow-hidden rounded-xl border border-border bg-background shadow-raised-300 gap-0"
      >
        {/* Header - Unified px-4 padding and vertically centered Close button */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 bg-background">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Citation Styles
          </DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-hidden transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </DialogClose>
        </div>

        {/* Fixed Search Bar - Aligned to exact px-4 matching header and results */}
        <div className="px-4 pb-2.5 bg-background">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
              strokeWidth={1.5}
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (selectedStyle && selectedStyle.id !== currentStyleId) {
                    handleConfirm();
                  } else if (styles.length > 0) {
                    const first = styles[0];
                    const rawLabel = first.titleShort || first.title;
                    const label = getCleanStyleLabel(first.id, rawLabel);
                    onSelectStyle({ id: first.id, label });
                    onOpenChange(false);
                    toast.success(`Selected style: ${label}`, { id: 'csl-style-select' });
                  }
                }
              }}
              placeholder="Search by journal name or keyword..."
              className="h-9 pl-9 pr-9 text-12 bg-background border-border rounded-md shadow-none font-normal text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary transition-colors"
              autoFocus
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-sm cursor-pointer transition-colors"
                aria-label="Clear search"
              >
                <X className="size-3.5" strokeWidth={1.5} />
              </button>
            ) : isLoading ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground animate-spin shrink-0" strokeWidth={1.5} />
            ) : null}
          </div>
        </div>

        {/* Scrollable Styles Results List - Aligned px-4 container with comfortable item padding */}
        <div className="h-[340px] overflow-y-auto px-4 pb-2 space-y-1 thin-scrollbar select-none border-b border-border/40">
          {isLoading && styles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-muted-foreground text-12 py-12">
              <Loader2 className="size-4 animate-spin text-foreground shrink-0" strokeWidth={1.5} />
              <span>Searching citation styles...</span>
            </div>
          ) : styles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-1.5 text-center text-muted-foreground text-12 px-6 py-12">
              <p className="font-medium text-foreground">No citation styles found</p>
              <p className="text-11 text-muted-foreground max-w-[320px]">
                {debouncedQuery
                  ? `No matches found for "${debouncedQuery}". Try another journal name or keyword.`
                  : 'No citation styles available. Try typing a journal name or keyword.'}
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
                      const rawLabel = item.titleShort || item.title;
                      const label = getCleanStyleLabel(item.id, rawLabel);
                      onSelectStyle({ id: item.id, label });
                      onOpenChange(false);
                      toast.success(`Selected style: ${label}`, { id: 'csl-style-select' });
                    }
                  }}
                  className={cn(
                    'group flex items-center justify-between gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors outline-none select-none',
                    isSelected
                      ? 'bg-muted text-foreground font-medium'
                      : 'hover:bg-muted/50 text-foreground focus-visible:bg-muted/50',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-12 font-medium text-foreground truncate leading-snug">
                      {item.title}
                    </p>
                    <p className="text-11 text-muted-foreground font-mono truncate mt-0.5">
                      {item.id}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center pr-1">
                    {isSelected && (
                      <Check className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer - Aligned px-4 */}
        <DialogFooter className="px-4 py-3 bg-background flex items-center justify-end sm:justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 px-3 text-12 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selectedStyle || selectedStyle.id === currentStyleId}
            onClick={handleConfirm}
            className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md shadow-none"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

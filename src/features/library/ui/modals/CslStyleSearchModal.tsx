'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Check, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogClose,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { CslStyleMetadata } from '@/features/library/types/core.types';
import { useSearchCslStyles } from '@/features/library/core/coordinator/citation.coordinator';
import {
  getCleanStyleLabel,
  normalizeCitationStyleId,
} from '@/features/library/domain/citations';

export interface CslStyleSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectStyle: (style: { id: string; label: string }) => void;
  currentStyleId?: string;
}

export const CSL_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  'author-date': 'Author-Date',
  numeric: 'Numeric',
  note: 'Note',
  label: 'Label',
  raw: 'Export',
};

export function CslStyleSearchModal({
  open,
  onOpenChange,
  onSelectStyle,
  currentStyleId,
}: CslStyleSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const normalizedCurrentId = useMemo(
    () => (currentStyleId ? normalizeCitationStyleId(currentStyleId) : ''),
    [currentStyleId],
  );

  useEffect(() => {
    if (open) {
      if (normalizedCurrentId) {
        setSelectedStyle({
          id: normalizedCurrentId,
          label: getCleanStyleLabel(normalizedCurrentId),
        });
      } else {
        setSelectedStyle(null);
      }
    }
  }, [open, normalizedCurrentId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setDebouncedQuery('');
    }
  }, [open]);

  const { data: searchData, isLoading } = useSearchCslStyles(debouncedQuery, 50, {
    enabled: open,
  });

  const styles = useMemo(() => {
    const raw = searchData?.styles ?? [];
    const seen = new Set<string>();
    const deduped: CslStyleMetadata[] = [];
    for (const item of raw) {
      const canonicalKey = normalizeCitationStyleId(item.id).toLowerCase();
      const nameKey = (item.name || item.id).toLowerCase();
      if (seen.has(canonicalKey) || seen.has(nameKey)) continue;
      seen.add(canonicalKey);
      seen.add(nameKey);
      deduped.push(item);
    }
    return deduped;
  }, [searchData?.styles]);

  const handleItemClick = (item: CslStyleMetadata) => {
    const rawLabel = item.titleShort || item.title;
    const label = getCleanStyleLabel(item.id, rawLabel);
    setSelectedStyle({ id: item.id, label });
  };

  const selectAndClose = (style: { id: string; label: string }) => {
    if (normalizeCitationStyleId(style.id) !== normalizedCurrentId) {
      onSelectStyle(style);
    }
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (!selectedStyle) return;
    selectAndClose(selectedStyle);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (styles.length === 0) return;
      e.preventDefault();
      const currentIndex = styles.findIndex(
        (s) =>
          selectedStyle &&
          normalizeCitationStyleId(s.id) === normalizeCitationStyleId(selectedStyle.id),
      );
      const nextIndex =
        e.key === 'ArrowDown'
          ? currentIndex < styles.length - 1
            ? currentIndex + 1
            : 0
          : currentIndex > 0
            ? currentIndex - 1
            : styles.length - 1;
      const target = styles[nextIndex];
      if (target) {
        handleItemClick(target);
        const el = document.getElementById(`csl-style-option-${target.id}`);
        el?.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedStyle) {
        handleConfirm();
      } else if (styles.length > 0) {
        const first = styles[0];
        const rawLabel = first.titleShort || first.title;
        const label = getCleanStyleLabel(first.id, rawLabel);
        selectAndClose({ id: first.id, label });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[560px] w-full p-0 overflow-hidden rounded-lg border border-border bg-background shadow-raised-200 gap-0"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-background shrink-0 select-none">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Citation Styles
          </DialogTitle>
          <DialogDescription className="sr-only">
            Search and select a citation style for references and bibliography export.
          </DialogDescription>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={1.5} />
            </Button>
          </DialogClose>
        </div>

        <div className="h-10 px-4 flex items-center gap-2.5 border-b border-border bg-background shrink-0">
          <Search
            className="size-3.5 text-muted-foreground shrink-0 pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search styles by journal name or keyword..."
            aria-label="Search citation styles"
            className="flex-1 bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none border-none h-full font-normal"
            autoFocus
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="size-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded cursor-pointer transition-colors"
              aria-label="Clear search"
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          ) : isLoading ? (
            <Loader2
              className="size-3.5 text-muted-foreground animate-spin shrink-0"
              strokeWidth={1.5}
            />
          ) : null}
        </div>

        <div
          role="listbox"
          aria-label="Citation styles"
          className="h-[360px] overflow-y-auto px-2.5 py-2 space-y-0.5 thin-scrollbar select-none"
        >
          {isLoading && styles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-muted-foreground text-12 py-12">
              <Loader2
                className="size-4 animate-spin text-muted-foreground shrink-0"
                strokeWidth={1.5}
              />
              <span>Searching citation styles...</span>
            </div>
          ) : styles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-1.5 text-center text-12 px-6 py-12">
              <p className="font-medium text-foreground">No citation styles found</p>
              <p className="text-12 text-muted-foreground max-w-[320px]">
                {debouncedQuery
                  ? `No matches found for "${debouncedQuery}". Try another journal name or keyword.`
                  : 'No citation styles available. Try typing a journal name or keyword.'}
              </p>
            </div>
          ) : (
            styles.map((item) => {
              const isSelected = Boolean(
                selectedStyle &&
                  normalizeCitationStyleId(selectedStyle.id) ===
                    normalizeCitationStyleId(item.id),
              );
              const categoryLabel = CSL_CATEGORY_LABELS[item.category || ''] || null;

              return (
                <div
                  id={`csl-style-option-${item.id}`}
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => {
                    const rawLabel = item.titleShort || item.title;
                    const label = getCleanStyleLabel(item.id, rawLabel);
                    selectAndClose({ id: item.id, label });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const rawLabel = item.titleShort || item.title;
                      const label = getCleanStyleLabel(item.id, rawLabel);
                      selectAndClose({ id: item.id, label });
                    }
                  }}
                  className={cn(
                    'group flex items-center justify-between gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors duration-150 outline-none select-none',
                    isSelected
                      ? 'bg-muted text-foreground'
                      : 'hover:bg-muted/50 text-foreground focus-visible:bg-muted/50',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-13 leading-snug truncate',
                        isSelected ? 'font-medium text-foreground' : 'font-normal text-foreground',
                      )}
                      title={item.title}
                    >
                      {item.title}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    {categoryLabel && (
                      <span className="text-11 text-muted-foreground font-normal">
                        {categoryLabel}
                      </span>
                    )}
                    <div className="size-4 flex items-center justify-center shrink-0">
                      {isSelected && (
                        <Check
                          className="size-4 text-primary shrink-0"
                          strokeWidth={2}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-background flex items-center justify-between gap-3 shrink-0 select-none">
          <div className="text-12 text-muted-foreground truncate max-w-[280px]">
            {selectedStyle ? (
              <span>
                Selected:{' '}
                <span className="font-medium text-foreground">{selectedStyle.label}</span>
              </span>
            ) : (
              <span>{styles.length} styles available</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground transition-colors shadow-none"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedStyle}
              onClick={handleConfirm}
              className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md shadow-none"
            >
              Select Style
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

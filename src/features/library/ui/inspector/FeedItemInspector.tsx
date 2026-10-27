'use client';

import React from 'react';
import {
  BookPlus,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Folder,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import type { ParsedFeedEntry } from '@/features/library/domain/feed-parser.domain';
import { safeHttpUrl } from '@/features/library/domain/retraction';
import type { Collection } from '@/features/library/domain/types/library.types';
import { cn } from '@/shared/lib/utils';

export interface FeedItemInspectorProps {
  entry: ParsedFeedEntry | null;
  feedTitle?: string;
  collections?: Collection[];
  isRead?: boolean;
  isSaving?: boolean;
  isSaved?: boolean;
  onToggleRead?: (entryId: string) => void;
  onSave?: (entry: ParsedFeedEntry, collectionId?: string) => void;
  onClose?: () => void;
}

export function FeedItemInspector({
  entry,
  feedTitle,
  collections = [],
  isRead = false,
  isSaving = false,
  isSaved = false,
  onToggleRead,
  onSave,
  onClose,
}: FeedItemInspectorProps) {
  if (!entry) {
    return (
      <div className="h-full flex flex-col min-h-0 bg-background overflow-hidden text-foreground">
        <div className="h-11 px-3.5 flex items-center justify-between border-b border-border bg-background shrink-0 select-none">
          <span className="text-12 font-medium text-muted-foreground">
            Article details
          </span>
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="size-7.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md cursor-pointer"
                  aria-label="Close inspector"
                >
                  <X className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Close inspector
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <PlaneEmptyState
            variant="document"
            title="No article selected"
            description="Select an article from the feed to view metadata and details."
            isCompact
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-background overflow-hidden text-foreground select-text">
      {/* ── Header: Actions bar with Clean Tools & Close ── */}
      <div className="h-11 px-3.5 flex items-center justify-between border-b border-border bg-background shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-12 font-medium text-muted-foreground">
            Article details
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Read / Unread toggle icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onToggleRead?.(entry.id)}
                className="size-7.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                aria-label={isRead ? 'Mark as unread' : 'Mark as read'}
              >
                {isRead ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isRead ? 'Mark as unread' : 'Mark as read'}
            </TooltipContent>
          </Tooltip>

          {/* Close button */}
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="size-7.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md cursor-pointer"
                  aria-label="Close inspector"
                >
                  <X className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Close inspector
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── Scrollable Body: Clean, Top-to-Bottom Logical Flow ── */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* 1. Primary Action: Save / Add to Collection */}
        <div className="flex items-center -space-x-px w-full">
          <Button
            type="button"
            variant={isSaved ? 'secondary' : 'default'}
            size="sm"
            disabled={isSaving}
            onClick={() => {
              if (!isSaved) onSave?.(entry);
            }}
            className={cn(
              'h-8 text-12 font-medium flex-1 cursor-pointer transition-colors shadow-none gap-2',
              collections.length > 0 ? 'rounded-l-md rounded-r-none' : 'rounded-md',
              isSaved && 'bg-muted/70 text-foreground border border-border hover:bg-muted'
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : isSaved ? (
              <>
                <Check className="size-3.5 text-foreground" />
                <span>Saved in Library</span>
              </>
            ) : (
              <>
                <BookPlus className="size-3.5" />
                <span>Save to Library</span>
              </>
            )}
          </Button>

          {!isSaved && collections.length > 0 && (
            <DropdownMenu>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant={isSaved ? 'secondary' : 'default'}
                      size="icon"
                      disabled={isSaving}
                      className={cn(
                        'h-8 w-7 rounded-l-none rounded-r-md px-0 cursor-pointer shadow-none',
                        isSaved
                          ? 'border-y border-r border-l-0 border-border bg-muted/70 text-foreground hover:bg-muted'
                          : 'border-l border-primary-foreground/20'
                      )}
                      aria-label={isSaved ? 'Add or move to collection' : 'Save to specific collection'}
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isSaved ? 'Add to collection...' : 'Save to collection...'}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={4}
                className="w-56 p-1 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-50 select-none"
              >
                <div className="px-2 py-1.5 text-11 font-medium text-muted-foreground">
                  {isSaved ? 'Add to collection...' : 'Save to collection...'}
                </div>
                <DropdownMenuSeparator className="my-1" />
                {!isSaved && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onSave?.(entry)}
                      className="h-7.5 px-2 text-12 font-medium cursor-pointer rounded hover:bg-muted"
                    >
                      <BookPlus className="size-3.5 mr-2 text-muted-foreground" />
                      <span>My Library (Root)</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                  </>
                )}
                <div className="max-h-48 overflow-y-auto space-y-0.5 scrollbar-none">
                  {collections.map((col) => (
                    <DropdownMenuItem
                      key={col.id}
                      onClick={() => onSave?.(entry, col.id)}
                      className="h-7.5 px-2 text-12 cursor-pointer rounded hover:bg-muted flex items-center gap-2"
                    >
                      <Folder className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{col.name}</span>
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* 2. Article Title */}
        <div className="pt-1">
          <h2 className="text-15 font-semibold text-foreground leading-snug tracking-tight">
            {entry.title}
          </h2>
        </div>

        {/* 3. Authors */}
        {entry.authors && entry.authors.length > 0 && (
          <div className="pt-2 border-t border-border/60 space-y-1">
            <span className="text-12 font-medium text-muted-foreground">
              Authors
            </span>
            <div className="text-12 text-foreground space-y-0.5 pt-0.5">
              {entry.authors.map((author, i) => (
                <div key={i} className="leading-relaxed">
                  {author}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Publication & Metadata (Including direct clickable links) */}
        <div className="pt-2 border-t border-border/60 space-y-2">
          <span className="text-12 font-medium text-muted-foreground">
            Metadata
          </span>

          <div className="grid grid-cols-[84px_1fr] gap-x-2 gap-y-1.5 text-12">
            {entry.publicationTitle && (
              <>
                <span className="text-muted-foreground">Publication:</span>
                <span className="text-foreground font-medium">{entry.publicationTitle}</span>
              </>
            )}

            {(entry.year || entry.publishedAt) && (
              <>
                <span className="text-muted-foreground">Published:</span>
                <span className="text-foreground">{entry.publishedAt || entry.year}</span>
              </>
            )}

            {entry.updatedAt && entry.updatedAt !== entry.publishedAt && (
              <>
                <span className="text-muted-foreground">Updated:</span>
                <span className="text-foreground">{entry.updatedAt}</span>
              </>
            )}

            {entry.rights && (
              <>
                <span className="text-muted-foreground">License:</span>
                <span className="text-foreground font-medium">{entry.rights}</span>
              </>
            )}

            {safeHttpUrl(entry.url) && (
              <>
                <span className="text-muted-foreground">URL:</span>
                <a
                  href={safeHttpUrl(entry.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:underline truncate min-w-0 block"
                  title={entry.url}
                >
                  {entry.url}
                </a>
              </>
            )}

            {safeHttpUrl(entry.pdfUrl) && entry.pdfUrl !== entry.url && (
              <>
                <span className="text-muted-foreground">PDF:</span>
                <a
                  href={safeHttpUrl(entry.pdfUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (!isRead) onToggleRead?.(entry.id);
                  }}
                  className="text-foreground hover:underline truncate min-w-0 block"
                  title={entry.pdfUrl}
                >
                  {entry.pdfUrl}
                </a>
              </>
            )}

            {entry.doi && (
              <>
                <span className="text-muted-foreground">DOI:</span>
                <a
                  href={`https://doi.org/${encodeURI(entry.doi.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:underline truncate min-w-0 block"
                  title={entry.doi}
                >
                  {entry.doi}
                </a>
              </>
            )}

            {entry.arxivId && (
              <>
                <span className="text-muted-foreground">arXiv:</span>
                <a
                  href={`https://arxiv.org/abs/${encodeURI(entry.arxivId.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:underline truncate min-w-0 block"
                  title={entry.arxivId}
                >
                  {entry.arxivId}
                </a>
              </>
            )}

            {entry.volume && (
              <>
                <span className="text-muted-foreground">Volume:</span>
                <span className="text-foreground">{entry.volume}</span>
              </>
            )}

            {entry.issue && (
              <>
                <span className="text-muted-foreground">Issue:</span>
                <span className="text-foreground">{entry.issue}</span>
              </>
            )}

            {entry.pages && (
              <>
                <span className="text-muted-foreground">Pages:</span>
                <span className="text-foreground">{entry.pages}</span>
              </>
            )}
          </div>
        </div>

        {/* 5. Abstract */}
        {entry.abstract && (
          <div className="pt-2.5 border-t border-border/60 space-y-1.5">
            <span className="text-12 font-medium text-foreground tracking-tight">
              Abstract
            </span>
            <p className="text-13 leading-relaxed text-foreground/80 selection:bg-primary/20">
              {entry.abstract}
            </p>
          </div>
        )}

        {/* 5.5 Author Comments / Publication Notes (e.g. Conference, Code Link) */}
        {entry.comment && (
          <div className="pt-2 border-t border-border/60 space-y-1">
            <span className="text-12 font-medium text-muted-foreground">
              Comments / Notes
            </span>
            <p className="text-12 text-foreground leading-relaxed bg-muted/30 p-2 rounded-md border border-border/40 select-text">
              {entry.comment}
            </p>
          </div>
        )}

        {/* 6. Categories / Tags */}
        {entry.categories && entry.categories.length > 0 && (
          <div className="pt-2 border-t border-border/60 space-y-1.5">
            <span className="text-12 font-medium text-muted-foreground">
              Categories
            </span>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {entry.categories.map((cat, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded text-11 bg-muted text-muted-foreground"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FeedItemInspector;

'use client';

import React from 'react';
import {
  EyeOff,
  Eye,
  ExternalLink,
  Loader2,
  Check,
  BookPlus,
  ChevronDown,
  Folder,
  ChevronUp,
  Calendar,
  Bookmark,
  RefreshCw,
} from 'lucide-react';
import { safeHttpUrl } from '@/features/library/domain/retraction';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import type { Collection } from '@/features/library/domain/types/library.types';
import type { ParsedFeedEntry } from '@/features/library/domain/feed-parser.domain';
import { cn } from '@/shared/lib/utils';

export interface FeedSubNavigationBarProps {
  readFilter: 'all' | 'unread' | 'read';
  onChangeReadFilter: (tab: 'all' | 'unread' | 'read') => void;
  lastRefreshed?: string | null;
  isFetching: boolean;
  onSync: () => void;
}

export function FeedSubNavigationBar({
  readFilter,
  onChangeReadFilter,
  lastRefreshed,
  isFetching,
  onSync,
}: FeedSubNavigationBarProps) {
  return (
    <nav
      aria-label="Feed read state filter"
      className="flex items-center gap-1 border-b border-border px-4 bg-background select-none shrink-0 h-10 min-h-10"
    >
      {(['all', 'unread', 'read'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChangeReadFilter(tab)}
          className={cn(
            'relative flex h-full items-center px-3.5 text-13 font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0 capitalize',
            readFilter === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span>{tab}</span>
          {readFilter === tab && (
            <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-primary" />
          )}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-2">
        {lastRefreshed && (
          <span className="hidden sm:inline text-11 text-muted-foreground">
            Pool synced{' '}
            {new Date(lastRefreshed).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSync}
          disabled={isFetching}
          className="h-7 px-2 text-11 text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
        >
          <RefreshCw className={cn('size-3', isFetching && 'animate-spin')} />
          <span>Sync</span>
        </Button>
      </div>
    </nav>
  );
}

export interface FeedArticleRowProps {
  entry: ParsedFeedEntry;
  feedTitle: string;
  canEdit: boolean;
  collectionList: Collection[];
  isSaving: boolean;
  isSaved: boolean;
  isRead: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  onSelectEntry: (entry: ParsedFeedEntry) => void;
  onToggleRead: (entryId: string) => void;
  onMarkEntryAsRead: (entryId: string) => void;
  onSaveEntry: (entry: ParsedFeedEntry, targetCollectionId?: string) => void;
  onToggleAbstract: (entryId: string) => void;
}

export function FeedArticleRow({
  entry,
  feedTitle,
  canEdit,
  collectionList,
  isSaving,
  isSaved,
  isRead,
  isExpanded,
  isSelected,
  onSelectEntry,
  onToggleRead,
  onMarkEntryAsRead,
  onSaveEntry,
  onToggleAbstract,
}: FeedArticleRowProps) {
  return (
    <article
      aria-label={entry.title}
      onClick={() => onSelectEntry(entry)}
      className={cn(
        'px-4 py-3.5 flex flex-col gap-2 cursor-pointer relative',
        isSelected && 'bg-muted/60',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-14 sm:text-[15px] font-semibold text-foreground leading-snug tracking-tight block">
            {entry.title}
          </h3>

          {entry.authors.length > 0 && (
            <p className="text-12 text-muted-foreground truncate font-normal leading-normal">
              {entry.authors.join(', ')}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Read / Unread toggle */}
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onToggleRead(entry.id)}
                className="size-7 rounded-md text-foreground cursor-pointer"
                aria-label={isRead ? 'Mark as unread' : 'Mark as read'}
              >
                {isRead ? (
                  <EyeOff className="size-3.5 text-foreground" />
                ) : (
                  <Eye className="size-3.5 text-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {isRead ? 'Mark as unread' : 'Mark as read'}
            </TooltipContent>
          </Tooltip>

          {entry.url && (
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const safe = safeHttpUrl(entry.url);
                    if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
                  }}
                  className="size-7 rounded-md text-foreground cursor-pointer"
                  aria-label="View source"
                >
                  <ExternalLink className="size-3.5 text-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                View source
              </TooltipContent>
            </Tooltip>
          )}

          {canEdit && (
            <div className="flex items-center -space-x-px">
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={isSaving || isSaved}
                    onClick={() => onSaveEntry(entry)}
                    className={cn(
                      'size-7 text-foreground cursor-pointer',
                      collectionList.length > 0 && !isSaved
                        ? 'rounded-l-md rounded-r-none'
                        : 'rounded-md',
                    )}
                    aria-label={
                      isSaved
                        ? 'In library'
                        : isSaving
                          ? 'Saving to library...'
                          : 'Save to library'
                    }
                  >
                    {isSaving ? (
                      <Loader2 className="size-3.5 animate-spin text-foreground" />
                    ) : isSaved ? (
                      <Check className="size-3.5 text-foreground" />
                    ) : (
                      <BookPlus className="size-3.5 text-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isSaved
                    ? 'In library'
                    : isSaving
                      ? 'Saving to library...'
                      : 'Save to library'}
                </TooltipContent>
              </Tooltip>

              {/* Save to Collection Dropdown */}
              {collectionList.length > 0 && !isSaved && (
                <DropdownMenu>
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isSaving || isSaved}
                          className="h-7 w-4.5 rounded-l-none rounded-r-md px-0 text-foreground cursor-pointer"
                          aria-label="Save to specific collection"
                        >
                          <ChevronDown className="size-3 text-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Save to collection...
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent
                    align="end"
                    side="bottom"
                    sideOffset={4}
                    className="w-56 p-1 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-50 select-none"
                  >
                    <div className="px-2 py-1.5 text-11 font-medium text-muted-foreground">
                      Save to collection...
                    </div>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem
                      onClick={() => onSaveEntry(entry)}
                      className="h-7.5 px-2 text-12 font-medium cursor-pointer rounded hover:bg-muted"
                    >
                      <BookPlus className="size-3.5 mr-2 text-muted-foreground" />
                      <span>My Library (Root)</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <div className="max-h-48 overflow-y-auto space-y-0.5 scrollbar-none">
                      {collectionList.map((col: Collection) => (
                        <DropdownMenuItem
                          key={col.id}
                          onClick={() => onSaveEntry(entry, col.id)}
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
          )}
        </div>
      </div>

      {/* Abstract with Expand / Collapse */}
      {entry.abstract && (
        <div className="w-full">
          <p
            className={cn(
              'text-[13px] leading-relaxed text-muted-foreground transition-all',
              !isExpanded && 'line-clamp-2',
            )}
          >
            {entry.abstract}
          </p>
          {entry.abstract.length > 140 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleAbstract(entry.id);
              }}
              className="inline-flex items-center gap-1 text-12 font-medium text-muted-foreground hover:text-foreground hover:underline mt-1 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs"
            >
              {isExpanded ? (
                <>
                  <span>Show less</span>
                  <ChevronUp className="size-3" />
                </>
              ) : (
                <>
                  <span>Show more</span>
                  <ChevronDown className="size-3" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Metadata & Links */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-12 text-foreground">
        {(() => {
          const dateVal =
            entry.publishedAt || (entry.year ? String(entry.year) : null);
          if (!dateVal) return null;
          let formattedDate: string | null = null;
          if (entry.publishedAt) {
            const d = new Date(entry.publishedAt);
            if (!isNaN(d.getTime())) {
              formattedDate = new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }).format(d);
            }
          }
          const displayDate =
            formattedDate || (entry.year ? String(entry.year) : dateVal);
          return (
            <span className="inline-flex items-center gap-1.5 font-medium shrink-0">
              <Calendar className="size-3.5 text-foreground shrink-0" />
              <span>{displayDate}</span>
            </span>
          );
        })()}

        {entry.publicationTitle && entry.publicationTitle !== feedTitle && (
          <span
            className="inline-flex items-center font-normal shrink-0 min-w-0 max-w-full truncate"
            title={entry.publicationTitle}
          >
            {entry.publicationTitle}
          </span>
        )}

        {(entry.primaryCategory ||
          (entry.categories && entry.categories.length > 0)) && (
          <span
            className="inline-flex items-center font-normal text-muted-foreground shrink-0 min-w-0 max-w-full truncate"
            title={entry.primaryCategory || entry.categories?.[0]}
          >
            {entry.primaryCategory || entry.categories?.[0]}
          </span>
        )}

        {entry.arxivId ? (
          <a
            href={`https://arxiv.org/abs/${encodeURI(entry.arxivId.trim())}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 hover:underline cursor-pointer shrink-0 min-w-0 max-w-full"
            title={`arXiv:${entry.arxivId}`}
          >
            <Bookmark className="size-3.5 text-foreground shrink-0" />
            <span>arXiv:{entry.arxivId}</span>
          </a>
        ) : entry.doi ? (
          <a
            href={`https://doi.org/${encodeURI(entry.doi.trim())}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center hover:underline cursor-pointer shrink-0 min-w-0 max-w-full"
            title={`DOI: ${entry.doi}`}
          >
            DOI: {entry.doi}
          </a>
        ) : null}

        {(() => {
          const targetUrl =
            safeHttpUrl(entry.pdfUrl) || safeHttpUrl(entry.url);
          if (!targetUrl) return null;
          let displayLabel = targetUrl;
          try {
            const parsed = new URL(targetUrl);
            const cleanHost = parsed.hostname.replace(/^www\./, '');
            const cleanPath =
              parsed.pathname === '/'
                ? ''
                : parsed.pathname.replace(/\/$/, '');
            displayLabel = `${cleanHost}${cleanPath}`;
          } catch {
            displayLabel = targetUrl.replace(/^https?:\/\/(www\.)?/, '');
          }
          return (
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                onMarkEntryAsRead(entry.id);
              }}
              className="inline-flex items-center gap-1.5 hover:underline cursor-pointer shrink-0 min-w-0 max-w-full text-foreground/90 hover:text-foreground"
              title={targetUrl}
            >
              <ExternalLink className="size-3.5 text-foreground shrink-0" />
              <span className="truncate">{displayLabel}</span>
            </a>
          );
        })()}
      </div>
    </article>
  );
}

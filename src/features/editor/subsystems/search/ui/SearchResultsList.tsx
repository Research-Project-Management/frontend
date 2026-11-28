'use client';

/**
 * SearchResultsList.tsx
 *
 * Virtualized/standard file-grouped search results list with inline replace trigger.
 */

import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight, FileCode2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { SEARCH_RESULTS_VIRTUAL_THRESHOLD } from '@/features/editor/domain/constants/editor.constants';

export interface MatchEntry {
  line: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

export interface FileSearchResult {
  fileId: string;
  fileName: string;
  isCurrent: boolean;
  matches: MatchEntry[];
}

type FlatSearchRow =
  | { kind: 'file-header'; key: string; file: FileSearchResult; isCollapsed: boolean }
  | { kind: 'match'; key: string; file: FileSearchResult; match: MatchEntry; matchIdx: number };

export interface SearchResultsListProps {
  effectiveQuery: string;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  truncated?: boolean;
  fileResults: FileSearchResult[];
  collapsedFiles: Set<string>;
  showReplace: boolean;
  onToggleCollapse: (fileId: string) => void;
  onNavigate: (
    fileId: string,
    fileName: string,
    line: number,
    matchStart: number,
    matchEnd: number,
  ) => void;
  onReplaceSingle: (
    fileId: string,
    line: number,
    matchStart: number,
    matchEnd: number,
  ) => void;
}

export function SearchResultsList({
  effectiveQuery,
  isFetching,
  isError,
  error,
  truncated,
  fileResults,
  collapsedFiles,
  showReplace,
  onToggleCollapse,
  onNavigate,
  onReplaceSingle,
}: SearchResultsListProps) {
  const totalMatches = useMemo(
    () => fileResults.reduce((acc, f) => acc + f.matches.length, 0),
    [fileResults],
  );

  const flatRows = useMemo<FlatSearchRow[]>(() => {
    const rows: FlatSearchRow[] = [];
    for (const file of fileResults) {
      const isCollapsed = collapsedFiles.has(file.fileId);
      rows.push({
        kind: 'file-header',
        key: `header-${file.fileId}`,
        file,
        isCollapsed,
      });
      if (!isCollapsed) {
        file.matches.forEach((match, idx) => {
          rows.push({
            kind: 'match',
            key: `match-${file.fileId}-${idx}`,
            file,
            match,
            matchIdx: idx,
          });
        });
      }
    }
    return rows;
  }, [fileResults, collapsedFiles]);

  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const isVirtualized = flatRows.length >= SEARCH_RESULTS_VIRTUAL_THRESHOLD;
  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => resultsScrollRef.current,
    estimateSize: (idx) => (flatRows[idx]?.kind === 'file-header' ? 32 : 30),
    overscan: 10,
    enabled: isVirtualized,
  });

  const renderFileHeaderButton = (file: FileSearchResult, isCollapsed: boolean) => (
    <button
      type="button"
      onClick={() => onToggleCollapse(file.fileId)}
      aria-expanded={!isCollapsed}
      className="flex h-8 w-full items-center gap-1.5 px-3 text-left text-xs transition-colors hover:bg-sidebar-hover cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring select-none border-b border-border/10"
    >
      {isCollapsed ? (
        <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
      ) : (
        <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
      )}
      <FileCode2 className="size-3.5 text-foreground shrink-0" />
      <span className="text-xs font-semibold text-foreground/90 flex-1 min-w-0 truncate font-mono">
        {file.fileName}
      </span>
      {file.isCurrent && (
        <span className="text-10 px-1 py-0 rounded-sm bg-primary/10 text-primary font-sans leading-tight">
          active
        </span>
      )}
      <span className="text-10 font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm leading-none">
        {file.matches.length}
      </span>
    </button>
  );

  const renderMatchRowContent = (file: FileSearchResult, match: MatchEntry) => (
    <>
      <button
        type="button"
        onClick={() =>
          onNavigate(
            file.fileId,
            file.fileName,
            match.line,
            match.matchStart,
            match.matchEnd,
          )
        }
        className="flex flex-1 min-w-0 cursor-pointer items-start gap-2.5 px-3 py-1.5 pl-7 text-left text-xs transition-colors hover:bg-primary/5 outline-none focus-visible:bg-muted"
      >
        <span className="text-muted-foreground/70 w-7 text-right shrink-0 font-mono text-11 pt-0.5">
          {match.line}
        </span>
        <span className="truncate font-mono text-xs text-foreground/80 leading-snug">
          {match.text.slice(0, match.matchStart)}
          <span className="bg-warning/25 text-foreground font-semibold rounded-sm px-0.5">
            {match.text.slice(match.matchStart, match.matchEnd)}
          </span>
          {match.text.slice(match.matchEnd)}
        </span>
      </button>
      {showReplace && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Replace this occurrence"
              onClick={(e) => {
                e.stopPropagation();
                onReplaceSingle(
                  file.fileId,
                  match.line,
                  match.matchStart,
                  match.matchEnd,
                );
              }}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 mr-2 px-1.5 py-0.5 rounded text-10 font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-opacity cursor-pointer"
            >
              Replace
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-xs">
            Replace this occurrence
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );

  if (!effectiveQuery) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="py-12 px-2">
            <PlaneEmptyState
              variant="search"
              isCompact
              title="Search project files"
              description="Type a query above to search or replace across all documents in this project."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div
        role="status"
        aria-live="polite"
        className="shrink-0 border-b border-border px-3 py-1.5 text-11 font-medium text-muted-foreground bg-muted/10 flex items-center justify-between"
      >
        <span>
          {isFetching
            ? 'Searching project files...'
            : `${totalMatches} result${totalMatches !== 1 ? 's' : ''} in ${fileResults.length} file${fileResults.length !== 1 ? 's' : ''}`}
        </span>
        {truncated && (
          <span className="text-warning text-10 font-medium">Capped at 1,000</span>
        )}
      </div>

      <div ref={resultsScrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {fileResults.length > 0 ? (
          isVirtualized ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = flatRows[virtualRow.index];
                if (!row) return null;
                return (
                  <div
                    key={row.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className={
                      row.kind === 'file-header'
                        ? 'bg-muted border-b border-border/30'
                        : 'group relative flex items-center justify-between bg-muted/5 border-b border-border/15'
                    }
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {row.kind === 'file-header'
                      ? renderFileHeaderButton(row.file, row.isCollapsed)
                      : renderMatchRowContent(row.file, row.match)}
                  </div>
                );
              })}
            </div>
          ) : (
            <ul className="divide-y divide-border/30">
              {fileResults.map((file) => {
                const isCollapsed = collapsedFiles.has(file.fileId);
                return (
                  <li key={file.fileId} className="bg-muted">
                    {renderFileHeaderButton(file, isCollapsed)}
                    {!isCollapsed && (
                      <ul className="divide-y divide-border/15 bg-muted/5">
                        {file.matches.map((match, idx) => (
                          <li
                            key={idx}
                            className="group relative flex items-center justify-between"
                          >
                            {renderMatchRowContent(file, match)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        ) : isError ? (
          <div className="py-8 px-2">
            <PlaneErrorState
              isCompact
              title="Search failed"
              description="An issue occurred while searching project files."
              error={error || new Error('Search failed')}
            />
          </div>
        ) : (
          <div className="py-8 px-2">
            <PlaneEmptyState
              variant="search"
              isCompact
              title="No results found"
              description={`No matching text found for "${effectiveQuery}".`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

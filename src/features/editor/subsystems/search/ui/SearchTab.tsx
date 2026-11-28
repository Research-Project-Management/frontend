'use client';

/**
 * SearchTab.tsx
 *
 * Canonical Full Project Regex and Text Search Viewlet (Block 6: UI Features Layer).
 * Location: `features/editor/subsystems/search/ui/SearchTab.tsx`
 */

import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search as SearchIcon,
  X,
  Loader2,
  Replace,
} from "lucide-react";
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from "@/shared/lib/utils";
import { useShallow } from 'zustand/react/shallow';
import {
  useSearchStore,
  useEditorScope,
  editorCommandBus,
  sessionCoordinator,
} from "@/features/editor/core";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { pagesService } from "@/features/editor/sdk/pages.service";
import { useEditorInstance } from "@/features/editor/core/hooks/useEditorInstance";
import { SidebarPanelHeader } from '@/features/editor/core/shell/SidebarPanelHeader';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import { useSearchActions } from '../hooks/useSearchActions';
import { SearchResultsList, type FileSearchResult } from './SearchResultsList';

export default function SearchTab() {
  const { engine } = useEditorInstance();
  const {
    spaceId: effectiveSpaceOrProjectId,
    rootPageId,
    activeFileId,
    effectiveScopeId: rootProjectId,
  } = useEditorScope();
  const explicitPageId = rootPageId || undefined;

  const {
    query,
    setQuery,
    instantQuery,
    setInstantQuery,
    replaceText,
    setReplaceText,
    showReplace,
    setShowReplace,
    caseSensitive,
    setCaseSensitive,
    wholeWord,
    setWholeWord,
    useRegex,
    setUseRegex,
    collapsedFiles,
    toggleFileCollapsed,
  } = useSearchStore(
    useShallow((s) => ({
      query: s.query,
      setQuery: s.setQuery,
      instantQuery: s.instantQuery,
      setInstantQuery: s.setInstantQuery,
      replaceText: s.replaceText,
      setReplaceText: s.setReplaceText,
      showReplace: s.showReplace,
      setShowReplace: s.setShowReplace,
      caseSensitive: s.caseSensitive,
      setCaseSensitive: s.setCaseSensitive,
      wholeWord: s.wholeWord,
      setWholeWord: s.setWholeWord,
      useRegex: s.useRegex,
      setUseRegex: s.setUseRegex,
      collapsedFiles: s.collapsedFiles,
      toggleFileCollapsed: s.toggleFileCollapsed,
    }))
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedQuery = useDebounce(query, 250);
  const effectiveQuery = instantQuery !== null ? instantQuery : debouncedQuery;

  const {
    isReplacingAll,
    handleReplaceAllCurrentFile,
    handleReplaceAllEverywhere,
    handleReplaceSingleMatch,
  } = useSearchActions({
    engine,
    effectiveQuery,
    replaceText,
    useRegex,
    wholeWord,
    caseSensitive,
    rootProjectId: effectiveSpaceOrProjectId,
    rootPageId,
    activeFileId: activeFileId ?? null,
  });

  const handleSearch = useCallback(() => {
    setInstantQuery(query);
    searchInputRef.current?.focus();
  }, [query, setInstantQuery]);

  // Auto-focus input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
    };
  }, []);

  // Listen for sidebar:open-panel events with prefilled query
  useEffect(() => {
    const unsub = editorCommandBus.subscribe("sidebar:open-panel", (cmd) => {
      if (cmd.panel === "Search") {
        if (cmd.query !== undefined) {
          setQuery(cmd.query);
        }
        if (cmd.showReplace !== undefined) {
          setShowReplace(cmd.showReplace);
        }
        if (focusTimerRef.current) {
          clearTimeout(focusTimerRef.current);
        }
        focusTimerRef.current = setTimeout(() => {
          focusTimerRef.current = null;
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      }
    });
    return () => {
      unsub();
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [setQuery, setShowReplace]);

  // ─── BACKEND SEARCH QUERY ──────────────────────────────────────────────────
  const {
    data: backendSearchData,
    isFetching,
    error: searchError,
    isError: isSearchError,
  } = useQuery({
    queryKey: [
      "project-document-search",
      rootProjectId,
      effectiveSpaceOrProjectId,
      explicitPageId ?? null,
      effectiveQuery,
      caseSensitive,
      wholeWord,
      useRegex,
    ],
    queryFn: async () => {
      if (!effectiveQuery.trim() || (!effectiveSpaceOrProjectId && !explicitPageId)) {
        return null;
      }
      await sessionCoordinator.syncBeforeServerRead(effectiveSpaceOrProjectId || explicitPageId);
      return pagesService.search.search(effectiveSpaceOrProjectId, effectiveQuery, {
        caseSensitive,
        wholeWord,
        useRegex,
        ...(explicitPageId ? { pageId: explicitPageId } : {}),
      });
    },
    enabled: !!effectiveQuery.trim() && Boolean(effectiveSpaceOrProjectId || explicitPageId),
    staleTime: 15_000,
    gcTime: 2 * 60_000,
  });

  // Map authoritative backend search results
  const fileResults = useMemo<FileSearchResult[]>(() => {
    if (!effectiveQuery.trim() || !backendSearchData || !Array.isArray(backendSearchData.results)) {
      return [];
    }

    return backendSearchData.results.map((file) => ({
      fileId: file.fileId,
      fileName: file.fileName,
      isCurrent: file.fileId === activeFileId,
      matches: file.matches.map((m) => ({
        line: m.line,
        text: m.text,
        matchStart: m.matchStart,
        matchEnd: m.matchEnd,
      })),
    }));
  }, [effectiveQuery, backendSearchData, activeFileId]);

  const toggleFileCollapse = useCallback((fileId: string) => {
    toggleFileCollapsed(fileId);
  }, [toggleFileCollapsed]);

  const handleNavigate = useCallback(
    (fileId: string, fileName: string, line: number, matchStart: number, matchEnd: number) => {
      const isCurrent = fileId === activeFileId;
      const length = Math.max(0, matchEnd - matchStart);

      if (isCurrent) {
        if (!engine) return;
        engine.jumpToLine(line, undefined, matchStart, length);
        engine.focus();
      } else {
        navigationCoordinator.openDocument({
          fileId,
          title: fileName,
          line,
          column: matchStart,
        });
      }
    },
    [activeFileId, engine],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Header */}
      <SidebarPanelHeader
        title="Search"
      />

      {/* Search Input Controls */}
      <div className="border-b border-border px-3 pb-3 pt-1 space-y-2 bg-background select-none">
        {/* Row 1: Search Input with integrated Search Icon */}
        <div className="relative w-full">
          <SearchIcon
            className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground pointer-events-none shrink-0"
            strokeWidth={1.5}
          />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(e) => {
              setInstantQuery(null);
              setQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            aria-label="Search all project files"
            placeholder="Search all project files..."
            className="h-8 pl-8 pr-8 text-xs bg-background border-border/80 focus-visible:ring-1 focus-visible:ring-ring rounded-md w-full placeholder:text-muted-foreground"
          />
          {isFetching ? (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin motion-reduce:animate-none text-muted-foreground pointer-events-none shrink-0" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setInstantQuery("");
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground hover:opacity-80 outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs cursor-pointer after:absolute after:-inset-1.5 after:content-['']"
            >
              <X className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>

        {/* Row 2: Search Options (Aa, [.*], W - Overleaf 1:1 Parity) */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setCaseSensitive(!caseSensitive)}
                aria-label="Match Case"
                aria-pressed={caseSensitive}
                className={cn(
                  "size-7 rounded-md text-xs font-medium transition-colors flex items-center justify-center cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring relative after:absolute after:-inset-1.5 after:content-['']",
                  caseSensitive
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium",
                )}
              >
                Aa
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="text-xs">
              Match Case (Aa)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setUseRegex(!useRegex)}
                aria-label="Regular Expression"
                aria-pressed={useRegex}
                className={cn(
                  "size-7 rounded-md text-xs font-mono transition-colors flex items-center justify-center cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring relative after:absolute after:-inset-1.5 after:content-['']",
                  useRegex
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium",
                )}
              >
                [.*]
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="text-xs">
              Regular Expression ([.*])
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setWholeWord(!wholeWord)}
                aria-label="Whole Word"
                aria-pressed={wholeWord}
                className={cn(
                  "size-7 rounded-md text-xs font-semibold transition-colors flex items-center justify-center cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring relative after:absolute after:-inset-1.5 after:content-['']",
                  wholeWord
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium",
                )}
              >
                W
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="text-xs">
              Whole Word (W)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setShowReplace(!showReplace)}
                aria-label="Toggle Replace"
                aria-pressed={showReplace}
                className={cn(
                  "ml-auto size-7 rounded-md text-xs font-medium transition-colors flex items-center justify-center cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring relative after:absolute after:-inset-1.5 after:content-['']",
                  showReplace
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium",
                )}
              >
                <Replace className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="text-xs">
              Toggle Replace (Ctrl+H)
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Row 3: Replace Input & Actions (When Replace is toggled on) */}
        {showReplace && (
          <div className="space-y-1.5 pt-1 border-t border-border/40 animate-in fade-in-50 duration-150">
            <div className="relative w-full">
              <Replace
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none shrink-0"
                strokeWidth={1.5}
              />
              <Input
                ref={replaceInputRef}
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                aria-label="Replace with"
              placeholder="Replace with..."
                className="h-8 pl-8 pr-8 text-xs bg-background border-border/80 focus-visible:ring-1 focus-visible:ring-ring rounded-md w-full placeholder:text-muted-foreground"
              />
              {replaceText ? (
                <button
                  type="button"
                  onClick={() => {
                    setReplaceText("");
                    replaceInputRef.current?.focus();
                  }}
                  aria-label="Clear replace"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs cursor-pointer after:absolute after:-inset-1.5 after:content-['']"
                >
                  <X className="size-3.5 shrink-0" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!effectiveQuery || isReplacingAll}
                onClick={handleReplaceAllCurrentFile}
                className="h-6 px-2 text-11 font-normal cursor-pointer"
              >
                In File
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={!effectiveQuery || isReplacingAll}
                onClick={handleReplaceAllEverywhere}
                className="h-6 px-2 text-11 font-normal cursor-pointer"
              >
                {isReplacingAll ? (
                  <>
                    <Loader2 className="size-3 animate-spin mr-1 shrink-0" />
                    Replacing…
                  </>
                ) : (
                  "Replace All"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <SearchResultsList
        effectiveQuery={effectiveQuery}
        isFetching={isFetching}
        isError={isSearchError}
        error={searchError instanceof Error ? searchError : null}
        truncated={backendSearchData?.truncated}
        fileResults={fileResults}
        collapsedFiles={collapsedFiles}
        showReplace={showReplace}
        onToggleCollapse={toggleFileCollapse}
        onNavigate={handleNavigate}
        onReplaceSingle={handleReplaceSingleMatch}
      />
    </div>
  );
}

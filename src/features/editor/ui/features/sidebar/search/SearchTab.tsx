'use client';

/**
 * SearchTab.tsx
 *
 * Canonical Full Project Regex and Text Search Viewlet (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/sidebar/search/SearchTab.tsx`
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useProjectSearchActions } from "./useProjectSearchActions";
import {
  Search as SearchIcon,
  X,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Loader2,
  Replace,
} from "lucide-react";
import { Input } from '@/shared/components/ui/input';
import { cn } from "@/shared/lib/utils";
import { usePageStore } from "@/features/editor/store/editor.store";
import { useTabsStore } from "@/features/editor/store/tabs.store";
import { useSearchStore } from "@/features/editor/store/search.store";
import { filesQuery } from "@/features/editor/ui/hooks/document.queries";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { documentSearchService } from "@/features/editor/sdk/manuscript.service";
import { useEditorInstance } from "@/features/editor/ui/hooks/use-editor-instance";
import { editorCommandBus } from "@/features/editor/coordinators/command-bus";
import { extractProjectId } from "@/features/editor/domain/types/core.types";
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { SidebarPanelHeader } from "../SidebarPanelHeader";

interface MatchEntry {
  line: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

interface FileSearchResult {
  fileId: string;
  fileName: string;
  isCurrent: boolean;
  matches: MatchEntry[];
}

export default function SearchTab({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ projectId?: string; pageId?: string }>();

  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const storeProjectId = usePageStore((s) => s.projectId);
  const { engine, getContent } = useEditorInstance();
  const openTab = useTabsStore((s) => s.openTab);

  const rootPageId = params?.pageId || params?.projectId || currentPage?.id || "";
  const rootProjectId = params?.projectId || storeProjectId || extractProjectId(currentPage) || params?.pageId || currentPage?.id || "";
  const activeFileId = searchParams.get("file") ?? activeFilePage?.id ?? currentPage?.id;

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
    withinSelection,
    toggleWithinSelection,
    searchScope,
    setSearchScope,
    collapsedFiles,
    toggleFileCollapsed,
  } = useSearchStore();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);
  const effectiveQuery = instantQuery !== null ? instantQuery : debouncedQuery;

  const {
    isReplacingAll,
    handleReplaceAllCurrentFile,
    handleReplaceAllEverywhere,
    handleReplaceSingleMatch,
  } = useProjectSearchActions({
    engine,
    effectiveQuery,
    replaceText,
    useRegex,
    wholeWord,
    caseSensitive,
    rootProjectId,
    rootPageId,
    activeFileId: activeFileId ?? null,
  });

  const handleSearch = useCallback(() => {
    setInstantQuery(query);
    searchInputRef.current?.focus();
  }, [query]);

  // Auto-focus input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
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
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      }
    });
    return unsub;
  }, [setQuery, setShowReplace]);

  // Fetch all text files in project
  const { data: projectFiles = [] } = useQuery({
    ...filesQuery(rootPageId),
    enabled: !!rootPageId,
  });

  // Assemble full searchable files list for client buffer sync
  const searchableFiles = useMemo(() => {
    const activeContent = getContent() || activeFilePage?.content || currentPage?.content || "";

    if (!projectFiles || projectFiles.length === 0) {
      return [
        {
          id: currentPage?.id || "main",
          title: currentPage?.title || "main.tex",
          content: activeContent,
          isCurrent: true,
        },
      ];
    }

    return projectFiles.map((file: any) => {
      const isCurrent = file.id === activeFileId;
      return {
        id: file.id,
        title: file.title || "untitled.tex",
        content: isCurrent ? activeContent : (file.content ?? ""),
        isCurrent,
      };
    });
  }, [projectFiles, activeFileId, getContent, activeFilePage?.content, currentPage?.id, currentPage?.title, currentPage?.content]);

  // ─── BACKEND SEARCH QUERY ──────────────────────────────────────────────────
  const {
    data: backendSearchData,
    isLoading: isSearching,
    isFetching,
    error: searchError,
    isError: isSearchError,
  } = useQuery({
    queryKey: [
      "project-document-search",
      rootProjectId,
      effectiveQuery,
      caseSensitive,
      wholeWord,
      useRegex,
    ],
    queryFn: async () => {
      if (!effectiveQuery.trim() || !rootProjectId) {
        return null;
      }
      return documentSearchService.search(rootProjectId, effectiveQuery, {
        caseSensitive,
        wholeWord,
        useRegex,
      });
    },
    enabled: !!effectiveQuery.trim() && !!rootProjectId,
    staleTime: 5000,
  });

  // Execute project-wide search: backend with client buffer fallback
  const fileResults = useMemo<FileSearchResult[]>(() => {
    if (!effectiveQuery.trim()) return [];

    if (!withinSelection && searchScope === 'project' && backendSearchData && Array.isArray(backendSearchData.results)) {
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
    }

    let pattern = effectiveQuery;
    if (!useRegex) pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (wholeWord) pattern = `\\b${pattern}\\b`;
    const flags = caseSensitive ? "g" : "gi";

    let re: RegExp;
    try {
      re = new RegExp(pattern, flags);
    } catch {
      return [];
    }

    const selRange = withinSelection ? engine?.getSelection?.() : null;
    const hasSelection = Boolean(
      selRange && (selRange.startLine !== selRange.endLine || selRange.startColumn !== selRange.endColumn)
    );

    const results: FileSearchResult[] = [];

    for (const file of searchableFiles) {
      if ((searchScope === 'file' || withinSelection) && !file.isCurrent) {
        continue;
      }

      const lines = file.content.split("\n");
      const fileMatches: MatchEntry[] = [];

      lines.forEach((lineText: string, idx: number) => {
        const lineNum = idx + 1;
        if (withinSelection && hasSelection && selRange) {
          if (lineNum < selRange.startLine || lineNum > selRange.endLine) return;
        }

        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(lineText)) !== null) {
          const matchStart = m.index;
          const matchEnd = m.index + m[0].length;

          if (withinSelection && hasSelection && selRange) {
            if (lineNum === selRange.startLine && matchStart < selRange.startColumn) {
              if (m[0].length === 0) re.lastIndex++;
              continue;
            }
            if (lineNum === selRange.endLine && matchEnd > selRange.endColumn) {
              if (m[0].length === 0) re.lastIndex++;
              continue;
            }
          }

          fileMatches.push({
            line: lineNum,
            text: lineText,
            matchStart,
            matchEnd,
          });
          if (m[0].length === 0) {
            re.lastIndex++;
          }
        }
      });

      if (fileMatches.length > 0) {
        results.push({
          fileId: file.id,
          fileName: file.title,
          isCurrent: file.isCurrent,
          matches: fileMatches,
        });
      }
    }

    return results;
  }, [
    effectiveQuery,
    backendSearchData,
    activeFileId,
    useRegex,
    wholeWord,
    caseSensitive,
    searchableFiles,
    withinSelection,
    searchScope,
    engine,
  ]);

  const totalMatches = useMemo(
    () => fileResults.reduce((acc, f) => acc + f.matches.length, 0),
    [fileResults],
  );

  const toggleFileCollapse = useCallback((fileId: string) => {
    toggleFileCollapsed(fileId);
  }, [toggleFileCollapsed]);

  const handleNavigate = useCallback(
    (fileId: string, fileName: string, line: number, _matchStart: number, _matchEnd: number) => {
      const isCurrent = fileId === activeFileId;

      if (isCurrent) {
        if (!engine) return;
        engine.jumpToLine(line);
        engine.focus();
      } else {
        if (rootPageId) {
          openTab(rootPageId, { id: fileId, title: fileName });
        }
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        current.set("file", fileId);
        router.push(`${pathname}?${current.toString()}`);

        setTimeout(() => {
          editorCommandBus.dispatch({ type: 'editor:jump-to-line', line });
        }, 250);
      }
    },
    [activeFileId, engine, rootPageId, openTab, searchParams, router, pathname],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Header */}
      <SidebarPanelHeader
        title="Search"
        onClose={onClose}
        closeAriaLabel="Close search"
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
            placeholder={
              withinSelection
                ? "Search within selection..."
                : searchScope === "file"
                  ? "Search current file..."
                  : "Search all project files..."
            }
            className="h-8 pl-8 pr-8 text-xs bg-background border-border/80 focus-visible:ring-1 focus-visible:ring-primary rounded-md w-full placeholder:text-muted-foreground"
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-xs cursor-pointer after:absolute after:-inset-1.5 after:content-['']"
            >
              <X className="size-3.5 shrink-0" />
            </button>
          ) : null}
        </div>

        {/* Row 2: Search Options (Aa, [.*], W, In Selection) and Replace Toggle */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCaseSensitive(!caseSensitive)}
              title="Match Case (Aa)"
              aria-label="Match Case"
              aria-pressed={caseSensitive}
              className={cn(
                "size-7 rounded-md text-xs font-medium transition-colors flex items-center justify-center cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary",
                caseSensitive
                  ? "bg-muted text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium",
              )}
            >
              Aa
            </button>

            <button
              type="button"
              onClick={() => setUseRegex(!useRegex)}
              title="Regular Expression ([.*])"
              aria-label="Regular Expression"
              aria-pressed={useRegex}
              className={cn(
                "size-7 rounded-md text-xs font-mono transition-colors flex items-center justify-center cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary",
                useRegex
                  ? "bg-muted text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium",
              )}
            >
              [.*]
            </button>

            <button
              type="button"
              onClick={() => setWholeWord(!wholeWord)}
              title="Whole Word (W)"
              aria-label="Whole Word"
              aria-pressed={wholeWord}
              className={cn(
                "size-7 rounded-md text-xs font-semibold transition-colors flex items-center justify-center cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary",
                wholeWord
                  ? "bg-muted text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium",
              )}
            >
              W
            </button>

            <button
              type="button"
              onClick={() => toggleWithinSelection()}
              title="Find in selection"
              aria-label="Find in selection"
              aria-pressed={withinSelection}
              className={cn(
                "size-7 rounded-md text-xs font-semibold transition-colors flex items-center justify-center cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary",
                withinSelection
                  ? "bg-primary/15 text-primary font-semibold border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium",
              )}
            >
              <span className="text-[10px] font-mono border border-current px-0.5 rounded-[2px] leading-tight">⇥⇤</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowReplace(!showReplace)}
            title={showReplace ? "Hide Replace" : "Show Replace (Ctrl+Shift+H)"}
            aria-label="Toggle Replace"
            aria-pressed={showReplace}
            className={cn(
              "h-7 px-2 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary",
              showReplace
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium",
            )}
          >
            <Replace className="size-3.5 shrink-0" />
            <span>Replace</span>
          </button>
        </div>

        {/* Row 2.5: Search Scope Bar (Overleaf Parity: Search All Project Files vs Current File) */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5 px-0.5 select-none">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchScope('project')}
              className={cn(
                "transition-colors cursor-pointer outline-none focus-visible:underline",
                searchScope === 'project' && !withinSelection ? "text-foreground font-semibold underline underline-offset-2" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All project files
            </button>
            <span className="opacity-40">•</span>
            <button
              type="button"
              onClick={() => setSearchScope('file')}
              className={cn(
                "transition-colors cursor-pointer outline-none focus-visible:underline",
                searchScope === 'file' && !withinSelection ? "text-foreground font-semibold underline underline-offset-2" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Current file
            </button>
          </div>
          {withinSelection && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
              In selection
            </span>
          )}
        </div>

        {/* Replace Input */}
        {showReplace && (
          <div className="space-y-1.5 pt-2 border-t border-border/50 animate-in fade-in duration-150">
            <div className="relative">
              <Input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace with…"
                className="h-8 px-3 text-xs bg-background border-border/80 rounded-md w-full"
              />
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={handleReplaceAllCurrentFile}
                disabled={!effectiveQuery}
                aria-label="Replace in active file"
                className="h-7 rounded-md bg-muted px-2.5 text-11 font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50 cursor-pointer"
                title="Replace all matches in current active file"
              >
                In Current File
              </button>
              <button
                type="button"
                onClick={handleReplaceAllEverywhere}
                disabled={!effectiveQuery || isReplacingAll}
                aria-label="Replace all in project"
                className="h-7 rounded-md bg-primary px-2.5 text-11 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                title="Replace all matches across all project files"
              >
                {isReplacingAll ? "Replacing..." : "All Files"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto">
        {effectiveQuery ? (
          <>
            <div
              role="status"
              aria-live="polite"
              className="border-b border-border px-3 py-1.5 text-11 font-medium text-muted-foreground bg-muted/10 flex items-center justify-between"
            >
              <span>
                {isFetching
                  ? "Searching project files..."
                  : `${totalMatches} result${totalMatches !== 1 ? "s" : ""} in ${fileResults.length} file${fileResults.length !== 1 ? "s" : ""}`}
              </span>
              {backendSearchData?.truncated && (
                <span className="text-warning text-10 font-medium">
                  Capped at 1,000
                </span>
              )}
            </div>

            {fileResults.length > 0 ? (
              <ul className="divide-y divide-border/30">
                {fileResults.map((file) => {
                  const isCollapsed = collapsedFiles.has(file.fileId);
                  return (
                    <li key={file.fileId} className="bg-muted">
                      {/* File Accordion Header */}
                      <button
                        type="button"
                        onClick={() => toggleFileCollapse(file.fileId)}
                        aria-expanded={!isCollapsed}
                        className="flex h-8 w-full items-center gap-1.5 px-3 text-left text-xs transition-colors hover:bg-sidebar-hover cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none border-b border-border/10"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        <FileCode2 className="size-3.5 text-foreground shrink-0" />
                        <span className="text-xs font-semibold text-foreground/90 flex-1 truncate font-mono">
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

                      {/* File Match Entries */}
                      {!isCollapsed && (
                        <ul className="divide-y divide-border/15 bg-muted/5">
                          {file.matches.map((match, idx) => (
                            <li key={idx} className="group relative flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() =>
                                  handleNavigate(
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

                              {/* Single Match Replace Button (Overleaf Parity) */}
                              {showReplace && file.isCurrent && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReplaceSingleMatch(
                                      file.fileId,
                                      match.line,
                                      match.matchStart,
                                      match.matchEnd,
                                    );
                                  }}
                                  title="Replace this occurrence"
                                  aria-label={`Replace match on line ${match.line}`}
                                  className="mr-2 h-6 px-1.5 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground text-10 font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0"
                                >
                                  <Replace className="size-3 shrink-0" />
                                  <span>Replace</span>
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : isSearchError ? (
              <div className="py-8 px-2">
                <PlaneErrorState
                  title="Search failed"
                  description="An issue occurred while searching project files."
                  error={searchError || new Error("Search failed")}
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
          </>
        ) : (
          <div className="py-12 px-2">
            <PlaneEmptyState
              variant="search"
              isCompact
              title="Search project files"
              description="Type a query above to search or replace across all documents in this project."
            />
          </div>
        )}
      </div>
    </div>
  );
}

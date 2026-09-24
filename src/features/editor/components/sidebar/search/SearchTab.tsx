'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search as SearchIcon,
  X,
  FileText,
  ChevronDown,
  ChevronRight,
  Replace,
  FileCode2,
} from "lucide-react";
import { Input } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { usePageStore, useTabsStore } from "@/features/editor/store";
import { filesQuery } from "@/features/editor/hooks/use-core";
import { useDebounce } from "@/shared/hooks";
import { EditorEventBus } from "@/features/editor/utils/editor.util";
import { documentSearchService } from "@/features/editor/services/search.service";
import { useEditorInstance } from "@/features/editor/core/context/editor-instance.context";
import { editorCommandBus } from "@/features/editor/core/command-bus/editor-command-bus";

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

  const { currentPage, activeFilePage } = usePageStore();
  const { engine, getContent } = useEditorInstance();
  const openTab = useTabsStore((s) => s.openTab);

  const rootPageId = params?.pageId || params?.projectId || currentPage?.id || "";
  const activeFileId = searchParams.get("file") ?? activeFilePage?.id ?? currentPage?.id;

  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [isReplacingAll, setIsReplacingAll] = useState(false);
  const queryClient = useQueryClient();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  // Auto-focus input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Listen for flux:open-panel events with prefilled query (bridge from In-File Search / Editor)
  useEffect(() => {
    const unsub = EditorEventBus.on("flux:open-panel", (detail) => {
      if (typeof detail === "object" && detail.panel === "Search" && detail.query !== undefined) {
        setQuery(detail.query);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      }
    });
    return unsub;
  }, []);

  // Fetch all text files in project
  const { data: projectFiles = [] } = useQuery({
    ...filesQuery(rootPageId),
    enabled: !!rootPageId,
  });

  // Assemble full searchable files list
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

  // Execute project-wide search
  const fileResults = useMemo<FileSearchResult[]>(() => {
    if (!debouncedQuery.trim()) return [];

    let pattern = debouncedQuery;
    if (!useRegex) pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (wholeWord) pattern = `\\b${pattern}\\b`;
    const flags = caseSensitive ? "g" : "gi";

    let re: RegExp;
    try {
      re = new RegExp(pattern, flags);
    } catch {
      return [];
    }

    const results: FileSearchResult[] = [];

    for (const file of searchableFiles) {
      const lines = file.content.split("\n");
      const fileMatches: MatchEntry[] = [];

      lines.forEach((lineText: string, idx: number) => {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(lineText)) !== null) {
          fileMatches.push({
            line: idx + 1,
            text: lineText,
            matchStart: m.index,
            matchEnd: m.index + m[0].length,
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
  }, [debouncedQuery, caseSensitive, wholeWord, useRegex, searchableFiles]);

  const totalMatches = useMemo(
    () => fileResults.reduce((acc, f) => acc + f.matches.length, 0),
    [fileResults],
  );

  const toggleFileCollapse = useCallback((fileId: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const handleNavigate = useCallback(
    (fileId: string, fileName: string, line: number, _matchStart: number, _matchEnd: number) => {
      const isCurrent = fileId === activeFileId;

      if (isCurrent) {
        if (!engine) return;
        engine.jumpToLine(line);
        engine.focus();
      } else {
        // Switch active file tab
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

  // Replace in active file
  const handleReplaceAllCurrentFile = () => {
    if (!engine || !debouncedQuery) return;
    const content = engine.getContent();
    let pattern = debouncedQuery;
    if (!useRegex) pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (wholeWord) pattern = `\\b${pattern}\\b`;
    const flags = caseSensitive ? "g" : "gi";

    let re: RegExp;
    try {
      re = new RegExp(pattern, flags);
    } catch {
      return;
    }

    const replaced = content.replace(re, replaceText);
    if (replaced !== content) {
      engine.setContent(replaced);
      engine.focus();
    }
    toast.success("Replaced matches in active file");
  };

  // Replace across all files in project via backend atomic API
  const handleReplaceAllEverywhere = async () => {
    if (!debouncedQuery || !rootPageId) return;
    setIsReplacingAll(true);
    try {
      const res = await documentSearchService.batchReplace(
        rootPageId,
        debouncedQuery,
        replaceText,
        {
          caseSensitive,
          wholeWord,
          useRegex,
        },
      );
      toast.success(
        `Replaced ${res.totalOccurrencesReplaced} occurrence(s) across ${res.totalFilesAffected} file(s)`,
      );
      await queryClient.invalidateQueries({
        queryKey: filesQuery(rootPageId).queryKey,
      });
      // If active editor file was affected, update local buffer
      if (res.affectedFileIds.includes(activeFileId || "")) {
        handleReplaceAllCurrentFile();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to replace across project");
    } finally {
      setIsReplacingAll(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3 bg-background">
        <div className="flex min-w-0 items-center gap-1.5">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-semibold text-muted-foreground tracking-normal">
            Project Search
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title="Toggle replace in current file"
            aria-label="Toggle replace"
            aria-expanded={showReplace}
            onClick={() => setShowReplace(!showReplace)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer",
              showReplace && "bg-primary/15 text-primary",
            )}
          >
            <Replace className="size-3.5 shrink-0" />
          </button>
          {onClose && (
            <button
              type="button"
              title="Close search"
              aria-label="Close search"
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer"
            >
              <X className="size-3.5 shrink-0" />
            </button>
          )}
        </div>
      </div>

      {/* Search Input Controls */}
      <div className="border-b border-border px-3 py-3 space-y-2 bg-muted/20">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground shrink-0 pointer-events-none" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all files… (Ctrl+Shift+F)"
            className="pl-8 pr-8 h-8 text-xs bg-background"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none cursor-pointer"
            >
              <X className="size-3.5 shrink-0" />
            </button>
          )}
        </div>

        {/* Replace Input */}
        {showReplace && (
          <div className="space-y-1.5 animate-in fade-in duration-150">
            <div className="relative">
              <Replace className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground shrink-0 pointer-events-none" />
              <Input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace with…"
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={handleReplaceAllCurrentFile}
                disabled={!debouncedQuery}
                aria-label="Replace in active file"
                className="h-7 rounded-md bg-muted px-2 text-11 font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50 cursor-pointer"
                title="Replace all matches in current active file"
              >
                In Current File
              </button>
              <button
                type="button"
                onClick={handleReplaceAllEverywhere}
                disabled={!debouncedQuery || isReplacingAll}
                aria-label="Replace all in project"
                className="h-7 rounded-md bg-primary px-2.5 text-11 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-2xs"
                title="Replace all matches across all project files"
              >
                {isReplacingAll ? "Replacing..." : "All Files"}
              </button>
            </div>
          </div>
        )}

        {/* Search Options (Aa, Ab, .*) */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex gap-1">
            {[
              {
                key: "case",
                label: "Aa",
                title: "Match Case (Case Sensitive)",
                state: caseSensitive,
                setState: setCaseSensitive,
              },
              {
                key: "word",
                label: "Ab",
                title: "Match Whole Word",
                state: wholeWord,
                setState: setWholeWord,
              },
              {
                key: "regex",
                label: ".*",
                title: "Use Regular Expression",
                state: useRegex,
                setState: setUseRegex,
              },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => opt.setState(!opt.state)}
                title={opt.title}
                aria-label={opt.title}
                aria-pressed={opt.state}
                className={cn(
                  "h-6 min-w-6 px-1.5 rounded-sm text-11 font-mono transition-colors outline-none cursor-pointer flex items-center justify-center border",
                  opt.state
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span className="text-10 text-muted-foreground font-mono">
            {projectFiles.length > 0 ? `${projectFiles.length} files` : "1 file"}
          </span>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto">
        {debouncedQuery ? (
          <>
            <div
              role="status"
              aria-live="polite"
              className="border-b border-border px-3 py-1.5 text-11 font-medium text-muted-foreground bg-muted/10 flex items-center justify-between"
            >
              <span>
                {totalMatches} result{totalMatches !== 1 ? "s" : ""} in {fileResults.length} file{fileResults.length !== 1 ? "s" : ""}
              </span>
            </div>

            {fileResults.length > 0 ? (
              <ul className="divide-y divide-border/30">
                {fileResults.map((file) => {
                  const isCollapsed = collapsedFiles.has(file.fileId);
                  return (
                    <li key={file.fileId} className="bg-background">
                      {/* File Accordion Header */}
                      <button
                        type="button"
                        onClick={() => toggleFileCollapse(file.fileId)}
                        aria-expanded={!isCollapsed}
                        className="flex h-8 w-full items-center gap-1.5 px-3 text-left text-xs transition-colors hover:bg-muted/60 cursor-pointer outline-none select-none border-b border-border/10"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        <FileCode2 className="size-3.5 text-emerald-500 shrink-0" />
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
                            <li key={idx}>
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
                                className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-1.5 pl-7 text-left text-xs transition-colors hover:bg-primary/5 outline-none focus-visible:bg-muted"
                              >
                                <span className="text-muted-foreground/70 w-7 text-right shrink-0 font-mono text-11 pt-0.5">
                                  {match.line}
                                </span>
                                <span className="truncate font-mono text-xs text-foreground/80 leading-snug">
                                  {match.text.slice(0, match.matchStart)}
                                  <span className="bg-amber-400/30 dark:bg-amber-400/20 text-foreground font-semibold rounded-xs px-0.5">
                                    {match.text.slice(match.matchStart, match.matchEnd)}
                                  </span>
                                  {match.text.slice(match.matchEnd)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-1.5 text-center text-muted-foreground px-4">
                <SearchIcon className="size-6 opacity-30 shrink-0" />
                <p className="text-xs font-medium">No results found</p>
                <p className="text-11 text-muted-foreground/80">
                  No matching text found across project files.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 px-5 text-center text-muted-foreground">
            <SearchIcon className="size-8 opacity-25 shrink-0" />
            <p className="text-xs font-medium text-foreground/75">Project-wide Search</p>
            <p className="text-11 text-muted-foreground/80 max-w-[200px]">
              Search text across all LaTeX, BibTeX, and project files. Press <kbd className="px-1 py-0.5 rounded-sm bg-muted border border-border font-mono text-10">Ctrl+Shift+F</kbd> anytime.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

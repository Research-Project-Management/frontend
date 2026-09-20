'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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

  const { editorRef, getEditorContent, currentPage, activeFilePage, scrollToLineRef } = usePageStore();
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

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  // Auto-focus input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Fetch all text files in project
  const { data: projectFiles = [] } = useQuery({
    ...filesQuery(rootPageId),
    enabled: !!rootPageId,
  });

  // Assemble full searchable files list
  const searchableFiles = useMemo(() => {
    const activeContent = getEditorContent.current?.() ?? activeFilePage?.content ?? currentPage?.content ?? "";

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
  }, [projectFiles, activeFileId, getEditorContent, activeFilePage?.content, currentPage?.id, currentPage?.title, currentPage?.content]);

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
    (fileId: string, fileName: string, line: number, matchStart: number, matchEnd: number) => {
      const isCurrent = fileId === activeFileId;

      if (isCurrent) {
        const editor = editorRef.current;
        if (!editor) return;
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column: matchStart + 1 });
        editor.setSelection({
          startLineNumber: line,
          startColumn: matchStart + 1,
          endLineNumber: line,
          endColumn: matchEnd + 1,
        });
        editor.focus();
      } else {
        // Switch active file tab
        if (rootPageId) {
          openTab(rootPageId, { id: fileId, title: fileName });
        }
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        current.set("file", fileId);
        router.push(`${pathname}?${current.toString()}`);

        setTimeout(() => {
          scrollToLineRef.current?.(line);
        }, 250);
      }
    },
    [activeFileId, editorRef, rootPageId, openTab, searchParams, router, pathname, scrollToLineRef],
  );

  // Replace in active file
  const handleReplaceAllCurrentFile = () => {
    const editor = editorRef.current;
    if (!editor || !debouncedQuery) return;
    const model = editor.getModel();
    if (!model) return;

    const content = model.getValue();
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

    const fullRange = model.getFullModelRange();
    const replaced = content.replace(re, replaceText);
    editor.executeEdits("search-replace", [
      {
        range: fullRange,
        text: replaced,
        forceMoveMarkers: true,
      },
    ]);
    editor.pushUndoStop();
    editor.focus();
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3 bg-background">
        <div className="flex min-w-0 items-center gap-1.5">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
          <div className="flex gap-1.5 animate-in fade-in duration-150">
            <div className="relative flex-1">
              <Replace className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground shrink-0 pointer-events-none" />
              <Input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace in current file…"
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
            <button
              type="button"
              onClick={handleReplaceAllCurrentFile}
              disabled={!debouncedQuery}
              aria-label="Replace in active file"
              className="h-8 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-2xs shrink-0"
              title="Replace all in active file"
            >
              Replace
            </button>
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
                  "h-6 min-w-6 px-1.5 rounded text-[11px] font-mono transition-colors outline-none cursor-pointer flex items-center justify-center border",
                  opt.state
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span className="text-[10px] text-muted-foreground font-mono">
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
              className="border-b border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground bg-muted/10 flex items-center justify-between"
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
                          <span className="text-[10px] px-1 py-0 rounded bg-primary/10 text-primary font-sans leading-tight">
                            active
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded leading-none">
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
                                <span className="text-muted-foreground/70 w-7 text-right shrink-0 font-mono text-[11px] pt-0.5">
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
                <p className="text-[11px] text-muted-foreground/80">
                  No matching text found across project files.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 px-5 text-center text-muted-foreground">
            <SearchIcon className="size-8 opacity-25 shrink-0" />
            <p className="text-xs font-medium text-foreground/75">Project-wide Search</p>
            <p className="text-[11px] text-muted-foreground/80 max-w-[200px]">
              Search text across all LaTeX, BibTeX, and project files. Press <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Ctrl+Shift+F</kbd> anytime.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

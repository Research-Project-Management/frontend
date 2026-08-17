'use client';
import React, { useState, useMemo } from "react";
import {
  Search as SearchIcon,
  X,
  FileText,
  ChevronDown,
  ChevronRight,
  Replace,
} from "lucide-react";
import { Input } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { usePageStore } from "@/features/editor/store/page.store";
import { useDebounce } from '@/shared/hooks/use-debounce';

interface MatchEntry {
  line: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

export default function SearchTab({ onClose }: { onClose?: () => void }) {
  const { editorRef, getEditorContent, currentPage } = usePageStore();
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  const matches = useMemo<MatchEntry[]>(() => {
    if (!debouncedQuery) return [];
    const content = getEditorContent.current?.() ?? "";
    const lines = content.split("\n");
    const results: MatchEntry[] = [];

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

    lines.forEach((lineText, idx) => {
      re.lastIndex = 0;
      const m = re.exec(lineText);
      if (m) {
        results.push({
          line: idx + 1,
          text: lineText,
          matchStart: m.index,
          matchEnd: m.index + m[0].length,
        });
      }
    });

    return results;
  }, [debouncedQuery, caseSensitive, wholeWord, useRegex, getEditorContent]);

  const fileName = currentPage?.title ?? "document.tex";

  const handleNavigate = (line: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();
  };

  const handleReplaceAll = () => {
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

    model.setValue(content.replace(re, replaceText));
    editor.focus();
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card text-card-foreground">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-semibold text-muted-foreground">
            Search
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title="Toggle replace"
            onClick={() => setShowReplace(!showReplace)}
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              showReplace && "bg-accent text-primary",
            )}
          >
            <Replace className="size-4" />
          </button>
          {onClose && (
            <button
              type="button"
              title="Close"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="border-b border-border px-3 py-3 space-y-2">
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in files..."
            className="pl-8 pr-8 h-8 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Replace Input */}
        {showReplace && (
          <div className="flex gap-1">
            <div className="relative flex-1">
              <Replace className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace with..."
                className="pl-8 h-8 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleReplaceAll}
              disabled={!debouncedQuery}
              className="h-8 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              All
            </button>
          </div>
        )}

        {/* Search Options */}
        <div className="flex gap-1">
          {[
            {
              key: "case",
              label: "Aa",
              title: "Match Case",
              state: caseSensitive,
              setState: setCaseSensitive,
            },
            {
              key: "word",
              label: "Ab",
              title: "Whole Word",
              state: wholeWord,
              setState: setWholeWord,
            },
            {
              key: "regex",
              label: ".*",
              title: "Use Regex",
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
                "h-7 rounded-md px-2 text-xs font-mono transition-colors outline-none",
                opt.state
                  ? "bg-primary/15 text-primary font-bold"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {debouncedQuery ? (
          <>
            <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
              {matches.length} result{matches.length !== 1 ? "s" : ""} in{" "}
              {fileName}
            </div>
            {matches.length > 0 && (
              <ul>
                <li>
                  <button
                    type="button"
                    onClick={() => setIsExpanded((v) => !v)}
                    className="flex h-9 w-full items-center gap-1.5 px-3 text-left text-xs transition-colors hover:bg-accent/70 outline-none"
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                    <FileText className="size-4 text-primary" />
                    <span className="text-xs font-medium flex-1 truncate">
                      {fileName}
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded">
                      {matches.length}
                    </span>
                  </button>
                  {isExpanded && (
                    <ul className="bg-muted/30">
                      {matches.map((match, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleNavigate(match.line)}
                          className="flex w-full cursor-pointer items-start gap-2 px-3 py-1.5 pl-10 text-left text-xs transition-colors hover:bg-accent/70 outline-none"
                        >
                          <span className="text-muted-foreground w-8 text-right shrink-0 font-mono">
                            {match.line}
                          </span>
                          <span className="truncate">
                            {match.text.slice(0, match.matchStart)}
                            <span className="bg-primary/20 text-primary font-semibold rounded px-0.5">
                              {match.text.slice(
                                match.matchStart,
                                match.matchEnd,
                              )}
                            </span>
                            {match.text.slice(match.matchEnd)}
                          </span>
                        </button>
                      ))}
                    </ul>
                  )}
                </li>
              </ul>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-5 py-10 text-center text-muted-foreground">
            <SearchIcon className="size-8 opacity-25" />
            <p className="text-xs font-medium text-foreground/70">Type to search</p>
          </div>
        )}
      </div>
    </div>
  );
}

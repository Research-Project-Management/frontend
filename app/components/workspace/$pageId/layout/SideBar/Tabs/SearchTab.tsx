import React, { useState, useMemo } from "react";
import {
  Search as SearchIcon,
  X,
  FileText,
  ChevronDown,
  ChevronRight,
  Replace,
} from "lucide-react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { usePageContext } from "../../PageContext";
import { useDebounce } from "~/hooks/useDebounce";

interface MatchEntry {
  line: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

export default function SearchTab({ onClose }: { onClose?: () => void }) {
  const { editorRef, getEditorContent, currentPage } = usePageContext();
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
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-8 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Search
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowReplace(!showReplace)}
            className={cn(
              "p-1 rounded cursor-pointer transition-colors",
              showReplace
                ? "bg-primary/10 text-primary"
                : "hover:bg-primary/10",
            )}
          >
            <Replace className="size-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="px-3 pb-2 space-y-2">
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
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
              onClick={handleReplaceAll}
              disabled={!debouncedQuery}
              className="px-2 h-8 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50"
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
              onClick={() => opt.setState(!opt.state)}
              title={opt.title}
              className={cn(
                "px-2 py-1 text-xs font-mono rounded transition-colors",
                opt.state
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto border-t border-border">
        {debouncedQuery ? (
          <>
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {matches.length} result{matches.length !== 1 ? "s" : ""} in{" "}
              {fileName}
            </div>
            {matches.length > 0 && (
              <ul>
                <li>
                  <button
                    onClick={() => setIsExpanded((v) => !v)}
                    className="w-full flex items-center gap-1 px-3 py-1.5 hover:bg-muted/50 text-left"
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
                        <li
                          key={idx}
                          onClick={() => handleNavigate(match.line)}
                          className="flex items-start gap-2 px-3 py-1.5 pl-10 hover:bg-muted/50 cursor-pointer text-xs"
                        >
                          <span className="text-muted-foreground w-8 text-right shrink-0">
                            {match.line}
                          </span>
                          <span className="truncate">
                            {match.text.slice(0, match.matchStart)}
                            <span className="bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100 rounded px-0.5">
                              {match.text.slice(
                                match.matchStart,
                                match.matchEnd,
                              )}
                            </span>
                            {match.text.slice(match.matchEnd)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              </ul>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <SearchIcon className="size-8 mb-2 opacity-50" />
            <p className="text-sm">Type to search</p>
          </div>
        )}
      </div>
    </div>
  );
}

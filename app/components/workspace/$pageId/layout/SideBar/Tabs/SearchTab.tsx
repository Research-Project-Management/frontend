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
import {
  SidebarEmptyState,
  SidebarHeader,
  SidebarIconButton,
  SidebarPanel,
  SidebarSection,
} from "../SidebarChrome";

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
    <SidebarPanel>
      <SidebarHeader
        title="Search"
        icon={undefined}
        actions={
          <SidebarIconButton
            label="Toggle replace"
            onClick={() => setShowReplace(!showReplace)}
            active={showReplace}
          >
            <Replace className="size-4" />
          </SidebarIconButton>
        }
        onClose={onClose}
      />

      {/* Search Input */}
      <SidebarSection className="space-y-2">
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
              onClick={() => opt.setState(!opt.state)}
              title={opt.title}
              className={cn(
                "h-7 rounded-md px-2 text-xs font-mono transition-colors",
                opt.state
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SidebarSection>

      {/* Results */}
      <div className="flex-1 overflow-y-auto border-t border-border">
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
                    onClick={() => setIsExpanded((v) => !v)}
                    className="flex h-9 w-full items-center gap-1.5 px-3 text-left text-xs transition-colors hover:bg-accent/70"
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
                          onClick={() => handleNavigate(match.line)}
                          className="flex w-full cursor-pointer items-start gap-2 px-3 py-1.5 pl-10 text-left text-xs transition-colors hover:bg-accent/70"
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
                        </button>
                      ))}
                    </ul>
                  )}
                </li>
              </ul>
            )}
          </>
        ) : (
          <SidebarEmptyState icon={SearchIcon} title="Type to search" />
        )}
      </div>
    </SidebarPanel>
  );
}

import React, { useState } from "react";
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

interface SearchResult {
  file: string;
  matches: {
    line: number;
    text: string;
    matchStart: number;
    matchEnd: number;
  }[];
}

const mockResults: SearchResult[] = [
  {
    file: "main.tex",
    matches: [
      {
        line: 12,
        text: "\\section{Introduction}",
        matchStart: 9,
        matchEnd: 21,
      },
      {
        line: 45,
        text: "In the introduction, we discuss...",
        matchStart: 7,
        matchEnd: 19,
      },
    ],
  },
  {
    file: "chapter1.tex",
    matches: [
      {
        line: 3,
        text: "\\chapter{Introduction to LaTeX}",
        matchStart: 10,
        matchEnd: 22,
      },
    ],
  },
];

export default function SearchTab() {
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<string[]>([
    "main.tex",
    "chapter1.tex",
  ]);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  const toggleFile = (file: string) => {
    setExpandedFiles((prev) =>
      prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file]
    );
  };

  const totalMatches = mockResults.reduce(
    (acc, r) => acc + r.matches.length,
    0
  );

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex w-full text-primary justify-between items-center px-3 py-3">
        <span className="font-semibold">Search</span>
        <button
          onClick={() => setShowReplace(!showReplace)}
          className={cn(
            "p-1 rounded cursor-pointer transition-colors",
            showReplace ? "bg-primary/10 text-primary" : "hover:bg-primary/10"
          )}
        >
          <Replace className="size-4" />
        </button>
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
          <div className="relative">
            <Replace className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with..."
              className="pl-8 h-8 text-sm"
            />
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
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto border-t border-border">
        {query ? (
          <>
            <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
              {totalMatches} results in {mockResults.length} files
            </div>
            <ul>
              {mockResults.map((result) => (
                <li key={result.file}>
                  <button
                    onClick={() => toggleFile(result.file)}
                    className="w-full flex items-center gap-1 px-3 py-1.5 hover:bg-muted/50 text-left"
                  >
                    {expandedFiles.includes(result.file) ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                    <FileText className="size-4 text-primary" />
                    <span className="text-xs font-medium flex-1 truncate">
                      {result.file}
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded">
                      {result.matches.length}
                    </span>
                  </button>
                  {expandedFiles.includes(result.file) && (
                    <ul className="bg-muted/30">
                      {result.matches.map((match, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 px-3 py-1.5 pl-10 hover:bg-muted/50 cursor-pointer text-xs"
                        >
                          <span className="text-muted-foreground w-8 text-right flex-shrink-0">
                            {match.line}
                          </span>
                          <span className="truncate">
                            {match.text.slice(0, match.matchStart)}
                            <span className="bg-yellow-200 text-yellow-900 rounded px-0.5">
                              {match.text.slice(
                                match.matchStart,
                                match.matchEnd
                              )}
                            </span>
                            {match.text.slice(match.matchEnd)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
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

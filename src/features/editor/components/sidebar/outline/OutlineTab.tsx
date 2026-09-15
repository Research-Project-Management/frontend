'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronRight,
  Hash,
  ListTree,
  Search,
  X,
  FileText,
  Bookmark,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, Input } from "@/shared/components/ui";
import { cn, logger } from "@/shared/lib/utils";
import { usePageStore } from '@/features/editor/store/page.store';

export interface OutlineEntry {
  level: number;
  levelName: string;
  title: string;
  line: number;
}

const SECTION_PATTERNS: { regex: RegExp; level: number; levelName: string }[] = [
  { regex: /^\\part\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 0, levelName: 'Part' },
  { regex: /^\\chapter\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 0, levelName: 'Chapter' },
  { regex: /^\\section\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 1, levelName: 'Section' },
  { regex: /^\\subsection\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 2, levelName: 'Sub' },
  { regex: /^\\subsubsection\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 3, levelName: 'Subsub' },
  { regex: /^\\paragraph\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 4, levelName: 'Para' },
];

const OUTLINE_INDENT = [0, 8, 18, 28, 38];

const LEVEL_STYLES: Record<number, { text: string; badge: string }> = {
  0: { text: "font-semibold text-foreground text-13", badge: "bg-primary/10 text-primary font-mono text-10" },
  1: { text: "font-medium text-foreground text-12", badge: "bg-secondary text-secondary-foreground font-mono text-10" },
  2: { text: "text-foreground/90 text-12", badge: "text-muted-foreground font-mono text-10" },
  3: { text: "text-muted-foreground text-11", badge: "text-muted-foreground/70 font-mono text-10" },
  4: { text: "text-muted-foreground/80 italic text-11", badge: "text-muted-foreground/60 font-mono text-10" },
};

export function parseDocumentOutline(content: any): OutlineEntry[] {
  const str =
    typeof content === 'string'
      ? content
      : content && typeof content === 'object'
        ? content.source || content.text || content.content || ''
        : '';

  const entries: OutlineEntry[] = [];
  const lines = str.split('\n');

  lines.forEach((rawLine: string, idx: number) => {
    const line = rawLine.trimStart();
    for (const { regex, level, levelName } of SECTION_PATTERNS) {
      const match = line.match(regex);
      if (match) {
        entries.push({
          level,
          levelName,
          title: match[1].trim(),
          line: idx + 1,
        });
        break;
      }
    }
  });

  return entries;
}

function flattenPdfOutline(items: any[]): any[] {
  const result: any[] = [];
  for (const item of items) {
    result.push(item);
    if (item.items?.length) result.push(...flattenPdfOutline(item.items));
  }
  return result;
}

async function findPdfPageForTitle(doc: any, title: string): Promise<number | null> {
  const needle = title.toLowerCase().trim();

  try {
    const outline = await doc.getOutline();
    if (outline?.length) {
      for (const item of flattenPdfOutline(outline)) {
        if (item.title && item.title.toLowerCase().includes(needle)) {
          const dest = Array.isArray(item.dest)
            ? item.dest
            : await doc.getDestination(item.dest);
          if (dest) {
            const pageIndex = await doc.getPageIndex(dest[0]);
            return pageIndex + 1;
          }
        }
      }
    }
  } catch (err) {
    logger.debug('[OutlineTab] PDF bookmark lookup failed', { err });
  }

  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = (content.items as any[]).map((it) => it.str).join(' ');
      if (text.toLowerCase().includes(needle)) return i;
    } catch (err) {
      logger.debug('[OutlineTab] Page content search failed', { page: i, err });
    }
  }

  return null;
}

export interface OutlineTabProps {
  onClose?: () => void;
}

export default function OutlineTab({ onClose }: OutlineTabProps) {
  const {
    editorRef,
    getEditorContent,
    activeFilePage,
    currentPage,
    pdfDocRef,
    gotoPageRef,
  } = usePageStore();

  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLine, setActiveLine] = useState<number | null>(null);

  // Read current content from memory buffer or active page
  const readCurrentContent = useCallback(() => {
    return (
      getEditorContent.current?.() ||
      editorRef.current?.getValue() ||
      activeFilePage?.content ||
      currentPage?.content ||
      ''
    );
  }, [editorRef, getEditorContent, activeFilePage, currentPage]);

  // Refresh outline on mount and subscribe to editor changes
  useEffect(() => {
    setOutline(parseDocumentOutline(readCurrentContent()));

    const ed = editorRef.current;
    if (!ed) {
      const timer = setTimeout(() => {
        setOutline(parseDocumentOutline(readCurrentContent()));
      }, 500);
      return () => clearTimeout(timer);
    }

    let timeoutId: ReturnType<typeof setTimeout>;
    const contentSub = ed.onDidChangeModelContent(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setOutline(parseDocumentOutline(ed.getValue()));
      }, 400);
    });

    const cursorSub = ed.onDidChangeCursorPosition((e) => {
      setActiveLine(e.position.lineNumber);
    });

    return () => {
      clearTimeout(timeoutId);
      contentSub.dispose();
      cursorSub.dispose();
    };
  }, [readCurrentContent, editorRef, editorRef.current]);

  // Filter outline entries by search query
  const filteredOutline = useMemo(() => {
    if (!searchQuery.trim()) return outline;
    const q = searchQuery.toLowerCase().trim();
    return outline.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        entry.levelName.toLowerCase().includes(q) ||
        String(entry.line).includes(q),
    );
  }, [outline, searchQuery]);

  // Handle clicking on an outline item -> Navigate editor and PDF
  const handleItemClick = useCallback(
    async (entry: OutlineEntry) => {
      const ed = editorRef.current;
      if (ed) {
        ed.revealLineInCenter(entry.line);
        ed.setPosition({ lineNumber: entry.line, column: 1 });
        ed.focus();
      }

      const doc = pdfDocRef.current;
      const scrollToPage = gotoPageRef.current;
      if (!doc || !scrollToPage) return;

      const pageNum = await findPdfPageForTitle(doc, entry.title);
      if (pageNum !== null) {
        scrollToPage(pageNum);
      }
    },
    [editorRef, pdfDocRef, gotoPageRef],
  );

  return (
    <div className="flex flex-col h-full w-full bg-card select-none text-xs">
      {/* ── Header ── */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3 bg-card">
        <div className="flex items-center gap-2">
          <ListTree className="size-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground">
            Document Outline
          </span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-10 font-mono text-muted-foreground">
            {outline.length}
          </span>
        </div>
        {onClose && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="size-3.5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close Outline</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ── Search Bar ── */}
      <div className="p-2 border-b border-border bg-background/50">
        <div className="relative flex items-center">
          <Search className="size-3.5 absolute left-2.5 text-muted-foreground/60 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sections..."
            className="h-7.5 pl-8 pr-7 text-xs bg-muted/50 border-border/80 focus-visible:ring-1"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3 shrink-0" />
            </button>
          )}
        </div>
      </div>

      {/* ── Outline Entries List ── */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {filteredOutline.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center text-muted-foreground space-y-2">
            <Bookmark className="size-6 text-muted-foreground/40 shrink-0" />
            <p className="text-xs font-medium text-foreground">
              {searchQuery ? 'No matching sections found' : 'No sections detected'}
            </p>
            <p className="text-11 text-muted-foreground/70 leading-relaxed">
              {searchQuery
                ? 'Try a different search term.'
                : 'Use LaTeX commands like \\section{...} or \\subsection{...} to build your document outline.'}
            </p>
          </div>
        ) : (
          filteredOutline.map((entry, idx) => {
            const isNearCursor =
              activeLine !== null &&
              Math.abs(entry.line - activeLine) < 3;

            const style = LEVEL_STYLES[entry.level] || LEVEL_STYLES[1];

            return (
              <button
                key={`${entry.line}-${idx}`}
                type="button"
                onClick={() => handleItemClick(entry)}
                style={{
                  paddingLeft: `${8 + (OUTLINE_INDENT[entry.level] || 0)}px`,
                }}
                className={cn(
                  "group flex w-full items-center gap-1.5 py-1.5 pr-2 rounded-md text-left transition-all cursor-pointer",
                  isNearCursor
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground/85 hover:text-foreground",
                )}
              >
                <ChevronRight
                  className={cn(
                    "size-3 shrink-0 text-muted-foreground/50 transition-transform group-hover:text-foreground/80",
                    entry.level === 0 && "rotate-90 text-primary/70",
                  )}
                />

                <span className={cn("min-w-0 flex-1 truncate", style.text)}>
                  {entry.title}
                </span>

                <span
                  className={cn(
                    "shrink-0 px-1 py-0.2 rounded text-10 font-mono opacity-60 group-hover:opacity-100 transition-opacity",
                    style.badge,
                  )}
                >
                  :{entry.line}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* ── Footer Stats ── */}
      {outline.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-card text-11 text-muted-foreground/70 shrink-0">
          <span>{filteredOutline.length} items shown</span>
          <span className="font-mono">SyncTeX enabled</span>
        </div>
      )}
    </div>
  );
}

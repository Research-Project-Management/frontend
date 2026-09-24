'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ListTree,
  Search,
  X,
  ChevronRight,
  BookOpen,
  FileText,
} from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import { usePageStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import { parseDocumentOutline, type OutlineEntry, OUTLINE_INDENT } from '@/features/editor/utils/pdf-outline.util';

export interface OutlineTabProps {
  onClose?: () => void;
}

const LEVEL_BADGES: Record<number, { label: string; className: string }> = {
  0: { label: 'Part', className: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  1: { label: 'Sec', className: 'bg-primary/15 text-primary border-primary/30' },
  2: { label: 'Sub', className: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30' },
  3: { label: 'Sub2', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  4: { label: 'Para', className: 'bg-muted text-muted-foreground border-border' },
};

export default function OutlineTab({ onClose }: OutlineTabProps) {
  const { currentPage } = usePageStore();
  const { getContent, engine } = useEditorInstance();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [docContent, setDocContent] = useState(() => getContent() || currentPage?.content || '');

  useEffect(() => {
    setDocContent(getContent() || currentPage?.content || '');
  }, [currentPage?.content, getContent]);

  useEffect(() => {
    if (!engine) return;
    return engine.onContentChange((newContent) => {
      setDocContent(newContent);
    });
  }, [engine]);

  const outlineEntries = useMemo(() => parseDocumentOutline(docContent), [docContent]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return outlineEntries;
    const q = searchQuery.toLowerCase().trim();
    return outlineEntries.filter((item) =>
      item.title.toLowerCase().includes(q) ||
      item.levelName.toLowerCase().includes(q) ||
      String(item.line) === q
    );
  }, [outlineEntries, searchQuery]);

  const handleHeadingClick = (entry: OutlineEntry) => {
    setActiveLine(entry.line);
    editorCommandBus.dispatch({ type: 'editor:jump-to-line', line: entry.line });
  };

  return (
    <div className="w-full h-full flex flex-col select-none text-sm bg-background">
      {/* ── Top Header Toolbar ── */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 bg-background">
        <div className="flex items-center gap-2 min-w-0">
          <ListTree className="size-4 shrink-0 text-primary" />
          <span className="font-semibold text-xs text-foreground truncate">
            Document Outline
          </span>
          {outlineEntries.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full font-mono text-10 font-medium bg-muted text-muted-foreground">
              {outlineEntries.length}
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close outline panel"
            className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-3.5 shrink-0" />
          </button>
        )}
      </div>

      {/* ── Search / Filter Bar ── */}
      <div className="px-2.5 py-1.5 border-b border-border bg-background/60">
        <div className="relative flex items-center h-7 rounded-md border border-border/80 bg-muted/30 px-2 text-xs focus-within:border-primary/50 focus-within:bg-background transition-colors">
          <Search className="size-3.5 shrink-0 text-muted-foreground mr-1.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('');
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Filter sections..."
            aria-label="Filter sections"
            className="w-full bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/60"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="size-4 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              title="Clear filter (Esc)"
              aria-label="Clear filter"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Outline Entries List ── */}
      <div className="flex-1 overflow-y-auto py-1">
        {outlineEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-4 py-12 text-muted-foreground">
            <BookOpen className="size-8 opacity-25 shrink-0 mb-2" />
            <p className="text-xs text-foreground/80 font-medium">
              No sections found in this document
            </p>
            <p className="text-11 text-muted-foreground/80 mt-1 max-w-[200px]">
              Use commands like <code className="font-mono text-primary text-10 bg-muted px-1 py-0.5 rounded-sm">\section&#123;...&#125;</code> or <code className="font-mono text-primary text-10 bg-muted px-1 py-0.5 rounded-sm">\chapter&#123;...&#125;</code> to structure your manuscript.
            </p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-4 py-8 text-muted-foreground">
            <Search className="size-5 opacity-30 shrink-0 mb-1" />
            <p className="text-xs text-foreground/80 font-medium">
              No sections match &quot;{searchQuery}&quot;
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-11 text-primary hover:underline mt-1 cursor-pointer"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="space-y-0.5 px-1">
            {filteredEntries.map((entry, index) => {
              const badge = LEVEL_BADGES[entry.level] || LEVEL_BADGES[1];
              const indent = OUTLINE_INDENT[entry.level] || 0;
              const isSelected = activeLine === entry.line;

              return (
                <button
                  key={`${entry.line}-${index}`}
                  type="button"
                  onClick={() => handleHeadingClick(entry)}
                  style={{ paddingLeft: `${8 + indent}px` }}
                  className={cn(
                    'group/heading flex w-full items-center gap-1.5 pr-2 py-1.5 rounded-sm text-left text-xs transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted/70 text-foreground/90'
                  )}
                  title={`Jump to Line ${entry.line}: ${entry.title}`}
                >
                  <ChevronRight
                    className={cn(
                      'size-3 shrink-0 text-muted-foreground/60 transition-transform group-hover/heading:translate-x-0.5',
                      isSelected && 'text-primary rotate-90'
                    )}
                  />
                  <span
                    className={cn(
                      'shrink-0 text-9 font-mono px-1 py-0.2 rounded-sm border font-semibold',
                      badge.className
                    )}
                  >
                    {badge.label}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-xs',
                      entry.level === 0 && 'font-bold text-foreground',
                      entry.level === 1 && 'font-semibold',
                      isSelected && 'text-primary'
                    )}
                  >
                    {entry.title}
                  </span>
                  <span className="shrink-0 text-10 font-mono text-muted-foreground/60">
                    L{entry.line}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

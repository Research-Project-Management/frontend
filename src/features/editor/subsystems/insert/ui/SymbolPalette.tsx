'use client';

/**
 * SymbolPalette.tsx
 *
 * Non-blocking bottom-docked math symbol palette aligned with Overleaf:
 * - Toggled by Ω toolbar button or closed with ×
 * - Category tabs (including Delimiters) + command/name/keyword search
 * - Package tooltip hint when hover requires amsmath/amssymb
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Search, Info, X } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { getModalSymbols, type MathSymbol } from '@/features/editor/domain/latex/latex-symbols';

export interface SymbolPaletteProps {
  open: boolean;
  onClose: () => void;
  onInsert: (latexSymbol: string) => void;
}

interface IndexedSymbol {
  readonly symbol: MathSymbol;
  readonly cmdLower: string;
  readonly nameLower: string;
  readonly keywordsLower: readonly string[];
}

const ALL_SYMBOLS = getModalSymbols();

const SYMBOL_INDEX: readonly IndexedSymbol[] = ALL_SYMBOLS.map((s) => ({
  symbol: s,
  cmdLower: s.command.toLowerCase(),
  nameLower: s.name.toLowerCase(),
  keywordsLower: (s.keywords ?? []).map((k) => k.toLowerCase()),
}));

const SYMBOLS_BY_CATEGORY: Record<string, readonly IndexedSymbol[]> = (() => {
  const map: Record<string, IndexedSymbol[]> = { all: [...SYMBOL_INDEX] };
  for (const item of SYMBOL_INDEX) {
    const cat = item.symbol.category;
    if (!map[cat]) map[cat] = [];
    map[cat].push(item);
  }
  return map;
})();

const CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'greek-lower', label: 'Greek (α)' },
  { id: 'greek-upper', label: 'Greek (Δ)' },
  { id: 'operators', label: 'Operators' },
  { id: 'relations', label: 'Relations' },
  { id: 'arrows', label: 'Arrows' },
  { id: 'delimiters', label: 'Delimiters' },
] as const;

export function SymbolPalette({ open, onClose, onInsert }: SymbolPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [lastSymbol, setLastSymbol] = useState<string | null>(null);

  const handleInsert = useCallback(
    (sym: MathSymbol) => {
      onInsert(`${sym.command} `);
      setLastSymbol(sym.command);
    },
    [onInsert],
  );

  const symbols = useMemo(() => {
    const baseList = SYMBOLS_BY_CATEGORY[activeTab] ?? SYMBOL_INDEX;
    const q = query.trim().toLowerCase();
    if (!q) {
      return baseList.map((item) => item.symbol);
    }
    const matched: MathSymbol[] = [];
    for (let i = 0; i < baseList.length; i++) {
      const item = baseList[i];
      if (
        item.cmdLower.includes(q) ||
        item.nameLower.includes(q) ||
        item.symbol.display.includes(q) ||
        item.keywordsLower.some((kw) => kw.includes(q))
      ) {
        matched.push(item.symbol);
      }
    }
    return matched;
  }, [activeTab, query]);

  if (!open) return null;

  return (
    <section
      role="region"
      aria-label="Symbol palette"
      className="h-44 border-t border-border bg-surface shrink-0 flex flex-col select-none"
    >
      {/* Compact Single-Row Header */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border bg-background/60 shrink-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 flex-1">
          <TabsList className="h-7 bg-transparent p-0 gap-0.5 rounded-none overflow-x-auto scrollbar-none max-w-full justify-start">
            {CATEGORY_TABS.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="h-6 px-2.5 text-11 rounded-sm cursor-pointer whitespace-nowrap shrink-0 flex-none bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:shadow-none dark:data-[state=active]:bg-muted dark:data-[state=active]:border-transparent"
              >
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative w-44 sm:w-52">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search symbols"
              placeholder="Search symbols..."
              className="h-7 pl-7 pr-6 text-xs font-mono rounded-md border-border bg-background"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close symbol palette"
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Symbols Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {symbols.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground gap-1.5">
            <Info className="size-4 opacity-40" />
            <span>No symbols matching &quot;{query}&quot;</span>
          </div>
        ) : (
          <div className="flex flex-wrap content-start gap-1">
            {symbols.map((sym) => {
              const isRecent = lastSymbol === sym.command;
              return (
                <Tooltip key={sym.command} delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleInsert(sym)}
                      aria-label={`${sym.command} (${sym.name})`}
                      className={cn(
                        'inline-flex items-center justify-center min-w-9 h-9 px-1.5 rounded-sm text-base leading-none font-serif transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        isRecent
                          ? 'bg-primary/15 text-primary'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      {sym.display}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="flex flex-col gap-0.5 text-11">
                    <div className="flex items-center gap-1 font-mono font-medium">
                      <span>{sym.command}</span>
                      <span className="text-muted-foreground font-sans">({sym.name})</span>
                    </div>
                    {sym.requiredPackage && (
                      <div className="text-9 text-warning font-mono">
                        Requires \usepackage&#123;{sym.requiredPackage}&#125;
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default SymbolPalette;

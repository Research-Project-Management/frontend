'use client';

/**
 * SymbolPaletteModal.tsx
 *
 * Modal for LaTeX symbol palette (UI Shell / Modals Layer):
 * - Fast interactive symbol palette categorized by Greek, Operators, Relations, Arrows, Delimiters
 * - Instant insertion at cursor with feedback
 * - Keep open toggle for multiple symbol selections
 * Location: `features/editor/ui/modals/SymbolPaletteModal.tsx`
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Sigma,
  Search,
  Info,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

export interface SymbolPaletteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (latexSymbol: string) => void;
}

import { getModalSymbols, type MathSymbol } from '@/features/editor/domain/latex/latex-symbols';

const SYMBOLS = getModalSymbols();

interface IndexedMathSymbol {
  readonly symbol: MathSymbol;
  readonly cmdLower: string;
  readonly nameLower: string;
}

const SYMBOLS_SEARCH_INDEX: readonly IndexedMathSymbol[] = SYMBOLS.map((s) => ({
  symbol: s,
  cmdLower: s.command.toLowerCase(),
  nameLower: s.name.toLowerCase(),
}));

const SYMBOLS_BY_CATEGORY: Record<string, readonly IndexedMathSymbol[]> = (() => {
  const map: Record<string, IndexedMathSymbol[]> = { all: [...SYMBOLS_SEARCH_INDEX] };
  for (const item of SYMBOLS_SEARCH_INDEX) {
    const cat = item.symbol.category;
    if (!map[cat]) map[cat] = [];
    map[cat].push(item);
  }
  return map;
})();

export function SymbolPaletteModal({
  open,
  onOpenChange,
  onInsert,
}: SymbolPaletteModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  const [lastInserted, setLastInserted] = useState<string | null>(null);
  const [keepOpen, setKeepOpen] = useState(true);

  const insertSymbol = useCallback(
    (sym: MathSymbol) => {
      onInsert(`${sym.command} `);
      setLastInserted(sym.command);

      if (!keepOpen) {
        onOpenChange(false);
      }
    },
    [onInsert, keepOpen, onOpenChange],
  );

  const filteredSymbols = useMemo(() => {
    const baseList = SYMBOLS_BY_CATEGORY[activeTab] ?? SYMBOLS_SEARCH_INDEX;
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return baseList.map((item) => item.symbol);
    }
    const result: MathSymbol[] = [];
    for (let i = 0; i < baseList.length; i++) {
      const item = baseList[i];
      if (
        item.cmdLower.includes(q) ||
        item.nameLower.includes(q) ||
        item.symbol.display.includes(q)
      ) {
        result.push(item.symbol);
      }
    }
    return result;
  }, [activeTab, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] flex flex-col p-6 gap-3.5 text-xs bg-background border border-border shadow-raised-200 rounded-md">
        <DialogHeader>
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            LaTeX Symbol Palette
          </DialogTitle>
          <DialogDescription className="text-12 text-muted-foreground mt-0.5">
            Click any symbol to insert directly into your document at current cursor.
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search symbols by command or name"
            placeholder="Search symbols by command or name (e.g. alpha, sum, int, infty, le)..."
            className="pl-8 h-8 text-xs font-mono rounded-md border-border bg-background"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="flex items-center w-full h-8 text-11 rounded-md bg-muted p-0.5 border border-border overflow-x-auto scrollbar-none">
            <TabsTrigger value="all" className="flex-1 shrink-0 whitespace-nowrap cursor-pointer rounded-sm text-11 h-7 min-w-fit px-2 relative after:absolute after:-inset-1 after:content-['']">All</TabsTrigger>
            <TabsTrigger value="greek-lower" className="flex-1 shrink-0 whitespace-nowrap cursor-pointer rounded-sm text-11 h-7 min-w-fit px-2 relative after:absolute after:-inset-1 after:content-['']">Greek (α)</TabsTrigger>
            <TabsTrigger value="greek-upper" className="flex-1 shrink-0 whitespace-nowrap cursor-pointer rounded-sm text-11 h-7 min-w-fit px-2 relative after:absolute after:-inset-1 after:content-['']">Greek (Δ)</TabsTrigger>
            <TabsTrigger value="operators" className="flex-1 shrink-0 whitespace-nowrap cursor-pointer rounded-sm text-11 h-7 min-w-fit px-2 relative after:absolute after:-inset-1 after:content-['']">Operators (∫)</TabsTrigger>
            <TabsTrigger value="relations" className="flex-1 shrink-0 whitespace-nowrap cursor-pointer rounded-sm text-11 h-7 min-w-fit px-2 relative after:absolute after:-inset-1 after:content-['']">Relations (≤)</TabsTrigger>
            <TabsTrigger value="arrows" className="flex-1 shrink-0 whitespace-nowrap cursor-pointer rounded-sm text-11 h-7 min-w-fit px-2 relative after:absolute after:-inset-1 after:content-['']">Arrows (→)</TabsTrigger>
          </TabsList>

          {/* Symbol Grid */}
          <div className="mt-3 flex-1 overflow-y-auto max-h-72 border border-border rounded-md p-2 bg-muted/10">
            {filteredSymbols.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Info className="size-6 opacity-30" />
                <span>No symbols found matching &quot;{searchQuery}&quot;</span>
              </div>
            ) : (
              <TooltipProvider delayDuration={200}>
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 select-none">
                  {filteredSymbols.map((sym) => {
                    const isRecent = lastInserted === sym.command;
                    return (
                      <Tooltip key={sym.command}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => insertSymbol(sym)}
                            aria-label={`${sym.command} (${sym.name})`}
                            className={cn(
                              'group flex flex-col items-center justify-center h-12 rounded-sm border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-inset',
                              isRecent
                                ? 'bg-primary/15 border-primary text-primary font-semibold'
                                : 'bg-background border-border hover:border-primary/50 hover:bg-primary/5 text-foreground'
                            )}
                          >
                            <span className="text-base leading-none font-serif">
                              {sym.display}
                            </span>
                            <span className="text-9 font-mono text-muted-foreground truncate max-w-[50px] mt-1 group-hover:text-foreground">
                              {sym.command}
                            </span>
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
              </TooltipProvider>
            )}
          </div>
        </Tabs>

        {/* Footer with keep open toggle and dismiss */}
        <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Checkbox
              id="keep-palette-open"
              checked={keepOpen}
              onCheckedChange={(c) => setKeepOpen(Boolean(c))}
            />
            <label
              htmlFor="keep-palette-open"
              className="text-xs font-medium text-muted-foreground cursor-pointer select-none min-h-[28px] flex items-center"
            >
              Keep open after inserting (click multiple symbols)
            </label>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground outline-none focus-visible:ring-1 focus-visible:ring-border"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SymbolPaletteModal;

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
import { toast } from 'sonner';
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
import { cn } from '@/shared/lib/utils';

export interface SymbolPaletteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (latexSymbol: string) => void;
}

import { getModalSymbols, type MathSymbol } from '@/features/editor/domain/latex/latex-symbols';

const SYMBOLS = getModalSymbols();

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
      toast.success(`Inserted ${sym.command}`, { duration: 1200 });

      if (!keepOpen) {
        onOpenChange(false);
      }
    },
    [onInsert, keepOpen, onOpenChange],
  );

  const filteredSymbols = useMemo(() => {
    let list = SYMBOLS;
    if (activeTab !== 'all') {
      list = list.filter((s) => s.category === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.command.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.display.includes(q)
      );
    }
    return list;
  }, [activeTab, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 gap-3.5 text-xs bg-background border border-border shadow-raised-200 rounded-md">
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
            placeholder="Search symbols by command or name (e.g. alpha, sum, int, infty, le)..."
            className="pl-8 h-8 text-xs font-mono rounded-md border-border bg-background"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
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
          <TabsList className="grid grid-cols-6 w-full h-8 text-11 rounded-md bg-muted p-0.5 border border-border">
            <TabsTrigger value="all" className="cursor-pointer rounded-sm text-11">All</TabsTrigger>
            <TabsTrigger value="greek-lower" className="cursor-pointer rounded-sm text-11">Greek (α)</TabsTrigger>
            <TabsTrigger value="greek-upper" className="cursor-pointer rounded-sm text-11">Greek (Δ)</TabsTrigger>
            <TabsTrigger value="operators" className="cursor-pointer rounded-sm text-11">Operators (∫)</TabsTrigger>
            <TabsTrigger value="relations" className="cursor-pointer rounded-sm text-11">Relations (≤)</TabsTrigger>
            <TabsTrigger value="arrows" className="cursor-pointer rounded-sm text-11">Arrows (→)</TabsTrigger>
          </TabsList>

          {/* Symbol Grid */}
          <div className="mt-3 flex-1 overflow-y-auto max-h-72 border border-border rounded-md p-2 bg-muted/10">
            {filteredSymbols.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Info className="size-6 opacity-30" />
                <span>No symbols found matching &quot;{searchQuery}&quot;</span>
              </div>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 select-none">
                {filteredSymbols.map((sym) => {
                  const isRecent = lastInserted === sym.command;
                  return (
                    <button
                      key={sym.command}
                      type="button"
                      onClick={() => insertSymbol(sym)}
                      title={`${sym.command} (${sym.name})`}
                      className={cn(
                        'group flex flex-col items-center justify-center h-12 rounded-sm border transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset',
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
                  );
                })}
              </div>
            )}
          </div>
        </Tabs>

        {/* Footer with keep open toggle and dismiss */}
        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Checkbox
              id="keep-palette-open"
              checked={keepOpen}
              onCheckedChange={(c) => setKeepOpen(Boolean(c))}
            />
            <label
              htmlFor="keep-palette-open"
              className="text-xs font-medium text-muted-foreground cursor-pointer"
            >
              Keep open after inserting (click multiple symbols)
            </label>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SymbolPaletteModal;

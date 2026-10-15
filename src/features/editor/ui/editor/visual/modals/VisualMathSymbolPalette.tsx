'use client';

/**
 * VisualMathSymbolPalette.tsx
 *
 * KaTeX Quick-Symbol & LaTeX Template Palette for Visual Mode Math Editor.
 * Location: `features/editor/ui/features/editor/visual/modals/VisualMathSymbolPalette.tsx`
 *
 * Provides instant 1-click insertion for:
 * - Basic math operations & fractions (\frac, \sqrt, powers, sub/super, \pm, \times)
 * - Greek alphabet (lowercase & uppercase)
 * - Calculus & operators (\int, \sum, \prod, \lim, \partial, \nabla)
 * - Relations & arrows (\to, \implies, \iff, \in, \subset, \cup, \cap)
 * - Matrix & piecewise environments (pmatrix, bmatrix, vmatrix, cases, aligned)
 */

import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { renderMathHtml } from '@/features/editor/domain/latex/latex-converter';

import { getVisualSymbols, type VisualSymbolCategory } from '@/features/editor/domain/latex/latex-symbols';

export type MathPaletteCategory = VisualSymbolCategory;

export interface MathSymbolItem {
  id: string;
  latex: string;
  previewLatex?: string;
  name: string;
  category: MathPaletteCategory;
  keywords: string[];
}

export const MATH_SYMBOLS: MathSymbolItem[] = getVisualSymbols();

export interface VisualMathSymbolPaletteProps {
  onInsertSymbol: (latex: string) => void;
  className?: string;
}

export function VisualMathSymbolPalette({
  onInsertSymbol,
  className,
}: VisualMathSymbolPaletteProps) {
  const [activeTab, setActiveTab] = useState<MathPaletteCategory>('basic');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories: Array<{ id: MathPaletteCategory; label: string }> = [
    { id: 'basic', label: 'Basic' },
    { id: 'greek', label: 'Greek' },
    { id: 'operators', label: 'Calculus' },
    { id: 'arrows', label: 'Relations' },
    { id: 'matrix', label: 'Matrices' },
  ];

  const filteredSymbols = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return MATH_SYMBOLS.filter((sym) => {
        if (sym.name.toLowerCase().includes(q)) return true;
        if (sym.latex.toLowerCase().includes(q)) return true;
        return sym.keywords.some((k) => k.toLowerCase().includes(q));
      });
    }
    return MATH_SYMBOLS.filter((sym) => sym.category === activeTab);
  }, [activeTab, searchQuery]);

  return (
    <div
      role="region"
      aria-label="KaTeX Quick-Symbol Palette"
      className={cn('space-y-2 border border-border rounded-md p-3 bg-muted/20 select-none text-xs', className)}
    >
      {/* ── Header: Search & Category Navigation ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none" role="tablist">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={activeTab === cat.id && !searchQuery}
              onClick={() => {
                setActiveTab(cat.id);
                setSearchQuery('');
              }}
              className={cn(
                'px-2.5 py-1 min-h-[28px] rounded-sm text-[11px] font-medium transition-colors cursor-pointer shrink-0 relative after:absolute after:-inset-1 after:content-[\'\']',
                activeTab === cat.id && !searchQuery
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Quick Symbol Search */}
        <div className="relative w-full sm:w-44">
          <Search className="absolute left-2 top-2 size-3 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Search math symbols"
            placeholder="Filter symbols (alpha, int)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 pr-2 text-xs bg-background"
          />
        </div>
      </div>

      {/* ── Symbol Buttons Grid ── */}
      <div className="max-h-36 overflow-y-auto pr-1">
        {filteredSymbols.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground italic">
            No symbols found matching &quot;{searchQuery}&quot;
          </div>
        ) : (
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
            {filteredSymbols.map((item) => {
              const previewHtml = renderMathHtml(item.previewLatex || item.latex, false);
              return (
                <button
                  key={item.id}
                  type="button"
                  title={`${item.name} (${item.latex})`}
                  aria-label={`Insert ${item.name}`}
                  onClick={() => onInsertSymbol(item.latex)}
                  className={cn(
                    'h-9 flex items-center justify-center p-1 rounded-sm border border-border/60 bg-background hover:bg-muted text-foreground hover:border-foreground/30',
                    'transition-all text-sm cursor-pointer group'
                  )}
                >
                  <span
                    className="inline-block pointer-events-none max-w-full overflow-hidden text-ellipsis leading-none"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default VisualMathSymbolPalette;

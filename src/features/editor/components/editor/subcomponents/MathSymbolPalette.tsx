'use client';

import React, { useState, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/components/ui/tabs';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { Search, Sigma, Pi, Sparkles } from 'lucide-react';

export interface MathSymbolItem {
  display: string;
  latex: string;
  name: string;
  category: 'greek' | 'operators' | 'relations' | 'structures';
  description?: string;
}

export const MATH_SYMBOLS: MathSymbolItem[] = [
  // ── Greek Lowercase ──────────────────────────────────────────────
  { display: 'α', latex: '\\alpha', name: 'alpha', category: 'greek' },
  { display: 'β', latex: '\\beta', name: 'beta', category: 'greek' },
  { display: 'γ', latex: '\\gamma', name: 'gamma', category: 'greek' },
  { display: 'δ', latex: '\\delta', name: 'delta', category: 'greek' },
  { display: 'ϵ', latex: '\\epsilon', name: 'epsilon', category: 'greek' },
  { display: 'ε', latex: '\\varepsilon', name: 'varepsilon', category: 'greek' },
  { display: 'ζ', latex: '\\zeta', name: 'zeta', category: 'greek' },
  { display: 'η', latex: '\\eta', name: 'eta', category: 'greek' },
  { display: 'θ', latex: '\\theta', name: 'theta', category: 'greek' },
  { display: 'ϑ', latex: '\\vartheta', name: 'vartheta', category: 'greek' },
  { display: 'ι', latex: '\\iota', name: 'iota', category: 'greek' },
  { display: 'κ', latex: '\\kappa', name: 'kappa', category: 'greek' },
  { display: 'λ', latex: '\\lambda', name: 'lambda', category: 'greek' },
  { display: 'μ', latex: '\\mu', name: 'mu', category: 'greek' },
  { display: 'ν', latex: '\\nu', name: 'nu', category: 'greek' },
  { display: 'ξ', latex: '\\xi', name: 'xi', category: 'greek' },
  { display: 'π', latex: '\\pi', name: 'pi', category: 'greek' },
  { display: 'ϖ', latex: '\\varpi', name: 'varpi', category: 'greek' },
  { display: 'ρ', latex: '\\rho', name: 'rho', category: 'greek' },
  { display: 'ϱ', latex: '\\varrho', name: 'varrho', category: 'greek' },
  { display: 'σ', latex: '\\sigma', name: 'sigma', category: 'greek' },
  { display: 'ς', latex: '\\varsigma', name: 'varsigma', category: 'greek' },
  { display: 'τ', latex: '\\tau', name: 'tau', category: 'greek' },
  { display: 'υ', latex: '\\upsilon', name: 'upsilon', category: 'greek' },
  { display: 'ϕ', latex: '\\phi', name: 'phi', category: 'greek' },
  { display: 'φ', latex: '\\varphi', name: 'varphi', category: 'greek' },
  { display: 'χ', latex: '\\chi', name: 'chi', category: 'greek' },
  { display: 'ψ', latex: '\\psi', name: 'psi', category: 'greek' },
  { display: 'ω', latex: '\\omega', name: 'omega', category: 'greek' },

  // ── Greek Uppercase ──────────────────────────────────────────────
  { display: 'Γ', latex: '\\Gamma', name: 'Gamma (cap)', category: 'greek' },
  { display: 'Δ', latex: '\\Delta', name: 'Delta (cap)', category: 'greek' },
  { display: 'Θ', latex: '\\Theta', name: 'Theta (cap)', category: 'greek' },
  { display: 'Λ', latex: '\\Lambda', name: 'Lambda (cap)', category: 'greek' },
  { display: 'Ξ', latex: '\\Xi', name: 'Xi (cap)', category: 'greek' },
  { display: 'Π', latex: '\\Pi', name: 'Pi (cap)', category: 'greek' },
  { display: 'Σ', latex: '\\Sigma', name: 'Sigma (cap)', category: 'greek' },
  { display: 'Υ', latex: '\\Upsilon', name: 'Upsilon (cap)', category: 'greek' },
  { display: 'Φ', latex: '\\Phi', name: 'Phi (cap)', category: 'greek' },
  { display: 'Ψ', latex: '\\Psi', name: 'Psi (cap)', category: 'greek' },
  { display: 'Ω', latex: '\\Omega', name: 'Omega (cap)', category: 'greek' },

  // ── Operators & Calculus ─────────────────────────────────────────
  { display: 'a/b', latex: '\\frac{a}{b}', name: 'fraction', category: 'operators', description: 'Fraction' },
  { display: '√x', latex: '\\sqrt{x}', name: 'square root', category: 'operators', description: 'Square root' },
  { display: 'ⁿ√x', latex: '\\sqrt[n]{x}', name: 'nth root', category: 'operators', description: 'Nth root' },
  { display: '∫', latex: '\\int_{a}^{b} f(x)\\,dx', name: 'integral with limits', category: 'operators' },
  { display: '∬', latex: '\\iint', name: 'double integral', category: 'operators' },
  { display: '∭', latex: '\\iiint', name: 'triple integral', category: 'operators' },
  { display: '∮', latex: '\\oint', name: 'contour integral', category: 'operators' },
  { display: '∑', latex: '\\sum_{i=1}^{n}', name: 'summation', category: 'operators' },
  { display: '∏', latex: '\\prod_{i=1}^{n}', name: 'product', category: 'operators' },
  { display: 'lim', latex: '\\lim_{x \\to \\infty}', name: 'limit', category: 'operators' },
  { display: '∂', latex: '\\partial', name: 'partial derivative', category: 'operators' },
  { display: '∂f/∂x', latex: '\\frac{\\partial f}{\\partial x}', name: 'partial fraction', category: 'operators' },
  { display: '∇', latex: '\\nabla', name: 'nabla gradient', category: 'operators' },
  { display: '±', latex: '\\pm', name: 'plus minus', category: 'operators' },
  { display: '∓', latex: '\\mp', name: 'minus plus', category: 'operators' },
  { display: '×', latex: '\\times', name: 'times multiplication', category: 'operators' },
  { display: '·', latex: '\\cdot', name: 'dot product', category: 'operators' },
  { display: '÷', latex: '\\div', name: 'division', category: 'operators' },
  { display: '∞', latex: '\\infty', name: 'infinity', category: 'operators' },
  { display: '⊕', latex: '\\oplus', name: 'direct sum oplus', category: 'operators' },
  { display: '⊗', latex: '\\otimes', name: 'tensor product otimes', category: 'operators' },
  { display: 'xⁿ', latex: 'x^{n}', name: 'superscript power', category: 'operators' },
  { display: 'xᵢ', latex: 'x_{i}', name: 'subscript index', category: 'operators' },

  // ── Relations & Sets ─────────────────────────────────────────────
  { display: '≤', latex: '\\le', name: 'less than or equal', category: 'relations' },
  { display: '≥', latex: '\\ge', name: 'greater than or equal', category: 'relations' },
  { display: '≠', latex: '\\neq', name: 'not equal', category: 'relations' },
  { display: '≈', latex: '\\approx', name: 'approximately equal', category: 'relations' },
  { display: '≡', latex: '\\equiv', name: 'equivalent', category: 'relations' },
  { display: '∼', latex: '\\sim', name: 'similar', category: 'relations' },
  { display: '∝', latex: '\\propto', name: 'proportional to', category: 'relations' },
  { display: '≪', latex: '\\ll', name: 'much less than', category: 'relations' },
  { display: '≫', latex: '\\gg', name: 'much greater than', category: 'relations' },
  { display: '⊥', latex: '\\perp', name: 'perpendicular orthogonal', category: 'relations' },
  { display: '∥', latex: '\\parallel', name: 'parallel', category: 'relations' },
  { display: '→', latex: '\\rightarrow', name: 'right arrow to', category: 'relations' },
  { display: '⇒', latex: '\\Rightarrow', name: 'implies arrow', category: 'relations' },
  { display: '←', latex: '\\leftarrow', name: 'left arrow', category: 'relations' },
  { display: '⇐', latex: '\\Leftarrow', name: 'left implies', category: 'relations' },
  { display: '↔', latex: '\\leftrightarrow', name: 'bidirectional arrow', category: 'relations' },
  { display: '⇔', latex: '\\Leftrightarrow', name: 'iff if and only if', category: 'relations' },
  { display: '↦', latex: '\\mapsto', name: 'maps to', category: 'relations' },
  { display: '∈', latex: '\\in', name: 'element of in', category: 'relations' },
  { display: '∉', latex: '\\notin', name: 'not in', category: 'relations' },
  { display: '⊂', latex: '\\subset', name: 'subset', category: 'relations' },
  { display: '⊆', latex: '\\subseteq', name: 'subset or equal', category: 'relations' },
  { display: '∪', latex: '\\cup', name: 'union', category: 'relations' },
  { display: '∩', latex: '\\cap', name: 'intersection', category: 'relations' },
  { display: '∅', latex: '\\emptyset', name: 'empty set', category: 'relations' },
  { display: '∀', latex: '\\forall', name: 'for all universal', category: 'relations' },
  { display: '∃', latex: '\\exists', name: 'exists existential', category: 'relations' },
  { display: '¬', latex: '\\neg', name: 'negation not', category: 'relations' },

  // ── Structures & Matrices ─────────────────────────────────────────
  {
    display: '( a b )',
    latex: '\\begin{pmatrix}\n  a & b \\\\\n  c & d\n\\end{pmatrix}',
    name: 'pmatrix round matrix 2x2',
    category: 'structures',
    description: 'Round Matrix (2x2)',
  },
  {
    display: '[ a b ]',
    latex: '\\begin{bmatrix}\n  a & b \\\\\n  c & d\n\\end{bmatrix}',
    name: 'bmatrix square matrix 2x2',
    category: 'structures',
    description: 'Square Matrix (2x2)',
  },
  {
    display: '| a b |',
    latex: '\\begin{vmatrix}\n  a & b \\\\\n  c & d\n\\end{vmatrix}',
    name: 'vmatrix determinant',
    category: 'structures',
    description: 'Determinant (2x2)',
  },
  {
    display: '{ cases',
    latex: '\\begin{cases}\n  x + y = 1 \\\\\n  x - y = 0\n\\end{cases}',
    name: 'cases system piecewise',
    category: 'structures',
    description: 'Piecewise / Cases system',
  },
  {
    display: '( · )',
    latex: '\\left( \\frac{a}{b} \\right)',
    name: 'left right parentheses',
    category: 'structures',
    description: 'Auto-sizing Parentheses',
  },
  {
    display: '[ · ]',
    latex: '\\left[ \\frac{a}{b} \\right]',
    name: 'left right brackets',
    category: 'structures',
    description: 'Auto-sizing Brackets',
  },
  {
    display: '{ · }',
    latex: '\\left\\{ \\frac{a}{b} \\right\\}',
    name: 'left right curly braces',
    category: 'structures',
    description: 'Auto-sizing Braces',
  },
  {
    display: '| x |',
    latex: '\\left| x \\right|',
    name: 'absolute value norm',
    category: 'structures',
    description: 'Absolute Value',
  },
  {
    display: '‖ x ‖',
    latex: '\\left\\| x \\right\\|',
    name: 'norm vector',
    category: 'structures',
    description: 'Vector Norm',
  },
  {
    display: 'v⃗',
    latex: '\\vec{v}',
    name: 'vector arrow',
    category: 'structures',
    description: 'Vector Arrow',
  },
  {
    display: 'x̄',
    latex: '\\bar{x}',
    name: 'bar average',
    category: 'structures',
    description: 'Bar / Mean',
  },
  {
    display: 'x̂',
    latex: '\\hat{x}',
    name: 'hat unit vector estimator',
    category: 'structures',
    description: 'Hat Estimator',
  },
];

export interface MathSymbolPaletteProps {
  onInsert: (snippet: string) => void;
  trigger?: React.ReactNode;
}

export function MathSymbolPalette({ onInsert, trigger }: MathSymbolPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'greek' | 'operators' | 'relations' | 'structures'>('greek');

  const filteredSymbols = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return MATH_SYMBOLS.filter((s) => s.category === activeTab);
    }
    return MATH_SYMBOLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.latex.toLowerCase().includes(q) ||
        s.display.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q),
    );
  }, [search, activeTab]);

  const handleSelect = (latex: string) => {
    onInsert(latex);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <button
            type="button"
            aria-label="LaTeX Math Symbol Palette"
            className="h-7 px-1.5 flex items-center justify-center gap-1 rounded text-xs font-medium text-foreground hover:bg-muted active:scale-95 outline-none transition-all duration-150 select-none"
          >
            <Pi className="size-3.5 shrink-0 text-primary" />
            <span className="text-xs">Symbols</span>
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        className="w-[390px] p-2.5 z-[9999] shadow-xl border border-border bg-popover/95 backdrop-blur-md rounded-lg"
      >
        {/* Header Title & Search Input */}
        <div className="space-y-2 mb-2">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground px-0.5">
            <div className="flex items-center gap-1.5">
              <Sigma className="size-4 text-primary shrink-0" />
              <span>Math Symbol Palette</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Click to insert
            </span>
          </div>

          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbols (e.g. alpha, sum, frac, matrix)..."
              className="h-7 pl-8 pr-2 text-xs bg-muted/50 border-border focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        </div>

        {/* Tab Selection (Hidden while searching) */}
        {!search.trim() ? (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-4 h-7 p-0.5 bg-muted/60 rounded-md mb-2">
              <TabsTrigger value="greek" className="text-[11px] py-0.5 h-6">
                Greek
              </TabsTrigger>
              <TabsTrigger value="operators" className="text-[11px] py-0.5 h-6">
                Operators
              </TabsTrigger>
              <TabsTrigger value="relations" className="text-[11px] py-0.5 h-6">
                Relations
              </TabsTrigger>
              <TabsTrigger value="structures" className="text-[11px] py-0.5 h-6">
                Matrices
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              <div className="h-[200px] overflow-y-auto pr-1 select-none">
                {activeTab === 'structures' ? (
                  /* Structure / Matrix Grid (2 columns) */
                  <div className="grid grid-cols-2 gap-1.5">
                    {filteredSymbols.map((item) => (
                      <Tooltip key={item.latex}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleSelect(item.latex)}
                            className="flex items-center gap-2 p-1.5 rounded-md border border-border/60 hover:border-primary/50 hover:bg-primary/10 text-foreground transition-colors text-left group"
                          >
                            <span className="font-mono text-xs font-semibold text-primary px-1 py-0.5 rounded bg-muted/50 shrink-0">
                              {item.display}
                            </span>
                            <span className="text-[11px] text-muted-foreground group-hover:text-foreground truncate">
                              {item.description || item.name}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs font-mono">
                          {item.latex}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                ) : (
                  /* Symbol Grid (7 columns) */
                  <div className="grid grid-cols-7 gap-1">
                    {filteredSymbols.map((item) => (
                      <Tooltip key={item.latex}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleSelect(item.latex)}
                            className="h-8 flex items-center justify-center rounded-md border border-transparent hover:border-border hover:bg-muted text-foreground font-serif text-sm transition-all duration-100 active:scale-90"
                          >
                            {item.display}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <span className="font-mono text-primary mr-1.5">{item.latex}</span>
                          <span className="text-muted-foreground">({item.name})</span>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          /* Search Results */
          <div className="h-[230px] overflow-y-auto pr-1 select-none">
            {filteredSymbols.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs gap-1 py-6">
                <Sparkles className="size-4 opacity-40" />
                <span>No symbols found for &quot;{search}&quot;</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {filteredSymbols.map((item) => (
                  <Tooltip key={item.latex}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleSelect(item.latex)}
                        className="flex items-center gap-2 p-1.5 rounded-md border border-border/60 hover:border-primary/50 hover:bg-primary/10 text-foreground transition-colors text-left group"
                      >
                        <span className="font-serif text-sm font-semibold text-primary px-1.5 py-0.5 rounded bg-muted/60 shrink-0 min-w-6 text-center">
                          {item.display}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-mono text-foreground truncate">
                            {item.latex}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            {item.name}
                          </span>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs font-mono">
                      {item.latex}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

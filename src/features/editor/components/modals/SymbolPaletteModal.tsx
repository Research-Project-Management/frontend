'use client';

import React, { useState, useMemo } from 'react';
import {
  Sigma,
  Search,
  Check,
  Sparkles,
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
  Button,
  Input,
  Checkbox,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

export interface SymbolPaletteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (latexSymbol: string) => void;
}

interface MathSymbol {
  command: string;
  display: string;
  name: string;
  category: 'greek-lower' | 'greek-upper' | 'operators' | 'relations' | 'arrows' | 'delimiters';
}

const SYMBOLS: MathSymbol[] = [
  // ── Greek Lowercase ───────────────────────────────────────────
  { command: '\\alpha', display: 'α', name: 'alpha', category: 'greek-lower' },
  { command: '\\beta', display: 'β', name: 'beta', category: 'greek-lower' },
  { command: '\\gamma', display: 'γ', name: 'gamma', category: 'greek-lower' },
  { command: '\\delta', display: 'δ', name: 'delta', category: 'greek-lower' },
  { command: '\\epsilon', display: 'ϵ', name: 'epsilon', category: 'greek-lower' },
  { command: '\\varepsilon', display: 'ε', name: 'varepsilon', category: 'greek-lower' },
  { command: '\\zeta', display: 'ζ', name: 'zeta', category: 'greek-lower' },
  { command: '\\eta', display: 'η', name: 'eta', category: 'greek-lower' },
  { command: '\\theta', display: 'θ', name: 'theta', category: 'greek-lower' },
  { command: '\\vartheta', display: 'ϑ', name: 'vartheta', category: 'greek-lower' },
  { command: '\\iota', display: 'ι', name: 'iota', category: 'greek-lower' },
  { command: '\\kappa', display: 'κ', name: 'kappa', category: 'greek-lower' },
  { command: '\\lambda', display: 'λ', name: 'lambda', category: 'greek-lower' },
  { command: '\\mu', display: 'μ', name: 'mu', category: 'greek-lower' },
  { command: '\\nu', display: 'ν', name: 'nu', category: 'greek-lower' },
  { command: '\\xi', display: 'ξ', name: 'xi', category: 'greek-lower' },
  { command: '\\pi', display: 'π', name: 'pi', category: 'greek-lower' },
  { command: '\\varpi', display: 'ϖ', name: 'varpi', category: 'greek-lower' },
  { command: '\\rho', display: 'ρ', name: 'rho', category: 'greek-lower' },
  { command: '\\varrho', display: 'ϱ', name: 'varrho', category: 'greek-lower' },
  { command: '\\sigma', display: 'σ', name: 'sigma', category: 'greek-lower' },
  { command: '\\varsigma', display: 'ς', name: 'varsigma', category: 'greek-lower' },
  { command: '\\tau', display: 'τ', name: 'tau', category: 'greek-lower' },
  { command: '\\upsilon', display: 'υ', name: 'upsilon', category: 'greek-lower' },
  { command: '\\phi', display: 'ϕ', name: 'phi', category: 'greek-lower' },
  { command: '\\varphi', display: 'φ', name: 'varphi', category: 'greek-lower' },
  { command: '\\chi', display: 'χ', name: 'chi', category: 'greek-lower' },
  { command: '\\psi', display: 'ψ', name: 'psi', category: 'greek-lower' },
  { command: '\\omega', display: 'ω', name: 'omega', category: 'greek-lower' },

  // ── Greek Uppercase ───────────────────────────────────────────
  { command: '\\Gamma', display: 'Γ', name: 'Gamma', category: 'greek-upper' },
  { command: '\\Delta', display: 'Δ', name: 'Delta', category: 'greek-upper' },
  { command: '\\Theta', display: 'Θ', name: 'Theta', category: 'greek-upper' },
  { command: '\\Lambda', display: 'Λ', name: 'Lambda', category: 'greek-upper' },
  { command: '\\Xi', display: 'Ξ', name: 'Xi', category: 'greek-upper' },
  { command: '\\Pi', display: 'Π', name: 'Pi', category: 'greek-upper' },
  { command: '\\Sigma', display: 'Σ', name: 'Sigma', category: 'greek-upper' },
  { command: '\\Upsilon', display: 'Υ', name: 'Upsilon', category: 'greek-upper' },
  { command: '\\Phi', display: 'Φ', name: 'Phi', category: 'greek-upper' },
  { command: '\\Psi', display: 'Ψ', name: 'Psi', category: 'greek-upper' },
  { command: '\\Omega', display: 'Ω', name: 'Omega', category: 'greek-upper' },

  // ── Operators & Calculus ──────────────────────────────────────
  { command: '\\pm', display: '±', name: 'plus-minus', category: 'operators' },
  { command: '\\mp', display: '∓', name: 'minus-plus', category: 'operators' },
  { command: '\\times', display: '×', name: 'times multiply', category: 'operators' },
  { command: '\\div', display: '÷', name: 'divide', category: 'operators' },
  { command: '\\cdot', display: '·', name: 'center dot', category: 'operators' },
  { command: '\\ast', display: '∗', name: 'asterisk', category: 'operators' },
  { command: '\\star', display: '⋆', name: 'star', category: 'operators' },
  { command: '\\circ', display: '∘', name: 'compose circle', category: 'operators' },
  { command: '\\bullet', display: '•', name: 'bullet', category: 'operators' },
  { command: '\\oplus', display: '⊕', name: 'direct sum oplus', category: 'operators' },
  { command: '\\otimes', display: '⊗', name: 'tensor product otimes', category: 'operators' },
  { command: '\\int', display: '∫', name: 'integral', category: 'operators' },
  { command: '\\iint', display: '∬', name: 'double integral', category: 'operators' },
  { command: '\\iiint', display: '∭', name: 'triple integral', category: 'operators' },
  { command: '\\oint', display: '∮', name: 'contour integral', category: 'operators' },
  { command: '\\sum_{i=1}^{n}', display: '∑', name: 'summation sum', category: 'operators' },
  { command: '\\prod_{i=1}^{n}', display: '∏', name: 'product', category: 'operators' },
  { command: '\\coprod', display: '∐', name: 'coproduct', category: 'operators' },
  { command: '\\partial', display: '∂', name: 'partial derivative', category: 'operators' },
  { command: '\\nabla', display: '∇', name: 'nabla gradient del', category: 'operators' },
  { command: '\\infty', display: '∞', name: 'infinity', category: 'operators' },

  // ── Relations & Sets ──────────────────────────────────────────
  { command: '\\le', display: '≤', name: 'less than or equal', category: 'relations' },
  { command: '\\ge', display: '≥', name: 'greater than or equal', category: 'relations' },
  { command: '\\neq', display: '≠', name: 'not equal', category: 'relations' },
  { command: '\\approx', display: '≈', name: 'approximate', category: 'relations' },
  { command: '\\equiv', display: '≡', name: 'equivalent', category: 'relations' },
  { command: '\\sim', display: '∼', name: 'similar', category: 'relations' },
  { command: '\\simeq', display: '≃', name: 'asymptotically equal', category: 'relations' },
  { command: '\\ll', display: '≪', name: 'much less than', category: 'relations' },
  { command: '\\gg', display: '≫', name: 'much greater than', category: 'relations' },
  { command: '\\in', display: '∈', name: 'element of in', category: 'relations' },
  { command: '\\notin', display: '∉', name: 'not in', category: 'relations' },
  { command: '\\ni', display: '∋', name: 'contains as member', category: 'relations' },
  { command: '\\subset', display: '⊂', name: 'subset', category: 'relations' },
  { command: '\\supset', display: '⊃', name: 'superset', category: 'relations' },
  { command: '\\subseteq', display: '⊆', name: 'subset or equal', category: 'relations' },
  { command: '\\supseteq', display: '⊇', name: 'superset or equal', category: 'relations' },
  { command: '\\cap', display: '∩', name: 'intersection cap', category: 'relations' },
  { command: '\\cup', display: '∪', name: 'union cup', category: 'relations' },
  { command: '\\emptyset', display: '∅', name: 'empty set', category: 'relations' },
  { command: '\\propto', display: '∝', name: 'proportional to', category: 'relations' },
  { command: '\\perp', display: '⊥', name: 'perpendicular orthogonal', category: 'relations' },
  { command: '\\parallel', display: '∥', name: 'parallel', category: 'relations' },

  // ── Arrows & Logic ────────────────────────────────────────────
  { command: '\\leftarrow', display: '←', name: 'left arrow', category: 'arrows' },
  { command: '\\rightarrow', display: '→', name: 'right arrow', category: 'arrows' },
  { command: '\\leftrightarrow', display: '↔', name: 'left right arrow', category: 'arrows' },
  { command: '\\Leftarrow', display: '⇐', name: 'double left arrow', category: 'arrows' },
  { command: '\\Rightarrow', display: '⇒', name: 'implies double right arrow', category: 'arrows' },
  { command: '\\Leftrightarrow', display: '⇔', name: 'iff double left right arrow', category: 'arrows' },
  { command: '\\mapsto', display: '↦', name: 'maps to', category: 'arrows' },
  { command: '\\uparrow', display: '↑', name: 'up arrow', category: 'arrows' },
  { command: '\\downarrow', display: '↓', name: 'down arrow', category: 'arrows' },
  { command: '\\forall', display: '∀', name: 'for all universal', category: 'arrows' },
  { command: '\\exists', display: '∃', name: 'exists existential', category: 'arrows' },
  { command: '\\neg', display: '¬', name: 'not negation', category: 'arrows' },
  { command: '\\land', display: '∧', name: 'logical and wedge', category: 'arrows' },
  { command: '\\lor', display: '∨', name: 'logical or vee', category: 'arrows' },

  // ── Accents & Delimiters ──────────────────────────────────────
  { command: '\\frac{a}{b}', display: 'a/b', name: 'fraction frac', category: 'delimiters' },
  { command: '\\sqrt{x}', display: '√x', name: 'square root sqrt', category: 'delimiters' },
  { command: '\\sqrt[n]{x}', display: 'ⁿ√x', name: 'nth root', category: 'delimiters' },
  { command: '\\hat{x}', display: 'x̂', name: 'hat accent', category: 'delimiters' },
  { command: '\\bar{x}', display: 'x̄', name: 'bar accent', category: 'delimiters' },
  { command: '\\vec{x}', display: 'x⃗', name: 'vector vec', category: 'delimiters' },
  { command: '\\dot{x}', display: 'ẋ', name: 'dot derivative', category: 'delimiters' },
  { command: '\\ddot{x}', display: 'ẍ', name: 'double dot derivative', category: 'delimiters' },
  { command: '\\tilde{x}', display: 'x̃', name: 'tilde', category: 'delimiters' },
  { command: '\\left\\{ x \\right\\}', display: '{x}', name: 'curly braces set', category: 'delimiters' },
  { command: '\\left\\langle x \\right\\rangle', display: '⟨x⟩', name: 'angle brackets', category: 'delimiters' },
  { command: '\\left\\lfloor x \\right\\rfloor', display: '⌊x⌋', name: 'floor', category: 'delimiters' },
  { command: '\\left\\lceil x \\right\\rceil', display: '⌈x⌉', name: 'ceiling', category: 'delimiters' },
];

export default function SymbolPaletteModal({
  open,
  onOpenChange,
  onInsert,
}: SymbolPaletteModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [keepOpen, setKeepOpen] = useState(true);
  const [lastInserted, setLastInserted] = useState<string | null>(null);

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

  const handleSymbolClick = (sym: MathSymbol) => {
    onInsert(`${sym.command} `);
    setLastInserted(sym.command);
    toast.success(`Inserted ${sym.command}`, { duration: 1200 });

    if (!keepOpen) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 gap-3.5 text-xs bg-background border border-border shadow-raised-300 rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sigma className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                LaTeX Symbol Palette
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Click any symbol to insert directly into your document at current cursor.
              </DialogDescription>
            </div>
          </div>
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
              onClick={() => setSearchQuery('')}
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
                      onClick={() => handleSymbolClick(sym)}
                      title={`${sym.command} (${sym.name})`}
                      className={cn(
                        'group flex flex-col items-center justify-center h-12 rounded-sm border transition-all cursor-pointer',
                        isRecent
                          ? 'bg-primary/15 border-primary text-primary font-bold shadow-2xs'
                          : 'bg-background border-border hover:border-primary/50 hover:bg-primary/5 text-foreground shadow-2xs'
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
            className="h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-2xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

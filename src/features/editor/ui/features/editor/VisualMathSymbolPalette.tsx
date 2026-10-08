'use client';

/**
 * VisualMathSymbolPalette.tsx
 *
 * KaTeX Quick-Symbol & LaTeX Template Palette for Visual Mode Math Editor.
 * Location: `features/editor/ui/features/editor/VisualMathSymbolPalette.tsx`
 *
 * Provides instant 1-click insertion for:
 * - Basic math operations & fractions (\frac, \sqrt, powers, sub/super, \pm, \times)
 * - Greek alphabet (lowercase & uppercase)
 * - Calculus & operators (\int, \sum, \prod, \lim, \partial, \nabla)
 * - Relations & arrows (\to, \implies, \iff, \in, \subset, \cup, \cap)
 * - Matrix & piecewise environments (pmatrix, bmatrix, vmatrix, cases, aligned)
 */

import React, { useState, useMemo } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { renderMathHtml } from '@/features/editor/domain/latex/latex-converter';

export type MathPaletteCategory = 'basic' | 'greek' | 'operators' | 'arrows' | 'matrix';

export interface MathSymbolItem {
  id: string;
  latex: string;
  previewLatex?: string;
  name: string;
  category: MathPaletteCategory;
  keywords: string[];
}

export const MATH_SYMBOLS: MathSymbolItem[] = [
  // ── 1. Basic Operations & Delimiters ──
  { id: 'frac', latex: '\\frac{a}{b}', previewLatex: '\\frac{a}{b}', name: 'Fraction', category: 'basic', keywords: ['frac', 'division', 'over'] },
  { id: 'sqrt', latex: '\\sqrt{x}', previewLatex: '\\sqrt{x}', name: 'Square Root', category: 'basic', keywords: ['sqrt', 'root'] },
  { id: 'nth-sqrt', latex: '\\sqrt[n]{x}', previewLatex: '\\sqrt[n]{x}', name: 'N-th Root', category: 'basic', keywords: ['root', 'radical', 'cbrt'] },
  { id: 'pow', latex: 'x^{2}', previewLatex: 'x^{2}', name: 'Superscript', category: 'basic', keywords: ['pow', 'exponent', 'power', 'square'] },
  { id: 'sub', latex: 'x_{i}', previewLatex: 'x_{i}', name: 'Subscript', category: 'basic', keywords: ['sub', 'index'] },
  { id: 'pm', latex: '\\pm', previewLatex: '\\pm', name: 'Plus-Minus', category: 'basic', keywords: ['pm', 'plus', 'minus'] },
  { id: 'mp', latex: '\\mp', previewLatex: '\\mp', name: 'Minus-Plus', category: 'basic', keywords: ['mp', 'minus', 'plus'] },
  { id: 'times', latex: '\\times', previewLatex: '\\times', name: 'Multiply', category: 'basic', keywords: ['times', 'multiply', 'x'] },
  { id: 'div', latex: '\\div', previewLatex: '\\div', name: 'Divide', category: 'basic', keywords: ['div', 'divide'] },
  { id: 'cdot', latex: '\\cdot', previewLatex: '\\cdot', name: 'Center Dot', category: 'basic', keywords: ['dot', 'multiply', 'point'] },
  { id: 'neq', latex: '\\neq', previewLatex: '\\neq', name: 'Not Equal', category: 'basic', keywords: ['neq', 'not equal', 'different'] },
  { id: 'leq', latex: '\\leq', previewLatex: '\\leq', name: 'Less or Equal', category: 'basic', keywords: ['leq', 'less', 'smaller'] },
  { id: 'geq', latex: '\\geq', previewLatex: '\\geq', name: 'Greater or Equal', category: 'basic', keywords: ['geq', 'greater', 'bigger'] },
  { id: 'approx', latex: '\\approx', previewLatex: '\\approx', name: 'Approximately', category: 'basic', keywords: ['approx', 'almost', 'tilde'] },
  { id: 'equiv', latex: '\\equiv', previewLatex: '\\equiv', name: 'Equivalent', category: 'basic', keywords: ['equiv', 'identity'] },
  { id: 'infty', latex: '\\infty', previewLatex: '\\infty', name: 'Infinity', category: 'basic', keywords: ['infty', 'infinite', 'loop'] },
  { id: 'parens', latex: '\\left( x \\right)', previewLatex: '(x)', name: 'Parentheses', category: 'basic', keywords: ['parens', 'left', 'right'] },
  { id: 'brackets', latex: '\\left[ x \\right]', previewLatex: '[x]', name: 'Brackets', category: 'basic', keywords: ['brackets', 'square'] },
  { id: 'braces', latex: '\\left\\{ x \\right\\}', previewLatex: '\\{x\\}', name: 'Braces', category: 'basic', keywords: ['braces', 'set'] },
  { id: 'abs', latex: '\\left| x \\right|', previewLatex: '|x|', name: 'Absolute Value', category: 'basic', keywords: ['abs', 'norm', 'modulus'] },
  { id: 'vec', latex: '\\vec{v}', previewLatex: '\\vec{v}', name: 'Vector', category: 'basic', keywords: ['vec', 'vector', 'arrow'] },
  { id: 'hat', latex: '\\hat{x}', previewLatex: '\\hat{x}', name: 'Hat Accent', category: 'basic', keywords: ['hat', 'accent'] },
  { id: 'bar', latex: '\\bar{x}', previewLatex: '\\bar{x}', name: 'Bar Accent', category: 'basic', keywords: ['bar', 'average', 'mean'] },

  // ── 2. Greek Alphabet ──
  { id: 'alpha', latex: '\\alpha', previewLatex: '\\alpha', name: 'alpha', category: 'greek', keywords: ['alpha', 'greek'] },
  { id: 'beta', latex: '\\beta', previewLatex: '\\beta', name: 'beta', category: 'greek', keywords: ['beta', 'greek'] },
  { id: 'gamma', latex: '\\gamma', previewLatex: '\\gamma', name: 'gamma', category: 'greek', keywords: ['gamma', 'greek'] },
  { id: 'delta', latex: '\\delta', previewLatex: '\\delta', name: 'delta', category: 'greek', keywords: ['delta', 'greek'] },
  { id: 'epsilon', latex: '\\epsilon', previewLatex: '\\epsilon', name: 'epsilon', category: 'greek', keywords: ['epsilon', 'greek'] },
  { id: 'zeta', latex: '\\zeta', previewLatex: '\\zeta', name: 'zeta', category: 'greek', keywords: ['zeta', 'greek'] },
  { id: 'eta', latex: '\\eta', previewLatex: '\\eta', name: 'eta', category: 'greek', keywords: ['eta', 'greek'] },
  { id: 'theta', latex: '\\theta', previewLatex: '\\theta', name: 'theta', category: 'greek', keywords: ['theta', 'angle'] },
  { id: 'lambda', latex: '\\lambda', previewLatex: '\\lambda', name: 'lambda', category: 'greek', keywords: ['lambda', 'wavelength'] },
  { id: 'mu', latex: '\\mu', previewLatex: '\\mu', name: 'mu', category: 'greek', keywords: ['mu', 'micro'] },
  { id: 'pi', latex: '\\pi', previewLatex: '\\pi', name: 'pi', category: 'greek', keywords: ['pi', '3.14'] },
  { id: 'rho', latex: '\\rho', previewLatex: '\\rho', name: 'rho', category: 'greek', keywords: ['rho', 'density'] },
  { id: 'sigma', latex: '\\sigma', previewLatex: '\\sigma', name: 'sigma', category: 'greek', keywords: ['sigma', 'std'] },
  { id: 'tau', latex: '\\tau', previewLatex: '\\tau', name: 'tau', category: 'greek', keywords: ['tau', 'time'] },
  { id: 'phi', latex: '\\phi', previewLatex: '\\phi', name: 'phi', category: 'greek', keywords: ['phi', 'angle'] },
  { id: 'psi', latex: '\\psi', previewLatex: '\\psi', name: 'psi', category: 'greek', keywords: ['psi', 'wavefunction'] },
  { id: 'omega', latex: '\\omega', previewLatex: '\\omega', name: 'omega', category: 'greek', keywords: ['omega', 'frequency'] },
  // Uppercase
  { id: 'Gamma', latex: '\\Gamma', previewLatex: '\\Gamma', name: 'Gamma', category: 'greek', keywords: ['gamma', 'capital'] },
  { id: 'Delta', latex: '\\Delta', previewLatex: '\\Delta', name: 'Delta', category: 'greek', keywords: ['delta', 'change', 'laplacian'] },
  { id: 'Theta', latex: '\\Theta', previewLatex: '\\Theta', name: 'Theta', category: 'greek', keywords: ['theta', 'capital'] },
  { id: 'Lambda', latex: '\\Lambda', previewLatex: '\\Lambda', name: 'Lambda', category: 'greek', keywords: ['lambda', 'capital'] },
  { id: 'Sigma', latex: '\\Sigma', previewLatex: '\\Sigma', name: 'Sigma', category: 'greek', keywords: ['sigma', 'sum', 'capital'] },
  { id: 'Phi', latex: '\\Phi', previewLatex: '\\Phi', name: 'Phi', category: 'greek', keywords: ['phi', 'capital'] },
  { id: 'Psi', latex: '\\Psi', previewLatex: '\\Psi', name: 'Psi', category: 'greek', keywords: ['psi', 'capital'] },
  { id: 'Omega', latex: '\\Omega', previewLatex: '\\Omega', name: 'Omega', category: 'greek', keywords: ['omega', 'ohm', 'capital'] },

  // ── 3. Calculus & Operators ──
  { id: 'int-def', latex: '\\int_{a}^{b} f(x) \\, dx', previewLatex: '\\int_{a}^{b}', name: 'Definite Integral', category: 'operators', keywords: ['int', 'integral', 'definite', 'dx'] },
  { id: 'int', latex: '\\int f(x) \\, dx', previewLatex: '\\int', name: 'Integral', category: 'operators', keywords: ['int', 'integral', 'dx'] },
  { id: 'iint', latex: '\\iint', previewLatex: '\\iint', name: 'Double Integral', category: 'operators', keywords: ['iint', 'double integral'] },
  { id: 'iiint', latex: '\\iiint', previewLatex: '\\iiint', name: 'Triple Integral', category: 'operators', keywords: ['iiint', 'triple integral'] },
  { id: 'oint', latex: '\\oint', previewLatex: '\\oint', name: 'Contour Integral', category: 'operators', keywords: ['oint', 'loop', 'contour'] },
  { id: 'sum', latex: '\\sum_{i=1}^{n}', previewLatex: '\\sum_{i=1}^{n}', name: 'Summation', category: 'operators', keywords: ['sum', 'sigma', 'series'] },
  { id: 'prod', latex: '\\prod_{i=1}^{n}', previewLatex: '\\prod_{i=1}^{n}', name: 'Product', category: 'operators', keywords: ['prod', 'product', 'series'] },
  { id: 'lim', latex: '\\lim_{x \\to \\infty}', previewLatex: '\\lim_{x \\to \\infty}', name: 'Limit', category: 'operators', keywords: ['lim', 'limit'] },
  { id: 'pdiff', latex: '\\frac{\\partial f}{\\partial x}', previewLatex: '\\frac{\\partial f}{\\partial x}', name: 'Partial Derivative', category: 'operators', keywords: ['pdiff', 'partial', 'derivative'] },
  { id: 'diff', latex: '\\frac{df}{dx}', previewLatex: '\\frac{df}{dx}', name: 'Derivative', category: 'operators', keywords: ['diff', 'derivative', 'dfdx'] },
  { id: 'partial', latex: '\\partial', previewLatex: '\\partial', name: 'Partial Symbol', category: 'operators', keywords: ['partial'] },
  { id: 'nabla', latex: '\\nabla', previewLatex: '\\nabla', name: 'Nabla / Del', category: 'operators', keywords: ['nabla', 'gradient', 'del'] },

  // ── 4. Relations & Arrows ──
  { id: 'to', latex: '\\to', previewLatex: '\\to', name: 'Right Arrow', category: 'arrows', keywords: ['to', 'arrow', 'right'] },
  { id: 'gets', latex: '\\gets', previewLatex: '\\gets', name: 'Left Arrow', category: 'arrows', keywords: ['gets', 'arrow', 'left'] },
  { id: 'leftrightarrow', latex: '\\leftrightarrow', previewLatex: '\\leftrightarrow', name: 'Left-Right Arrow', category: 'arrows', keywords: ['leftrightarrow', 'arrow', 'both'] },
  { id: 'implies', latex: '\\implies', previewLatex: '\\implies', name: 'Implies', category: 'arrows', keywords: ['implies', 'rightarrow'] },
  { id: 'iff', latex: '\\iff', previewLatex: '\\iff', name: 'If and only if', category: 'arrows', keywords: ['iff', 'equivalent'] },
  { id: 'mapsto', latex: '\\mapsto', previewLatex: '\\mapsto', name: 'Maps to', category: 'arrows', keywords: ['mapsto', 'function'] },
  { id: 'in', latex: '\\in', previewLatex: '\\in', name: 'Element of', category: 'arrows', keywords: ['in', 'element', 'member'] },
  { id: 'notin', latex: '\\notin', previewLatex: '\\notin', name: 'Not an element of', category: 'arrows', keywords: ['notin', 'not element'] },
  { id: 'subset', latex: '\\subset', previewLatex: '\\subset', name: 'Subset', category: 'arrows', keywords: ['subset', 'inclusion'] },
  { id: 'subseteq', latex: '\\subseteq', previewLatex: '\\subseteq', name: 'Subset or equal', category: 'arrows', keywords: ['subseteq', 'inclusion'] },
  { id: 'cup', latex: '\\cup', previewLatex: '\\cup', name: 'Union', category: 'arrows', keywords: ['cup', 'union', 'set'] },
  { id: 'cap', latex: '\\cap', previewLatex: '\\cap', name: 'Intersection', category: 'arrows', keywords: ['cap', 'intersection', 'set'] },
  { id: 'forall', latex: '\\forall', previewLatex: '\\forall', name: 'For all', category: 'arrows', keywords: ['forall', 'quantifier'] },
  { id: 'exists', latex: '\\exists', previewLatex: '\\exists', name: 'Exists', category: 'arrows', keywords: ['exists', 'quantifier'] },
  { id: 'emptyset', latex: '\\emptyset', previewLatex: '\\emptyset', name: 'Empty Set', category: 'arrows', keywords: ['emptyset', 'empty', 'null'] },

  // ── 5. Matrices & Multiline Environments ──
  { id: 'pmatrix2x2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', previewLatex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', name: '2x2 Matrix', category: 'matrix', keywords: ['matrix', 'pmatrix', '2x2'] },
  { id: 'bmatrix2x2', latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', previewLatex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', name: 'Bracket Matrix', category: 'matrix', keywords: ['matrix', 'bmatrix', 'brackets'] },
  { id: 'vmatrix2x2', latex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', previewLatex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', name: 'Determinant Matrix', category: 'matrix', keywords: ['matrix', 'vmatrix', 'det'] },
  { id: 'pmatrix3x3', latex: '\\begin{pmatrix} a_{11} & a_{12} & a_{13} \\\\ a_{21} & a_{22} & a_{23} \\\\ a_{31} & a_{32} & a_{33} \\end{pmatrix}', previewLatex: '\\begin{pmatrix} a & \\dots \\\\ \\dots & d \\end{pmatrix}', name: '3x3 Matrix', category: 'matrix', keywords: ['matrix', 'pmatrix', '3x3'] },
  { id: 'cases', latex: '\\begin{cases} x & \\text{if } x \\ge 0 \\\\ -x & \\text{otherwise} \\end{cases}', previewLatex: '\\begin{cases} x \\\\ -x \\end{cases}', name: 'Piecewise Cases', category: 'matrix', keywords: ['cases', 'piecewise', 'condition'] },
  { id: 'aligned', latex: '\\begin{aligned}\n  a &= b + c \\\\\n  &= d + e\n\\end{aligned}', previewLatex: 'a &= b', name: 'Aligned Equations', category: 'matrix', keywords: ['aligned', 'align', 'equations'] },
];

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
      className={cn('space-y-2 border rounded-xl p-3 bg-muted/20 select-none text-xs', className)}
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
                'px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer shrink-0',
                activeTab === cat.id && !searchQuery
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
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
                    'h-9 flex items-center justify-center p-1 rounded-lg border border-border/60 bg-card hover:bg-primary/10 hover:border-primary/40',
                    'transition-all text-sm cursor-pointer shadow-xs active:scale-95 group'
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

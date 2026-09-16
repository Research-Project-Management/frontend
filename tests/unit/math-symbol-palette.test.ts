import { describe, it, expect } from 'vitest';
import {
  MATH_SYMBOLS,
  type MathSymbolItem,
} from '@/features/editor/components/editor/subcomponents/MathSymbolPalette';

describe('MathSymbolPalette Data & Functionality', () => {
  it('should load comprehensive math symbols across all 4 categories', () => {
    expect(MATH_SYMBOLS.length).toBeGreaterThan(60);

    const categories = new Set(MATH_SYMBOLS.map((s) => s.category));
    expect(categories.has('greek')).toBe(true);
    expect(categories.has('operators')).toBe(true);
    expect(categories.has('relations')).toBe(true);
    expect(categories.has('structures')).toBe(true);
  });

  it('should include key Greek characters both lowercase and uppercase', () => {
    const greek = MATH_SYMBOLS.filter((s) => s.category === 'greek');
    const latexCommands = new Set(greek.map((g) => g.latex));

    // Lowercase
    expect(latexCommands.has('\\alpha')).toBe(true);
    expect(latexCommands.has('\\beta')).toBe(true);
    expect(latexCommands.has('\\lambda')).toBe(true);
    expect(latexCommands.has('\\pi')).toBe(true);
    expect(latexCommands.has('\\omega')).toBe(true);

    // Uppercase
    expect(latexCommands.has('\\Gamma')).toBe(true);
    expect(latexCommands.has('\\Delta')).toBe(true);
    expect(latexCommands.has('\\Omega')).toBe(true);
  });

  it('should include calculus and matrix structures', () => {
    const ops = MATH_SYMBOLS.filter((s) => s.category === 'operators');
    const opsLatex = ops.map((o) => o.latex);
    expect(opsLatex.some((l) => l.includes('\\frac'))).toBe(true);
    expect(opsLatex.some((l) => l.includes('\\int'))).toBe(true);
    expect(opsLatex.some((l) => l.includes('\\sum'))).toBe(true);

    const structures = MATH_SYMBOLS.filter((s) => s.category === 'structures');
    const structLatex = structures.map((st) => st.latex);
    expect(structLatex.some((l) => l.includes('pmatrix'))).toBe(true);
    expect(structLatex.some((l) => l.includes('bmatrix'))).toBe(true);
    expect(structLatex.some((l) => l.includes('cases'))).toBe(true);
  });

  it('should accurately filter symbols by query term', () => {
    const filterByQuery = (q: string) => {
      const term = q.trim().toLowerCase();
      return MATH_SYMBOLS.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.latex.toLowerCase().includes(term) ||
          s.display.toLowerCase().includes(term) ||
          s.description?.toLowerCase().includes(term),
      );
    };

    const alphaMatches = filterByQuery('alpha');
    expect(alphaMatches.length).toBeGreaterThanOrEqual(1);
    expect(alphaMatches[0].latex).toBe('\\alpha');

    const matrixMatches = filterByQuery('matrix');
    expect(matrixMatches.length).toBeGreaterThanOrEqual(2);

    const sumMatches = filterByQuery('sum');
    expect(sumMatches.some((s) => s.latex.includes('\\sum'))).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  extractCitationKeys,
  detectCitationTrigger,
  formatCitationSnippet,
  formatItemAuthorSummary,
} from '@/features/editor/utils/citation.util';
import type { CatalogItem } from '@/features/workspaces/library/types/library.types';

describe('citation.util - extractCitationKeys', () => {
  it('extracts single LaTeX \\cite key', () => {
    const text = 'As shown in \\cite{vaswani2017attention}, attention is all you need.';
    expect(extractCitationKeys(text)).toEqual(['vaswani2017attention']);
  });

  it('extracts comma-separated multi-keys in a single \\cite command', () => {
    const text = 'Recent breakthroughs \\cite{vaswani2017attention, devlin2018bert, he2016deep} established SOTA.';
    expect(extractCitationKeys(text)).toEqual([
      'vaswani2017attention',
      'devlin2018bert',
      'he2016deep',
    ]);
  });

  it('extracts various LaTeX cite command variants with optional arguments', () => {
    const text = `
      \\citep{smith2020}
      \\citet[p. 42]{doe2021}
      \\autocite[see][fig. 1]{johnson2019}
      \\nocite{leCun2015}
    `;
    const keys = extractCitationKeys(text);
    expect(keys).toContain('smith2020');
    expect(keys).toContain('doe2021');
    expect(keys).toContain('johnson2019');
    expect(keys).toContain('leCun2015');
  });

  it('extracts Pandoc-style Markdown bracketed citations', () => {
    const text = 'Prior research [@brown2020language; @radford2019language] investigated scaling laws.';
    const keys = extractCitationKeys(text);
    expect(keys).toContain('brown2020language');
    expect(keys).toContain('radford2019language');
  });

  it('extracts inline Markdown @citekey', () => {
    const text = 'According to @vaswani2017attention, the transformer model performs well.';
    const keys = extractCitationKeys(text);
    expect(keys).toContain('vaswani2017attention');
  });

  it('deduplicates keys and ignores invalid or empty strings', () => {
    const text = '\\cite{vaswani2017attention} and again \\cite{vaswani2017attention, } with nothing.';
    expect(extractCitationKeys(text)).toEqual(['vaswani2017attention']);
    expect(extractCitationKeys('')).toEqual([]);
  });
});

describe('citation.util - detectCitationTrigger', () => {
  it('detects active LaTeX \\cite trigger', () => {
    const ctx = detectCitationTrigger('We refer the reader to \\cite{');
    expect(ctx.isTrigger).toBe(true);
    expect(ctx.format).toBe('latex');
    expect(ctx.searchPrefix).toBe('');
  });

  it('detects active LaTeX \\cite with partial search query', () => {
    const ctx = detectCitationTrigger('See previous work \\cite{vas');
    expect(ctx.isTrigger).toBe(true);
    expect(ctx.format).toBe('latex');
    expect(ctx.searchPrefix).toBe('vas');
  });

  it('detects subsequent key in multi-citation after comma', () => {
    const ctx = detectCitationTrigger('\\cite{vaswani2017attention, dev');
    expect(ctx.isTrigger).toBe(true);
    expect(ctx.format).toBe('latex');
    expect(ctx.searchPrefix).toBe('dev');
  });

  it('detects Markdown bracketed [@ trigger', () => {
    const ctx = detectCitationTrigger('Some findings [@smi');
    expect(ctx.isTrigger).toBe(true);
    expect(ctx.format).toBe('markdown');
    expect(ctx.searchPrefix).toBe('smi');
  });

  it('returns false for normal text', () => {
    const ctx = detectCitationTrigger('Just normal sentence without citation trigger');
    expect(ctx.isTrigger).toBe(false);
  });
});

describe('citation.util - formatCitationSnippet', () => {
  it('formats LaTeX \\cite', () => {
    expect(formatCitationSnippet('vaswani2017', 'latex-cite')).toBe('\\cite{vaswani2017}');
  });

  it('formats LaTeX \\citep', () => {
    expect(formatCitationSnippet('vaswani2017', 'latex-citep')).toBe('\\citep{vaswani2017}');
  });

  it('formats Markdown bracket', () => {
    expect(formatCitationSnippet('vaswani2017', 'markdown-bracket')).toBe('[@vaswani2017]');
  });
});

describe('citation.util - formatItemAuthorSummary', () => {
  it('formats single author', () => {
    const item = {
      contributors: [{ lastName: 'Vaswani', firstName: 'Ashish' }],
    } as CatalogItem;
    expect(formatItemAuthorSummary(item)).toBe('Vaswani');
  });

  it('formats two authors', () => {
    const item = {
      contributors: [
        { lastName: 'Vaswani', firstName: 'Ashish' },
        { lastName: 'Shazeer', firstName: 'Noam' },
      ],
    } as CatalogItem;
    expect(formatItemAuthorSummary(item)).toBe('Vaswani & Shazeer');
  });

  it('formats three or more authors as et al.', () => {
    const item = {
      contributors: [
        { lastName: 'Vaswani', firstName: 'Ashish' },
        { lastName: 'Shazeer', firstName: 'Noam' },
        { lastName: 'Parmar', firstName: 'Niki' },
      ],
    } as CatalogItem;
    expect(formatItemAuthorSummary(item)).toBe('Vaswani et al.');
  });
});

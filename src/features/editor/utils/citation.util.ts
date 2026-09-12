/**
 * Utility functions for parsing, extracting, and formatting citations
 * across LaTeX and Markdown documents in the Flux Editor.
 */

import type { Item } from '@/features/workspaces/library/types/library.types';

/**
 * Regex matching LaTeX citation commands with optional square-bracket arguments:
 * \cite{...}, \citep{...}, \citet{...}, \autocite{...}, \nocite{...}, \parencite{...}, \citeauthor{...}, \citeyear{...}, etc.
 */
const LATEX_CITE_REGEX =
  /\\(?:auto|paren|text|foot|no)?cite(?:p|t|alt|alp|author|year|date|num)?\*?(?:\[[^\]]*\])?(?:\[[^\]]*\])?\{([^}]+)\}/gi;

/**
 * Regex matching Pandoc-style bracketed Markdown citations:
 * [@smith2020; @jones2021] or [see @smith2020, p. 12]
 */
const PANDOC_BRACKET_REGEX = /\[([^\]]*@[a-zA-Z0-9_:-]+[^\]]*)\]/g;

/**
 * Regex matching individual @citekey inside Markdown text or bracketed blocks.
 */
const INLINE_CITEKEY_REGEX = /(?:^|[^\w\\])@([a-zA-Z0-9_:-]+)/g;

/**
 * Extract all unique citation keys from a LaTeX or Markdown document text.
 * Handles single citations, comma/semicolon separated multi-citations, and optional prefixes/suffixes.
 *
 * @example
 * extractCitationKeys('\\cite{vaswani2017attention, devlin2018bert}')
 * // returns ['vaswani2017attention', 'devlin2018bert']
 *
 * @example
 * extractCitationKeys('Prior work [@smith2020; @doe2021] showed that...')
 * // returns ['smith2020', 'doe2021']
 */
export function extractCitationKeys(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  const foundKeys = new Set<string>();

  // 1. Scan LaTeX citation commands
  let match: RegExpExecArray | null;
  LATEX_CITE_REGEX.lastIndex = 0;
  while ((match = LATEX_CITE_REGEX.exec(text)) !== null) {
    const rawKeys = match[1];
    if (rawKeys) {
      const splitKeys = rawKeys.split(',');
      for (const rawKey of splitKeys) {
        const clean = rawKey.trim();
        if (clean && isValidCitekey(clean)) {
          foundKeys.add(clean);
        }
      }
    }
  }

  // 2. Scan Pandoc / Markdown bracketed citations
  PANDOC_BRACKET_REGEX.lastIndex = 0;
  while ((match = PANDOC_BRACKET_REGEX.exec(text)) !== null) {
    const bracketContent = match[1];
    if (bracketContent) {
      INLINE_CITEKEY_REGEX.lastIndex = 0;
      let inlineMatch: RegExpExecArray | null;
      while ((inlineMatch = INLINE_CITEKEY_REGEX.exec(bracketContent)) !== null) {
        const key = inlineMatch[1]?.trim();
        if (key && isValidCitekey(key)) {
          foundKeys.add(key);
        }
      }
    }
  }

  // 3. Scan standalone @citekey in markdown prose
  INLINE_CITEKEY_REGEX.lastIndex = 0;
  while ((match = INLINE_CITEKEY_REGEX.exec(text)) !== null) {
    const key = match[1]?.trim();
    if (key && isValidCitekey(key)) {
      foundKeys.add(key);
    }
  }

  return Array.from(foundKeys);
}

/**
 * Validates whether a string has the syntax of a citation key.
 * Disallows pure whitespace, symbols, or single-character artifacts.
 */
function isValidCitekey(key: string): boolean {
  if (!key || key.length < 2) return false;
  // Valid citekeys typically contain letters, digits, underscores, colons, and hyphens
  return /^[a-zA-Z0-9_:-]+$/.test(key);
}

export type CitationTriggerFormat = 'latex' | 'markdown';

export interface CitationTriggerContext {
  isTrigger: boolean;
  format: CitationTriggerFormat;
  searchPrefix: string;
  commandRangeStart?: number;
}

/**
 * Checks if the text immediately preceding the editor cursor is an active citation trigger.
 * Used by Monaco completion providers and auto-suggestions.
 *
 * Triggers:
 * - LaTeX: `\cite{`, `\citep{`, `\citet{`, `\cite{vas`
 * - Markdown: `[@`, `[@smith; @`
 */
export function detectCitationTrigger(lineBeforeCursor: string): CitationTriggerContext {
  if (!lineBeforeCursor) {
    return { isTrigger: false, format: 'latex', searchPrefix: '' };
  }

  // LaTeX trigger check: matches \cite...{ prefix
  const latexMatch = lineBeforeCursor.match(
    /\\(?:auto|paren|text|foot|no)?cite(?:p|t|alt|alp|author|year|date|num)?\*?(?:\[[^\]]*\])?(?:\[[^\]]*\])?\{([^}]*)$/i,
  );
  if (latexMatch) {
    const currentParam = latexMatch[1] ?? '';
    // If comma-separated, get the part after the last comma
    const parts = currentParam.split(',');
    const activeSearch = parts[parts.length - 1]?.trimStart() ?? '';
    return {
      isTrigger: true,
      format: 'latex',
      searchPrefix: activeSearch,
    };
  }

  // Markdown Pandoc trigger check: matches [@... or ; @...
  const mdBracketMatch = lineBeforeCursor.match(/\[@([a-zA-Z0-9_:-]*)$/);
  if (mdBracketMatch) {
    return {
      isTrigger: true,
      format: 'markdown',
      searchPrefix: mdBracketMatch[1] ?? '',
    };
  }

  const mdMultiMatch = lineBeforeCursor.match(/;\s*@([a-zA-Z0-9_:-]*)$/);
  if (mdMultiMatch) {
    return {
      isTrigger: true,
      format: 'markdown',
      searchPrefix: mdMultiMatch[1] ?? '',
    };
  }

  return { isTrigger: false, format: 'latex', searchPrefix: '' };
}

/**
 * Formats a citation string ready for insertion into the editor.
 */
export function formatCitationSnippet(
  citationKey: string,
  style: 'latex-cite' | 'latex-citep' | 'latex-citet' | 'markdown-bracket' | 'markdown-inline' = 'latex-cite',
): string {
  switch (style) {
    case 'latex-cite':
      return `\\cite{${citationKey}}`;
    case 'latex-citep':
      return `\\citep{${citationKey}}`;
    case 'latex-citet':
      return `\\citet{${citationKey}}`;
    case 'markdown-bracket':
      return `[@${citationKey}]`;
    case 'markdown-inline':
      return `@${citationKey}`;
    default:
      return `\\cite{${citationKey}}`;
  }
}

/**
 * Returns a human-readable summary string for an Item (e.g. for completion details).
 */
export function formatItemAuthorSummary(item: Item): string {
  if (Array.isArray(item.contributors) && item.contributors.length > 0) {
    const firstAuthor = item.contributors[0];
    const lastName = firstAuthor?.lastName || firstAuthor?.name || 'Unknown';
    if (item.contributors.length === 1) {
      return lastName;
    }
    if (item.contributors.length === 2) {
      const secondAuthor = item.contributors[1];
      const secondLastName = secondAuthor?.lastName || secondAuthor?.name || '';
      return `${lastName} & ${secondLastName}`;
    }
    return `${lastName} et al.`;
  }
  return 'Unknown author';
}

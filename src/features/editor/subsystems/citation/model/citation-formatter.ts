/**
 * Utility functions for parsing, extracting, and formatting citations
 * across LaTeX and Markdown documents in the Flux Editor.
 */

import type { Item } from '@/features/library/domain/types/core.types';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';

/**
 * Regex matching LaTeX citation commands with optional square-bracket arguments:
 * \cite{...}, \citep{...}, \citet{...}, \autocite{...}, \nocite{...}, \parencite{...}, \citeauthor{...}, \citeyear{...}, etc.
 */
export const LATEX_CITE_REGEX =
  /\\(?:auto|paren|text|foot|no|new|short)?cite(?:p|t|alt|alp|author|year|date|num|a)?\*?(?:\[[^\]]*\])*(?:\[[^\]]*\])*\{([^}]+)\}/gi;

/**
 * Regex matching Pandoc-style bracketed Markdown citations:
 * [@smith2020; @jones2021] or [see @smith2020, p. 12]
 */
export const PANDOC_BRACKET_REGEX = /\[([^\]]*@[a-zA-Z0-9_:-]+[^\]]*)\]/g;

/**
 * Regex matching individual @citekey inside Markdown text or bracketed blocks.
 */
export const INLINE_CITEKEY_REGEX = /(?:^|[^\w\\])@([a-zA-Z0-9_:-]+)/g;

const COMMENT_STRIP_REGEX = /(^|[^\\])%.*$/gm;
const CODE_BLOCK_STRIP_REGEX = /```[\s\S]*?```/g;
const VALID_CITEKEY_REGEX = /^[a-zA-Z0-9_:-]+$/;
const LATEX_TRIGGER_REGEX =
  /\\(?:auto|paren|text|foot|no|new|short)?cite(?:p|t|alt|alp|author|year|date|num)?\*?(?:\[[^\]]*\])?(?:\[[^\]]*\])?\{([^}]*)$/i;
const MD_BRACKET_TRIGGER_REGEX = /\[@([a-zA-Z0-9_:-]*)$/;
const MD_MULTI_TRIGGER_REGEX = /;\s*@([a-zA-Z0-9_:-]*)$/;
const VIETNAMESE_DIACRITIC_REGEX =
  /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i;
const COMBINING_DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const VIETNAMESE_SURNAME_REGEX =
  /^(nguyen|tran|le|pham|hoang|huynh|phan|vu|vo|dang|bui|do|ho|ngo|duong|ly|dinh|doan|lam|trinh|mai|dao|cao|ha|luu|luong|thai|ta|phung|to|vuong|chu)(\s|$)/i;
const AUTHOR_DELIMITER_REGEX = /\s+and\s+|;\s*/i;
const WHITESPACE_SPLIT_REGEX = /\s+/;
const WHITESPACE_COLLAPSE_REGEX = /\s+/g;
const COMMA_SPACING_REGEX = /,\s*/g;
const ABSTRACT_PREFIX_REGEX = /^(?:(?:abstract|background)\s*[:\-\u2013\u2014]\s*)+/i;
const NO_TRIGGER_RESULT: CitationTriggerContext = {
  isTrigger: false,
  format: 'latex',
  searchPrefix: '',
};

/**
 * Strips LaTeX comments (% ...) while preserving escaped percent signs (\%).
 */
export function stripLatexComments(raw: string): string {
  if (!raw) return '';
  if (raw.indexOf('%') === -1) return raw;
  return raw.replace(COMMENT_STRIP_REGEX, '$1');
}

/**
 * Strips fenced markdown code blocks (```...```) to avoid scanning citation examples in code snippets.
 */
export function stripCodeBlocks(raw: string): string {
  if (!raw) return '';
  if (raw.indexOf('```') === -1) return raw;
  return raw.replace(CODE_BLOCK_STRIP_REGEX, '');
}

/**
 * Extract all unique citation keys from a LaTeX or Markdown document text.
 * Handles single citations, comma/semicolon separated multi-citations, and optional prefixes/suffixes.
 * Automatically ignores commented LaTeX lines (% \cite{...}) and code snippets.
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
  if (text.indexOf('\\') === -1 && text.indexOf('@') === -1) return [];

  // Sanitize document text to eliminate false positives from comments & code blocks
  const sanitizedText = stripLatexComments(stripCodeBlocks(text));

  const foundKeys = new Set<string>();

  // 1. Scan LaTeX citation commands
  let match: RegExpExecArray | null;
  if (sanitizedText.indexOf('cite') !== -1) {
    LATEX_CITE_REGEX.lastIndex = 0;
    while ((match = LATEX_CITE_REGEX.exec(sanitizedText)) !== null) {
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
  }

  // 2. Scan Pandoc / Markdown bracketed citations & standalone @citekey
  if (sanitizedText.indexOf('@') !== -1) {
    PANDOC_BRACKET_REGEX.lastIndex = 0;
    while ((match = PANDOC_BRACKET_REGEX.exec(sanitizedText)) !== null) {
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
    while ((match = INLINE_CITEKEY_REGEX.exec(sanitizedText)) !== null) {
      const key = match[1]?.trim();
      if (key && isValidCitekey(key)) {
        foundKeys.add(key);
      }
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
  return VALID_CITEKEY_REGEX.test(key);
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
 * Used by CodeMirror 6 completion providers and auto-suggestions.
 *
 * Triggers:
 * - LaTeX: `\cite{`, `\citep{`, `\citet{`, `\cite{vas`
 * - Markdown: `[@`, `[@smith; @`
 */
export function detectCitationTrigger(lineBeforeCursor: string): CitationTriggerContext {
  if (!lineBeforeCursor) {
    return NO_TRIGGER_RESULT;
  }
  if (lineBeforeCursor.indexOf('\\') === -1 && lineBeforeCursor.indexOf('@') === -1) {
    return NO_TRIGGER_RESULT;
  }

  // LaTeX trigger check: matches \cite...{ prefix
  const latexMatch = lineBeforeCursor.match(LATEX_TRIGGER_REGEX);
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
  const mdBracketMatch = lineBeforeCursor.match(MD_BRACKET_TRIGGER_REGEX);
  if (mdBracketMatch) {
    return {
      isTrigger: true,
      format: 'markdown',
      searchPrefix: mdBracketMatch[1] ?? '',
    };
  }

  const mdMultiMatch = lineBeforeCursor.match(MD_MULTI_TRIGGER_REGEX);
  if (mdMultiMatch) {
    return {
      isTrigger: true,
      format: 'markdown',
      searchPrefix: mdMultiMatch[1] ?? '',
    };
  }

  return NO_TRIGGER_RESULT;
}

/**
 * Strategy Lookup Table for Citation Snippet Formatting.
 * Maps canonical and alias citation styles to pure formatting functions.
 */
export const CITATION_SNIPPET_FORMATTERS: Readonly<Record<string, (key: string) => string>> = {
  'latex-cite': (key) => `\\cite{${key}}`,
  cite: (key) => `\\cite{${key}}`,
  'latex-citep': (key) => `\\citep{${key}}`,
  citep: (key) => `\\citep{${key}}`,
  'latex-citet': (key) => `\\citet{${key}}`,
  citet: (key) => `\\citet{${key}}`,
  'latex-autocite': (key) => `\\autocite{${key}}`,
  autocite: (key) => `\\autocite{${key}}`,
  'markdown-bracket': (key) => `[@${key}]`,
  markdown: (key) => `[@${key}]`,
  'markdown-inline': (key) => `@${key}`,
};

/**
 * Formats a citation string ready for insertion into the editor.
 */
export function formatCitationSnippet(
  citationKey: string,
  style:
    | 'latex-cite'
    | 'latex-citep'
    | 'latex-citet'
    | 'latex-autocite'
    | 'markdown-bracket'
    | 'markdown-inline'
    | 'cite'
    | 'citep'
    | 'citet'
    | 'autocite'
    | 'markdown'
    | string = 'latex-cite',
): string {
  const formatter =
    CITATION_SNIPPET_FORMATTERS[style] ?? CITATION_SNIPPET_FORMATTERS['latex-cite'];
  return formatter(citationKey);
}

interface ContributorNameInput {
  literal?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  fullName?: string | null;
  name?: string | null;
}

function extractFamilyPartFromTokens(text: string): string {
  const parts = text.split(WHITESPACE_SPLIT_REGEX);
  if (parts.length === 1) return parts[0];
  return VIETNAMESE_DIACRITIC_REGEX.test(text) ? parts[0] : parts[parts.length - 1];
}

/**
 * Extracts author's family/surname with support for Vietnamese and East Asian naming order.
 */
function getAuthorFamilyName(c: ContributorNameInput | null | undefined): string {
  if (!c) return 'Unknown';
  if (c.literal) return c.literal;
  const rawLast = (c.lastName || '').trim();
  const rawFirst = (c.firstName || '').trim();
  const rawFull = (c.fullName || c.name || '').trim();

  if (rawFull) {
    return extractFamilyPartFromTokens(rawFull);
  }

  if (rawLast) {
    if (rawLast.includes(' ')) {
      return extractFamilyPartFromTokens(rawLast);
    }
    if (rawFirst && VIETNAMESE_DIACRITIC_REGEX.test(rawFirst)) {
      const firstParts = rawFirst.split(WHITESPACE_SPLIT_REGEX);
      if (firstParts.length >= 1) {
        return firstParts[0]; // Self-healing for inverted forms
      }
    }
    return rawLast;
  }

  return rawFirst || 'Unknown';
}

/**
 * Detects if a name or author string is Vietnamese based on diacritics or common surnames
 */
export function isVietnameseAuthorName(name: string): boolean {
  if (!name) return false;
  if (VIETNAMESE_DIACRITIC_REGEX.test(name)) {
    return true;
  }
  const clean = name
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS_REGEX, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
  return VIETNAMESE_SURNAME_REGEX.test(clean);
}

/**
 * Cultural format for author summary (e.g. "Nguyễn Văn An và c.s." vs "Turing et al.")
 */
export function formatShortAuthor(rawAuthorStr?: string): string {
  if (!rawAuthorStr) return '';
  const authors = rawAuthorStr
    .split(AUTHOR_DELIMITER_REGEX)
    .map((a) => a.trim())
    .filter(Boolean);

  if (authors.length === 0) return '';

  const formatSingle = (authorStr: string): string => {
    const trimmed = authorStr.trim();
    if (isVietnameseAuthorName(trimmed)) {
      // Natural Vietnamese: remove accidental commas (e.g. "Nguyễn, Văn An" -> "Nguyễn Văn An")
      return trimmed.replace(COMMA_SPACING_REGEX, ' ');
    }
    // Western: extract last name
    if (trimmed.includes(',')) {
      return trimmed.split(',')[0].trim();
    }
    const parts = trimmed.split(WHITESPACE_SPLIT_REGEX);
    return parts[parts.length - 1] || trimmed;
  };

  const firstAuthor = formatSingle(authors[0]);
  if (authors.length === 1) {
    return firstAuthor;
  }
  if (authors.length === 2) {
    return `${firstAuthor} & ${formatSingle(authors[1])}`;
  }
  return `${firstAuthor} ${isVietnameseAuthorName(authors[0]) ? 'và c.s.' : 'et al.'}`;
}

function resolveRawAuthorString(entry: { author?: string; authors?: string[] }): string | undefined {
  return entry.author || (entry.authors && entry.authors.length > 0 ? entry.authors.join(' and ') : undefined);
}

/**
 * Formats an in-text citation preview e.g. "(Nguyen et al., 2024)"
 */
export function formatInTextCitationPreview(entry: { author?: string; authors?: string[]; year?: string }): string {
  const authorShort = formatShortAuthor(resolveRawAuthorString(entry));
  const yearStr = entry.year || 'n.d.';
  return authorShort ? `(${authorShort}, ${yearStr})` : `(${yearStr})`;
}

/**
 * Formats a single line bibliography preview entry
 */
export function formatBibliographyPreview(entry: {
  author?: string;
  authors?: string[];
  title?: string;
  journal?: string;
  booktitle?: string;
  year?: string;
  doi?: string;
}): string {
  const authorShort = formatShortAuthor(resolveRawAuthorString(entry)) || 'Anonymous';
  const yearStr = entry.year ? `(${entry.year})` : '(n.d.)';
  const titleStr = entry.title ? `"${entry.title}"` : 'Untitled document';
  const pub = entry.journal || entry.booktitle || '';
  const pubPart = pub ? `. ${pub}` : '';
  const doiPart = entry.doi ? `. DOI: ${entry.doi}` : '';
  return `${authorShort} ${yearStr}. ${titleStr}${pubPart}${doiPart}`;
}

/**
 * Returns a human-readable author summary string for a BibEntry.
 */
export function formatBibEntryAuthorSummary(entry: Pick<BibEntry, 'authors'>): string {
  if (entry.authors && entry.authors.length > 0) {
    return entry.authors.length <= 2
      ? entry.authors.join(' & ')
      : `${entry.authors[0]} et al.`;
  }
  return 'Unknown author';
}

/**
 * Returns a human-readable summary string for an Item (e.g. for completion details).
 */
export function formatItemAuthorSummary(item: Item): string {
  if (!Array.isArray(item.contributors) || item.contributors.length === 0) {
    return 'Unknown author';
  }
  const firstLastName = getAuthorFamilyName(item.contributors[0]);
  if (item.contributors.length === 1) {
    return firstLastName;
  }
  if (item.contributors.length === 2) {
    return `${firstLastName} & ${getAuthorFamilyName(item.contributors[1])}`;
  }
  return `${firstLastName} et al.`;
}

function appendBibtexFields(
  fields: string[],
  entries: ReadonlyArray<readonly [string, string | number | null | undefined]>,
): void {
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== '') {
      fields.push(`  ${key} = {${value}}`);
    }
  }
}

/**
 * Formats an Item into a standard BibTeX entry (@article, @inproceedings, @book).
 */
export function formatItemToBibtex(item: Item): string {
  const key = item.citationKey || item.id || 'reference';
  const itemType = (item.itemType || 'article').toLowerCase();
  let type = 'article';
  if (itemType.includes('book')) type = 'book';
  else if (itemType.includes('conf') || itemType.includes('proc')) type = 'inproceedings';
  else if (itemType.includes('thesis')) type = 'phdthesis';

  let authorValue: string | undefined;
  if (item.authors && item.authors.length > 0) {
    authorValue = item.authors.join(' and ');
  } else if (item.contributors && item.contributors.length > 0) {
    const names = item.contributors
      .map((c) => {
        if (c.name) return c.name;
        if (c.lastName && c.firstName) return `${c.lastName}, ${c.firstName}`;
        return c.lastName || c.firstName || '';
      })
      .filter(Boolean);
    if (names.length > 0) authorValue = names.join(' and ');
  }

  const fields: string[] = [];
  appendBibtexFields(fields, [
    ['title', item.title],
    ['author', authorValue],
    ['journal', item.publicationTitle],
    ['year', item.year],
    ['doi', item.doi],
    ['volume', item.volume],
    ['pages', item.pages],
  ]);

  return `@${type}{${key},\n${fields.join(',\n')}\n}`;
}

/**
 * Formats a parsed BibEntry into a standard, pretty-printed BibTeX entry string.
 * Uses raw snippet if available, or synthesizes clean BibTeX from metadata.
 */
export function formatBibEntryToBibtex(entry: BibEntry): string {
  if (entry.raw && entry.raw.trim().startsWith('@')) {
    return entry.raw.trim();
  }
  const type = (entry.type || 'article').toLowerCase();
  const fields: string[] = [];

  appendBibtexFields(fields, [
    ['title', entry.title],
    ['author', entry.authors && entry.authors.length > 0 ? entry.authors.join(' and ') : undefined],
    ['journal', entry.journal],
    ['booktitle', entry.booktitle],
    ['year', entry.year],
    ['volume', entry.volume],
    ['number', entry.number],
    ['pages', entry.pages],
    ['publisher', entry.publisher],
    ['doi', entry.doi],
    ['url', entry.url],
    ['abstract', entry.abstract ? entry.abstract.replace(WHITESPACE_COLLAPSE_REGEX, ' ').trim() : undefined],
  ]);

  return `@${type}{${entry.key},\n${fields.join(',\n')}\n}`;
}

/**
 * Cleans raw abstract text:
 * - Strips leading 'Abstract:', 'Abstract — ', 'BACKGROUND:' or redundant labels
 * - Cleans excessive whitespace and trims
 */
export function cleanAbstractText(rawAbstract?: string): string {
  if (!rawAbstract || typeof rawAbstract !== 'string') return '';
  return rawAbstract
    .replace(ABSTRACT_PREFIX_REGEX, '')
    .replace(WHITESPACE_COLLAPSE_REGEX, ' ')
    .trim();
}

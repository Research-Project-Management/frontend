/**
 * Utility functions for parsing, extracting, and formatting citations
 * across LaTeX and Markdown documents in the Flux Editor.
 */

import type { Item } from '@/features/library/domain/types/library.types';
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

/**
 * Extracts author's family/surname with support for Vietnamese and East Asian naming order.
 */
function getAuthorFamilyName(c: ContributorNameInput | null | undefined): string {
  if (!c) return 'Unknown';
  if (c.literal) return c.literal;
  const rawLast = (c.lastName || '').trim();
  const rawFirst = (c.firstName || '').trim();
  const rawFull = (c.fullName || c.name || '').trim();

  // If full name provided
  if (rawFull) {
    const parts = rawFull.split(/\s+/);
    if (parts.length === 1) return parts[0];
    const isVn = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(rawFull);
    if (isVn) return parts[0]; // Vietnamese surname is first
    return parts[parts.length - 1]; // Western surname is last
  }

  if (rawLast) {
    if (rawLast.includes(' ')) {
      const parts = rawLast.split(/\s+/);
      const isVn = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(rawLast);
      if (isVn) return parts[0];
      return parts[parts.length - 1];
    }
    if (rawFirst) {
      const firstParts = rawFirst.split(/\s+/);
      const isVn = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(rawFirst);
      if (isVn && firstParts.length >= 1) {
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
  if (/[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(name)) {
    return true;
  }
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
  return /^(nguyen|tran|le|pham|hoang|huynh|phan|vu|vo|dang|bui|do|ho|ngo|duong|ly|dinh|doan|lam|trinh|mai|dao|cao|ha|luu|luong|thai|ta|phung|to|vuong|chu)(\s|$)/i.test(
    clean
  );
}

/**
 * Cultural format for author summary (e.g. "Nguyễn Văn An và c.s." vs "Turing et al.")
 */
export function formatShortAuthor(rawAuthorStr?: string): string {
  if (!rawAuthorStr) return '';
  const authors = rawAuthorStr
    .split(/\s+and\s+|;\s*/i)
    .map((a) => a.trim())
    .filter(Boolean);

  if (authors.length === 0) return '';

  const formatSingle = (authorStr: string): string => {
    const trimmed = authorStr.trim();
    if (isVietnameseAuthorName(trimmed)) {
      // Natural Vietnamese: remove accidental commas (e.g. "Nguyễn, Văn An" -> "Nguyễn Văn An")
      return trimmed.replace(/,\s*/g, ' ');
    }
    // Western: extract last name
    if (trimmed.includes(',')) {
      return trimmed.split(',')[0].trim();
    }
    const parts = trimmed.split(/\s+/);
    return parts[parts.length - 1] || trimmed;
  };

  const firstAuthor = formatSingle(authors[0]);
  const isVn = isVietnameseAuthorName(authors[0]);

  if (authors.length === 1) {
    return firstAuthor;
  }
  if (authors.length === 2) {
    const secondAuthor = formatSingle(authors[1]);
    return `${firstAuthor} & ${secondAuthor}`;
  }
  return `${firstAuthor} ${isVn ? 'và c.s.' : 'et al.'}`;
}

/**
 * Formats an in-text citation preview e.g. "(Nguyen et al., 2024)"
 */
export function formatInTextCitationPreview(entry: { author?: string; authors?: string[]; year?: string }): string {
  const rawAuthor = entry.author || (entry.authors && entry.authors.length > 0 ? entry.authors.join(' and ') : undefined);
  const authorShort = formatShortAuthor(rawAuthor);
  const yearStr = entry.year || 'n.d.';
  if (!authorShort) return `(${yearStr})`;
  return `(${authorShort}, ${yearStr})`;
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
  const rawAuthor = entry.author || (entry.authors && entry.authors.length > 0 ? entry.authors.join(' and ') : undefined);
  const authorShort = formatShortAuthor(rawAuthor) || 'Anonymous';
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
  if (Array.isArray(item.contributors) && item.contributors.length > 0) {
    const firstAuthor = item.contributors[0];
    const lastName = getAuthorFamilyName(firstAuthor);
    if (item.contributors.length === 1) {
      return lastName;
    }
    if (item.contributors.length === 2) {
      const secondAuthor = item.contributors[1];
      const secondLastName = getAuthorFamilyName(secondAuthor);
      return `${lastName} & ${secondLastName}`;
    }
    return `${lastName} et al.`;
  }
  return 'Unknown author';
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

  const fields: string[] = [];
  if (item.title) fields.push(`  title = {${item.title}}`);
  if (item.authors && item.authors.length > 0) {
    fields.push(`  author = {${item.authors.join(' and ')}}`);
  } else if (item.contributors && item.contributors.length > 0) {
    const names = item.contributors
      .map((c) => {
        if (c.name) return c.name;
        if (c.lastName && c.firstName) {
          return `${c.lastName}, ${c.firstName}`;
        }
        return c.lastName || c.firstName || '';
      })
      .filter(Boolean);
    if (names.length > 0) fields.push(`  author = {${names.join(' and ')}}`);
  }
  if (item.publicationTitle) {
    fields.push(`  journal = {${item.publicationTitle}}`);
  }
  if (item.year) fields.push(`  year = {${item.year}}`);
  if (item.doi) fields.push(`  doi = {${item.doi}}`);
  if (item.volume) fields.push(`  volume = {${item.volume}}`);
  if (item.pages) fields.push(`  pages = {${item.pages}}`);

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

  if (entry.title) {
    fields.push(`  title = {${entry.title}}`);
  }
  if (entry.authors && entry.authors.length > 0) {
    fields.push(`  author = {${entry.authors.join(' and ')}}`);
  }
  if (entry.journal) {
    fields.push(`  journal = {${entry.journal}}`);
  }
  if (entry.booktitle) {
    fields.push(`  booktitle = {${entry.booktitle}}`);
  }
  if (entry.year) {
    fields.push(`  year = {${entry.year}}`);
  }
  if (entry.volume) {
    fields.push(`  volume = {${entry.volume}}`);
  }
  if (entry.number) {
    fields.push(`  number = {${entry.number}}`);
  }
  if (entry.pages) {
    fields.push(`  pages = {${entry.pages}}`);
  }
  if (entry.publisher) {
    fields.push(`  publisher = {${entry.publisher}}`);
  }
  if (entry.doi) {
    fields.push(`  doi = {${entry.doi}}`);
  }
  if (entry.url) {
    fields.push(`  url = {${entry.url}}`);
  }
  if (entry.abstract) {
    const cleanAbstract = entry.abstract.replace(/\s+/g, ' ').trim();
    fields.push(`  abstract = {${cleanAbstract}}`);
  }

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
    .replace(/^(?:abstract\s*[:\-\u2013\u2014]\s*)+/i, '')
    .replace(/^(?:background\s*[:\-\u2013\u2014]\s*)+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Utility functions for parsing, extracting, and formatting citations
 * across LaTeX and Markdown documents in the Flux Editor.
 */

import type { Item } from '@/features/library';
import type { BibEntry } from './bib-parser';

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
 * Strips LaTeX comments (% ...) while preserving escaped percent signs (\%).
 */
export function stripLatexComments(raw: string): string {
  if (!raw) return '';
  return raw.replace(/(^|[^\\])%.*$/gm, '$1');
}

/**
 * Strips fenced markdown code blocks (```...```) to avoid scanning citation examples in code snippets.
 */
export function stripCodeBlocks(raw: string): string {
  if (!raw) return '';
  return raw.replace(/```[\s\S]*?```/g, '');
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

  // Sanitize document text to eliminate false positives from comments & code blocks
  const sanitizedText = stripLatexComments(stripCodeBlocks(text));

  const foundKeys = new Set<string>();

  // 1. Scan LaTeX citation commands
  let match: RegExpExecArray | null;
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

  // 2. Scan Pandoc / Markdown bracketed citations
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
 * Used by CodeMirror 6 completion providers and auto-suggestions.
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
 * Extracts author's family/surname with support for Vietnamese and East Asian naming order.
 */
function getAuthorFamilyName(c: any): string {
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
  return isVn ? `${firstAuthor} và c.s.` : `${firstAuthor} et al.`;
}

/**
 * Formats an in-text citation preview e.g. "(Nguyễn Văn An và c.s., 2024)"
 */
export function formatInTextCitationPreview(entry: { author?: string; year?: string }): string {
  const authorShort = formatShortAuthor(entry.author);
  const yearStr = entry.year || 'n.d.';
  if (!authorShort) return `(${yearStr})`;
  return `(${authorShort}, ${yearStr})`;
}

/**
 * Formats a single line bibliography preview entry
 */
export function formatBibliographyPreview(entry: {
  author?: string;
  title?: string;
  journal?: string;
  booktitle?: string;
  year?: string;
  doi?: string;
}): string {
  const authorShort = formatShortAuthor(entry.author) || 'Khuyết danh';
  const yearStr = entry.year ? `(${entry.year})` : '(n.d.)';
  const titleStr = entry.title ? `"${entry.title}"` : 'Tài liệu không tên';
  const pub = entry.journal || entry.booktitle || '';
  const pubPart = pub ? `. ${pub}` : '';
  const doiPart = entry.doi ? `. DOI: ${entry.doi}` : '';
  return `${authorShort} ${yearStr}. ${titleStr}${pubPart}${doiPart}`;
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
  if (item.journal || (item as any).publicationTitle) {
    fields.push(`  journal = {${item.journal || (item as any).publicationTitle}}`);
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

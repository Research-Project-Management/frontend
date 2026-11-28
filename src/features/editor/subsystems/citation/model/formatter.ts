/**
 * Utility functions for parsing, extracting, and formatting citations
 * across LaTeX and Markdown documents in the Flux Editor.
 */

import type { Item } from '@/features/library/types/core.types';
import {
  formatBibtexContent,
  serializeBibDocument,
  type BibEntry,
} from '@/features/editor/domain/latex/bib-parser';
import { stripLatexComments } from '@/features/editor/domain/latex/dependency-graph';

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
const INLINE_CITEKEY_REGEX = /(?:^|[^\w\\])@([a-zA-Z0-9_:-]+)/g;

const CODE_BLOCK_STRIP_REGEX = /```[\s\S]*?```/g;
const VALID_CITEKEY_REGEX = /^[a-zA-Z0-9_:-]+$/;
const VIETNAMESE_DIACRITIC_REGEX =
  /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i;
const COMBINING_DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const VIETNAMESE_SURNAME_REGEX =
  /^(nguyen|tran|le|pham|hoang|huynh|phan|vu|vo|dang|bui|do|ho|ngo|duong|ly|dinh|doan|lam|trinh|mai|dao|cao|ha|luu|luong|thai|ta|phung|to|vuong|chu)(\s|$)/i;
const AUTHOR_DELIMITER_REGEX = /\s+and\s+|;\s*/i;
const WHITESPACE_SPLIT_REGEX = /\s+/;
const COMMA_SPACING_REGEX = /,\s*/g;

/**
 * Strips fenced markdown code blocks (```...```) to avoid scanning citation examples in code snippets.
 */
function stripCodeBlocks(raw: string): string {
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

/**
 * Strategy Lookup Table for Citation Snippet Formatting.
 * Maps canonical and alias citation styles to pure formatting functions.
 */
const CITATION_SNIPPET_FORMATTERS: Readonly<Record<string, (key: string) => string>> = {
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
 * Cultural format for author summary (e.g. "Nguyá»…n VÄƒn An và c.s." vs "Turing et al.")
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
      // Natural Vietnamese: remove accidental commas (e.g. "Nguyá»…n, VÄƒn An" -> "Nguyá»…n VÄƒn An")
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
 * Normalizes and parses raw BibTeX or contributor author strings into an array of clean author names.
 * Handles single string ("Shaoqing Ren and Kaiming He and Ross Girshick"),
 * array of strings (including unparsed composite entries), and "Last, First" formats.
 */
export function parseBibtexAuthors(input?: string | string[] | null): string[] {
  if (!input) return [];
  const rawList: string[] = Array.isArray(input) ? input : [input];
  const results: string[] = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'string') continue;
    const splitTokens = item.split(/\s+and\s+|;\s*/i);
    for (const token of splitTokens) {
      const cleanToken = token.replace(/[{}]/g, '').trim();
      if (!cleanToken) continue;

      if (cleanToken.includes(',')) {
        const [lastName, firstName] = cleanToken.split(',').map((s) => s.trim());
        if (lastName && firstName) {
          if (isVietnameseAuthorName(lastName)) {
            results.push(`${lastName} ${firstName}`);
          } else {
            results.push(`${firstName} ${lastName}`);
          }
          continue;
        }
      }

      results.push(cleanToken);
    }
  }

  return results;
}

/**
 * Cleans LaTeX formatting artifacts, curly braces, and spaced hyphens from paper titles.
 * E.g. "{Faster R-CNN: Towards Real - Time ...}" -> "Faster R-CNN: Towards Real-Time ..."
 */
export function cleanBibtexTitle(title?: string | null): string {
  if (!title) return '';
  return title
    .replace(/[{}]/g, '')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Humanizes raw machine item types / BibTeX entries into clean academic labels.
 * E.g. "journalarticle" -> "Journal Article", "inproceedings" -> "Conference Paper"
 */
export function formatCitationTypeBadge(type?: string | null): string {
  if (!type) return 'Article';
  const lower = type.toLowerCase().replace(/[^a-z]/g, '');
  switch (lower) {
    case 'journalarticle':
    case 'article':
      return 'Journal Article';
    case 'inproceedings':
    case 'conference':
    case 'proceedings':
    case 'conferencepaper':
      return 'Conference Paper';
    case 'book':
      return 'Book';
    case 'booksection':
    case 'incollection':
    case 'inbook':
      return 'Book Section';
    case 'phdthesis':
      return 'PhD Thesis';
    case 'mastersthesis':
      return "Master's Thesis";
    case 'thesis':
      return 'Thesis';
    case 'techreport':
    case 'report':
      return 'Report';
    case 'preprint':
    case 'unpublished':
      return 'Preprint';
    case 'dataset':
      return 'Dataset';
    case 'webpage':
    case 'website':
    case 'online':
    case 'misc':
      return 'Document';
    default:
      return type
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^[a-z]/, (c) => c.toUpperCase());
  }
}

/**
 * Returns a human-readable author summary string for a BibEntry.
 */
export function formatBibEntryAuthorSummary(
  entry: Pick<BibEntry, 'authors'> & Partial<Pick<BibEntry, 'author'>>,
): string {
  const raw = resolveRawAuthorString(entry);
  if (raw) {
    const short = formatShortAuthor(raw);
    if (short) return short;
  }
  const parsed = parseBibtexAuthors(entry.authors || (entry.author ? [entry.author] : undefined));
  if (parsed.length === 1) {
    return parsed[0];
  }
  if (parsed.length === 2) {
    return `${parsed[0]} & ${parsed[1]}`;
  }
  if (parsed.length > 2) {
    return `${parsed[0]} et al.`;
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

/**
 * Formats an Item into a standard BibTeX entry (@article, @inproceedings, @book).
 */
export function formatItemToBibtex(item: Item): string {
  const key = item.citationKey || item.id || 'reference';
  const type = normalizeBibtexEntryType(item.itemType || 'article');

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

  const venueField =
    type === 'inproceedings' || type === 'incollection' ? 'booktitle' : 'journal';
  const fields: Record<string, string> = {};
  if (item.title) fields.title = String(item.title);
  if (authorValue) fields.author = authorValue;
  if (item.publicationTitle) fields[venueField] = String(item.publicationTitle);
  if (item.year) fields.year = String(item.year);
  if (item.doi) fields.doi = String(item.doi);
  if (item.volume) fields.volume = String(item.volume);
  if (item.pages) fields.pages = String(item.pages);

  return serializeBibDocument({
    preambleBlocks: [],
    entries: [{ id: key, type, key, fields }],
  }).trim();
}

function normalizeBibtexEntryType(rawType?: string): string {
  const normalized = (rawType || 'article').toLowerCase().replace(/[\s_-]+/g, '');
  switch (normalized) {
    case 'article':
    case 'journalarticle':
      return 'article';
    case 'inproceedings':
    case 'conferencepaper':
    case 'proceedings':
      return 'inproceedings';
    case 'incollection':
    case 'booksection':
    case 'bookchapter':
    case 'chapter':
      return 'incollection';
    case 'book':
      return 'book';
    case 'phdthesis':
    case 'thesis':
    case 'dissertation':
      return 'phdthesis';
    case 'mastersthesis':
      return 'mastersthesis';
    case 'techreport':
    case 'report':
      return 'techreport';
    case 'preprint':
    case 'unpublished':
      return 'unpublished';
    case 'webpage':
    case 'website':
    case 'online':
    case 'dataset':
    case 'misc':
      return 'misc';
    default:
      return normalized || 'article';
  }
}

/**
 * Formats a parsed BibEntry into a standard, pretty-printed BibTeX entry string.
 * Uses raw snippet if available, or synthesizes clean BibTeX from metadata.
 */
export function formatBibEntryToBibtex(entry: BibEntry): string {
  if (entry.raw && entry.raw.trim().startsWith('@')) {
    return formatBibtexContent(entry.raw.trim()).trim();
  }
  const type = normalizeBibtexEntryType(entry.type);
  const isRedundantDoiUrl =
    Boolean(entry.doi && entry.url) &&
    entry.url!.toLowerCase().includes(entry.doi!.toLowerCase());
  const fields: Record<string, string> = {};
  if (entry.title) fields.title = entry.title;
  if (entry.authors && entry.authors.length > 0) {
    fields.author = entry.authors.join(' and ');
  } else if (entry.author) {
    fields.author = entry.author;
  }
  if (entry.journal) fields.journal = entry.journal;
  if (entry.booktitle) fields.booktitle = entry.booktitle;
  if (entry.year) fields.year = entry.year;
  if (entry.volume) fields.volume = entry.volume;
  if (entry.number) fields.number = entry.number;
  if (entry.pages) fields.pages = entry.pages;
  if (entry.publisher) fields.publisher = entry.publisher;
  if (entry.doi) fields.doi = entry.doi;
  if (entry.url && !isRedundantDoiUrl) fields.url = entry.url;

  return serializeBibDocument({
    preambleBlocks: [],
    entries: [{ id: entry.key, type, key: entry.key, fields }],
  }).trim();
}
